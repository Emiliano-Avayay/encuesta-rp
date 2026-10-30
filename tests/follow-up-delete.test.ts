import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createHmac } from "node:crypto";
import type { Pool } from "pg";
import { requestAsyncStorage, type RequestStore } from "next/dist/client/components/request-async-storage.external";
import { RequestCookies } from "next/dist/server/web/spec-extension/cookies";
import { RequestCookiesAdapter } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { DELETE } from "../app/api/seguimiento/[id]/route";
import { deleteFollowUp, followUpHistory, FollowUpError, listFollowUp } from "../lib/follow-up";
import type { FollowUpCompany } from "../lib/follow-up-core";
import { companyFixture, companyRow } from "./follow-up-fixtures";

const memory = globalThis as typeof globalThis & { __rpFollowUp?: FollowUpCompany[]; __rpFollowUpPool?: Pool; __rpFollowUpAudit?: unknown[] };
const savedEnv = { ...process.env };
beforeEach(() => { delete process.env.DATABASE_URL; delete process.env.PGHOST; process.env.AUTH_SECRET = "follow-up-test-secret"; });
afterEach(() => {
  process.env = { ...savedEnv };
  delete memory.__rpFollowUp; delete memory.__rpFollowUpAudit; delete memory.__rpFollowUpPool;
});

function request(id: string, authorized = true) {
  const body = Buffer.from(JSON.stringify({ username: "administradora", exp: Date.now() + 60000 })).toString("base64url");
  const signature = createHmac("sha256", process.env.AUTH_SECRET!).update(body).digest("base64url");
  const cookies = RequestCookiesAdapter.seal(new RequestCookies(new Headers(authorized ? { cookie: `fl_admin_session=${body}.${signature}` } : {})));
  return requestAsyncStorage.run({ cookies } as RequestStore, () => DELETE(new Request("http://localhost/api/seguimiento/" + id, { method: "DELETE" }), { params: { id } }));
}

function fakePostgres(failure?: string, missing = false) {
  process.env.PGHOST = "never-connect-to-a-real-database";
  const queries: { sql: string; values?: unknown[] }[] = [];
  let released = false;
  const client = {
    async query(sql: string, values?: unknown[]) {
      queries.push({ sql, values });
      if (failure && sql.startsWith(failure)) throw new Error("Fallo PostgreSQL simulado");
      return { rows: sql.startsWith("select") && !missing ? [companyRow()] : [], rowCount: 1 };
    },
    release() { released = true; }
  };
  memory.__rpFollowUpPool = { async connect() { if (failure === "connect") throw new Error("Conexión rechazada"); return client; } } as unknown as Pool;
  return { queries, released: () => released };
}

test("DELETE exige requireAdmin antes de acceder a PostgreSQL, incluso con UUID inválido", async () => {
  const db = fakePostgres();
  for (const id of [companyFixture().id, "inválido"]) assert.equal((await request(id, false)).status, 401);
  assert.equal(db.queries.length, 0);
});

test("DELETE rechaza UUID inválidos sin consultas y devuelve 404 para uno inexistente", async () => {
  const db = fakePostgres(undefined, true);
  for (const id of ["mal", "------------------------------------", "111111111111-4111-8111-111111111111", "' OR 1=1 --"]) {
    assert.equal((await request(id)).status, 400);
  }
  assert.equal(db.queries.length, 0);
  assert.equal((await request(companyFixture().id)).status, 404);
  assert.deepEqual(db.queries.map((q) => q.sql), ["begin", "select * from follow_up_companies where id = $1 for update", "rollback"]);
  assert.ok(db.released());
});

test("DELETE audita snapshot y administrador, elimina por ID parametrizado y confirma al final", async () => {
  const db = fakePostgres();
  assert.equal((await request(companyFixture().id)).status, 204);
  assert.deepEqual(db.queries.map((q) => q.sql), [
    "begin", "select * from follow_up_companies where id = $1 for update",
    "insert into follow_up_audit (company_id, action, changes, actor) values ($1,'delete',$2,$3)",
    "delete from follow_up_companies where id = $1", "commit"
  ]);
  assert.deepEqual(db.queries[1].values, [companyFixture().id]);
  assert.deepEqual(db.queries[3].values, [companyFixture().id]);
  assert.deepEqual(JSON.parse(String(db.queries[2].values![1])), { before: companyFixture() });
  assert.equal(db.queries[2].values![2], "administradora");
  assert.ok(db.released());
});

for (const failure of ["select", "insert", "delete", "commit", "connect"]) {
  test(`DELETE maneja error PostgreSQL en ${failure} sin exponer detalles`, async (t) => {
    t.mock.method(console, "error", () => undefined);
    const db = fakePostgres(failure);
    const result = await request(companyFixture().id);
    assert.equal(result.status, 500);
    assert.deepEqual(await result.json(), { error: "No se pudo procesar la solicitud." });
    if (failure !== "connect") {
      assert.equal(db.queries.at(-1)!.sql, "rollback");
      assert.ok(db.released());
    }
    if (failure === "insert") assert.ok(!db.queries.some((q) => q.sql.startsWith("delete")));
  });
}

test("demo elimina solo el ID confirmado en cualquier segmento y conserva auditoría independiente", async () => {
  const segments = ["venta", "distribuidores", "agroindustria", "oil-gas", "servicios-industriales"] as const;
  for (const segment of segments) {
    const target = companyFixture({ segment });
    const other = companyFixture({ id: "22222222-2222-4222-8222-222222222222", segment, name: "Otra empresa" });
    const sameName = companyFixture({ id: "33333333-3333-4333-8333-333333333333", segment: segment === "venta" ? "oil-gas" : "venta" });
    memory.__rpFollowUp = [target, other, sameName];
    const start = Date.now();
    assert.equal((await request(target.id)).status, 204);
    assert.deepEqual((await listFollowUp()).map((c) => c.id).sort(), [other.id, sameName.id].sort());
    const latest = (await followUpHistory(target.id))[0];
    assert.equal(latest.action, "delete"); assert.equal(latest.actor, "administradora");
    assert.ok(Date.parse(latest.at) >= start);
    assert.deepEqual(latest.changes, { before: target });
    target.name = "Mutación posterior";
    assert.equal((latest.changes as { before: FollowUpCompany }).before.name, "Empresa exacta S.A.");
    assert.equal((await request(target.id)).status, 404);
  }
});

test("producción sin PostgreSQL falla explícitamente y no borra en memoria", async () => {
  Object.assign(process.env, { NODE_ENV: "production" });
  const company = companyFixture(); memory.__rpFollowUp = [company];
  await assert.rejects(deleteFollowUp(company.id, "admin"), (error: unknown) => error instanceof FollowUpError && error.status === 503);
  assert.deepEqual(memory.__rpFollowUp, [company]);
  assert.equal(memory.__rpFollowUpAudit, undefined);
});
