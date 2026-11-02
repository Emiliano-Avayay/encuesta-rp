import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { Pool } from "pg";
import { createFollowUp, FollowUpError, getFollowUp, listFollowUp, updateFollowUp } from "../lib/follow-up";
import { filterCompanies, type FollowUpCompany } from "../lib/follow-up-core";

// Modo demo (sin DATABASE_URL): ejercita la capa de datos sin PostgreSQL. Las pruebas con
// PostgreSQL real están en follow-up-postgres.test.ts.
const memory = globalThis as typeof globalThis & { __rpFollowUp?: FollowUpCompany[]; __rpFollowUpPool?: Pool; __rpFollowUpAudit?: unknown[] };
const savedEnv = { ...process.env };
beforeEach(() => { delete process.env.DATABASE_URL; delete process.env.PGHOST; });
afterEach(() => { process.env = { ...savedEnv }; delete memory.__rpFollowUp; delete memory.__rpFollowUpAudit; delete memory.__rpFollowUpPool; });

test("creación con CUIT válido (con o sin guiones) lo guarda normalizado", async () => {
  const a = await createFollowUp({ name: "Con guiones", segment: "venta", cuit: "20-12345678-6" }, "t");
  const b = await createFollowUp({ name: "Sin guiones", segment: "venta", cuit: "30712345671" }, "t");
  assert.equal(a.cuit, "20123456786"); assert.equal(b.cuit, "30712345671");
  assert.equal((await getFollowUp(a.id))?.cuit, "20123456786");
});

test("creación sin CUIT queda en null", async () => {
  const company = await createFollowUp({ name: "Sin CUIT", segment: "venta" }, "t");
  assert.equal(company.cuit, null);
  assert.equal((await createFollowUp({ name: "Vacío", segment: "venta", cuit: "  " }, "t")).cuit, null);
});

test("CUIT incorrecto se rechaza en el servidor sin crear la empresa", async () => {
  await assert.rejects(createFollowUp({ name: "Mal CUIT", segment: "venta", cuit: "20-12345678-9" }, "t"), (error: unknown) => {
    assert.ok(error instanceof FollowUpError); assert.equal(error.status, 400); assert.ok(error.fields?.cuit); return true;
  });
  assert.equal((await listFollowUp()).length, 0);
});

test("actualizar, conservar al editar otros campos y eliminar el CUIT", async () => {
  const company = await createFollowUp({ name: "Editable", segment: "venta", cuit: "20123456786" }, "t");
  assert.equal((await updateFollowUp(company.id, { cuit: "30-71234567-1" }, "t")).cuit, "30712345671");
  // Una edición rápida (estado, notas) sin la clave cuit no la sobrescribe.
  const other = await updateFollowUp(company.id, { responseStatus: "responded", notes: "x" }, "t");
  assert.equal(other.cuit, "30712345671"); assert.equal(other.responseStatus, "responded");
  await assert.rejects(updateFollowUp(company.id, { cuit: "123" }, "t"), FollowUpError);
  assert.equal((await getFollowUp(company.id))?.cuit, "30712345671");
  assert.equal((await updateFollowUp(company.id, { cuit: "" }, "t")).cuit, null);
  assert.equal((await getFollowUp(company.id))?.cuit, null);
});

test("empresas anteriores con CUIT null conviven con las nuevas y se buscan por CUIT", async () => {
  await createFollowUp({ name: "Anterior", segment: "venta" }, "t");
  const nueva = await createFollowUp({ name: "Nueva", segment: "oil-gas", cuit: "27-20000000-0" }, "t");
  const all = await listFollowUp();
  assert.deepEqual(filterCompanies(all, { search: "27-20000000-0" }).map((c) => c.id), [nueva.id]);
  assert.deepEqual(filterCompanies(all, { search: "27200000000" }).map((c) => c.id), [nueva.id]);
  assert.deepEqual(filterCompanies(all, { search: "anterior" }).map((c) => c.name), ["Anterior"]);
});
