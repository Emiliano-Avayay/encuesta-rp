import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { setTimeout } from "node:timers/promises";
import { createFollowUp, deleteFollowUp, FollowUpError, followUpHistory, getFollowUp, listFollowUp, updateFollowUp } from "../lib/follow-up";
import { filterCompanies } from "../lib/follow-up-core";

const native = ["postgres", "initdb", "pg_ctl"].every((cmd) => spawnSync(cmd, ["--version"]).status === 0);
const docker = !native && spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { timeout: 10000 }).status === 0;

// No acepta una URL externa: crea y destruye exclusivamente su propio clúster.
// Usa socket privado con servidor local o contenedor efímero en puerto local aleatorio.
test("PostgreSQL aislado: migración, auditoría, integridad, concurrencia y rollback reales", { skip: native || docker ? false : "Requiere servidor PostgreSQL local o Docker; nunca usa la base configurada" }, async (t) => {
  const directory = mkdtempSync("/tmp/rp-follow-up-test-");
  const data = path.join(directory, "data"); const socket = path.join(directory, "socket");
  mkdirSync(socket);
  const savedEnv = { ...process.env };
  const memory = globalThis as typeof globalThis & { __rpFollowUpPool?: Pool };
  let db: Pool | undefined;
  let started = false;
  const containerName = `rp-follow-up-test-${crypto.randomUUID()}`;
  function run(cmd: string, args: string[]) {
    const result = spawnSync(cmd, args, { encoding: "utf8", timeout: 60000 });
    assert.equal(result.status, 0, `${cmd}: ${result.error?.message ?? result.stderr}`);
    return result.stdout.trim();
  }
  try {
    let host = socket; let port = 5432;
    if (native) {
      run("initdb", ["-D", data, "-U", "follow_up_tests", "--auth=trust", "--no-locale", "--encoding=UTF8"]);
      run("pg_ctl", ["-D", data, "-l", path.join(directory, "postgres.log"), "-o", `-F -c listen_addresses='' -k ${socket}`, "-w", "start"]);
      started = true;
    } else {
      run("docker", ["run", "--detach", "--rm", "--name", containerName, "--tmpfs", "/var/lib/postgresql/data:rw", "-e", "POSTGRES_USER=follow_up_tests", "-e", "POSTGRES_DB=postgres", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-p", "127.0.0.1::5432", "postgres:16-alpine"]);
      host = "127.0.0.1"; port = Number(run("docker", ["port", containerName, "5432/tcp"]).split(":").at(-1));
    }
    db = new Pool({ host, port, user: "follow_up_tests", database: "postgres", ssl: false, connectionTimeoutMillis: 1000 });
    for (let attempt = 0; ; attempt++) {
      try { await db.query("select 1"); break; }
      catch (error) { if (attempt === 60) throw error; await setTimeout(250); }
    }
    memory.__rpFollowUpPool = db;
    delete process.env.DATABASE_URL; process.env.PGHOST = socket;
    const query = db.query.bind(db);
    // Primero el esquema anterior: permite comprobar compatibilidad con datos existentes.
    await query(readFileSync("db/migrations/2026-10-seguimiento.sql", "utf8"));
    // Empresa anterior a la columna cuit: debe sobrevivir a la migración con cuit NULL.
    const legacyId = crypto.randomUUID();
    await query("insert into follow_up_companies (id, name, name_key, segment, created_by, updated_by) values ($1,'Empresa anterior','empresa anterior','venta','antes','antes')", [legacyId]);
    const legacyBefore = (await query("select * from follow_up_companies where id=$1", [legacyId])).rows[0];
    const cuitMigration = readFileSync("db/migrations/2026-11-seguimiento-cuit.sql", "utf8");
    await query(cuitMigration); await query(cuitMigration);
    await query(readFileSync("db/schema.sql", "utf8"));
    const company = await createFollowUp({ name: "Empresa vinculada", segment: "venta" }, "creador");
    await updateFollowUp(company.id, { notes: "Nota anterior" }, "editor");
    await query("insert into follow_up_audit (company_id, action, changes, actor) values ($1,'import','{}','importador')", [company.id]);
    const historyBefore = (await query("select * from follow_up_audit order by id")).rows;

    await t.test("migración repetible conserva todas las acciones y filas históricas", async () => {
      const migration = readFileSync("db/migrations/2026-10-seguimiento-delete.sql", "utf8");
      await query(migration); await query(migration);
      assert.deepEqual((await query("select * from follow_up_audit order by id")).rows, historyBefore);
      await assert.rejects(query("insert into follow_up_audit (company_id, action, changes, actor) values ($1,'desconocida','{}','admin')", [company.id]));
    });

    await t.test("eliminación preserva respuesta vinculada, otras empresas y planes de acción", async () => {
      const response = (await query("insert into survey_responses (customer, satisfaction, consent) values ($1,$2,true) returning *", [{ company: company.name }, { surveyId: "venta", ratings: { quality: 5 } }])).rows[0];
      await updateFollowUp(company.id, { linkedResponseId: String(response.id), responseStatus: "responded" }, "vinculador");
      const sameSegment = await createFollowUp({ name: "Otra de Venta", segment: "venta" }, "creador");
      const sameName = await createFollowUp({ name: company.name, segment: "oil-gas" }, "creador");
      await query("insert into action_plans (id,category,title,original_filename,stored_filename,mime_type,file_size,uploaded_by) values ($1,'informe','Plan','plan.pdf','plan.pdf','application/pdf',10,'admin')", [crypto.randomUUID()]);
      const companiesBefore = (await query("select * from follow_up_companies where id <> $1 order by id", [company.id])).rows;
      const plansBefore = (await query("select * from action_plans")).rows;
      const before = await getFollowUp(company.id);
      await deleteFollowUp(company.id, "administradora");
      assert.equal(await getFollowUp(company.id), null);
      assert.deepEqual((await query("select * from survey_responses")).rows, [response]);
      assert.deepEqual((await query("select * from action_plans")).rows, plansBefore);
      assert.deepEqual((await query("select * from follow_up_companies order by id")).rows, companiesBefore);
      assert.ok(await getFollowUp(sameSegment.id)); assert.ok(await getFollowUp(sameName.id));
      // Nueva conexión: la auditoría no depende del cliente/transacción del DELETE.
      const client = await db!.connect();
      try {
        const audits = (await client.query("select * from follow_up_audit where company_id=$1 order by id", [company.id])).rows;
        assert.deepEqual(audits.slice(0, 3), historyBefore);
        const deleted = audits.at(-1)!;
        assert.equal(deleted.action, "delete"); assert.equal(deleted.actor, "administradora");
        assert.ok(deleted.at instanceof Date); assert.deepEqual(deleted.changes, { before });
      } finally { client.release(); }
    });

    for (const table of ["follow_up_audit", "follow_up_companies"]) {
      await t.test(`fallo en ${table} revierte empresa y auditoría`, async () => {
        const target = await createFollowUp({ name: `Rollback ${table}`, segment: "agroindustria" }, "creador");
        const before = await getFollowUp(target.id);
        const history = await followUpHistory(target.id);
        await query("create or replace function reject_test_delete() returns trigger language plpgsql as $$ begin raise exception 'Fallo de prueba'; end $$");
        await query(table === "follow_up_audit"
          ? "create trigger reject_delete before insert on follow_up_audit for each row when (new.action = 'delete') execute function reject_test_delete()"
          : "create trigger reject_delete before delete on follow_up_companies for each row execute function reject_test_delete()");
        try {
          await assert.rejects(deleteFollowUp(target.id, "administradora"), /Fallo de prueba/);
          assert.deepEqual(await getFollowUp(target.id), before);
          assert.deepEqual(await followUpHistory(target.id), history);
        } finally { await query(`drop trigger reject_delete on ${table}`); }
      });
    }

    await t.test("dos eliminaciones simultáneas producen un único registro delete y un 404", async () => {
      const target = await createFollowUp({ name: "Concurrente", segment: "servicios-industriales" }, "creador");
      const results = await Promise.allSettled([deleteFollowUp(target.id, "admin1"), deleteFollowUp(target.id, "admin2")]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      assert.ok(rejected.reason instanceof FollowUpError); assert.equal(rejected.reason.status, 404);
      assert.equal((await followUpHistory(target.id)).filter((h) => h.action === "delete").length, 1);
    });

    await t.test("migración cuit: idempotente, conserva empresas anteriores con NULL y restringe el formato", async () => {
      assert.deepEqual((await query("select * from follow_up_companies where id=$1", [legacyId])).rows[0], { ...legacyBefore, cuit: null });
      assert.equal((await query("select count(*)::int as n from information_schema.columns where table_name='follow_up_companies' and column_name='cuit'")).rows[0].n, 1);
      assert.equal((await query("select data_type from information_schema.columns where table_name='follow_up_companies' and column_name='cuit'")).rows[0].data_type, "text");
      await assert.rejects(query("update follow_up_companies set cuit='20-12345678-6' where id=$1", [legacyId]), /follow_up_companies_cuit_check/);
      await assert.rejects(query("update follow_up_companies set cuit='123' where id=$1", [legacyId]));
      // Sin UNIQUE: dos registros pueden compartir CUIT (p. ej. el mismo grupo en dos segmentos).
      const one = await createFollowUp({ name: "Grupo A", segment: "venta", cuit: "30712345671" }, "t");
      const two = await createFollowUp({ name: "Grupo A", segment: "oil-gas", cuit: "30712345671" }, "t");
      assert.ok(one.id !== two.id);
    });

    await t.test("CUIT: alta, recuperación, edición, borrado voluntario y búsqueda sobre PostgreSQL", async () => {
      const created = await createFollowUp({ name: "Con CUIT", segment: "distribuidores", cuit: "20-12345678-6" }, "creador");
      const plain = await createFollowUp({ name: "Sin CUIT", segment: "distribuidores" }, "creador");
      assert.equal((await query("select cuit from follow_up_companies where id=$1", [created.id])).rows[0].cuit, "20123456786");
      assert.equal((await query("select cuit from follow_up_companies where id=$1", [plain.id])).rows[0].cuit, null);
      assert.equal((await getFollowUp(created.id))?.cuit, "20123456786");
      assert.equal((await getFollowUp(plain.id))?.cuit, null);
      await assert.rejects(createFollowUp({ name: "Inválida", segment: "distribuidores", cuit: "20-12345678-0" }, "creador"), (e: unknown) => e instanceof FollowUpError && e.status === 400 && Boolean(e.fields?.cuit));
      assert.equal((await query("select count(*)::int as n from follow_up_companies where name='Inválida'")).rows[0].n, 0);

      const all = await listFollowUp();
      assert.deepEqual(filterCompanies(all, { search: "20-12345678-6", segment: "distribuidores" }).map((c) => c.id), [created.id]);
      assert.deepEqual(filterCompanies(all, { search: "20123456786" }).map((c) => c.id), [created.id]);
      assert.ok(all.some((c) => c.id === legacyId && c.cuit === null));

      assert.equal((await updateFollowUp(created.id, { cuit: "27-20000000-0" }, "editor")).cuit, "27200000000");
      const quick = await updateFollowUp(created.id, { responseStatus: "responded" }, "editor");
      assert.equal(quick.cuit, "27200000000");
      assert.equal((await updateFollowUp(plain.id, { cuit: "30712345671" }, "editor")).cuit, "30712345671");
      await assert.rejects(updateFollowUp(created.id, { cuit: "1234" }, "editor"), FollowUpError);
      assert.equal((await getFollowUp(created.id))?.cuit, "27200000000");

      assert.equal((await updateFollowUp(created.id, { cuit: "" }, "editor")).cuit, null);
      assert.equal((await query("select cuit from follow_up_companies where id=$1", [created.id])).rows[0].cuit, null);
      const history = await followUpHistory(created.id);
      assert.deepEqual(history.find((h) => h.changes.cuit?.to === null)?.changes.cuit, { from: "27200000000", to: null });
    });
  } finally {
    await db?.end(); delete memory.__rpFollowUpPool; process.env = savedEnv;
    if (started) run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
    if (!native) spawnSync("docker", ["rm", "--force", containerName], { timeout: 10000 });
    rmSync(directory, { recursive: true, force: true });
  }
});
