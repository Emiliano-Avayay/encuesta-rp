import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CUIT_ERROR, computeStats, cuitDigits, formatCuit, isValidCuit, parseCuit, filterCompanies, isValidEmail, nameKey, parseCsv, planSheetImport, statsBySegment, validateCompanyInput,
  type FollowUpCompany
} from "../lib/follow-up-core";

const company = (over: Partial<FollowUpCompany>): FollowUpCompany => ({
  id: "1", name: "Empresa", segment: "venta", contactName: null, email: null, cuit: null, responseStatus: "undefined",
  whatsapp: { mariaJose: false, sergio: false, jose: false }, notes: null, sourceRow: null, linkedResponseId: null,
  createdAt: "", createdBy: "t", updatedAt: "", updatedBy: "t", ...over
});

const SHEET = [
  "Titulo,,,,,,Tasa,",
  ',,,,,,"44,78%",',
  "% Respuesta,1. Distribuidores:,,,WhatsApp,,,",
  '"64,71%",EMPRESA,CORREO ELECTRONICO,CONTACTO,Maria Jose ,Sergio,José,',
  "TRUE,Alfa SA,ventas@alfa.com ,Ana,,,,",
  "FALSE,Beta,beta@x.com (nota),,TRUE,FALSE,TRUE,",
  "FALSE,BETA ,otro@x.com,,TRUE,FALSE,FALSE,",
  ",,,,,,,",
  "% Respuesta,4. Venta,,,WhatsApp,,,",
  '"30,77%",EMPRESA,CORREO ELECTRONICO,CONTACTO,Maria Jose ,Sergio,José,',
  "FALSE,Gamma,19/10/2026,,FALSE,TRUE,FALSE,",
  ",Delta,12345,,,,,",
  'TRUE,Épsilon,e@x.com,Eve,,,," \'Perez, Juan\' <e@x.com>"'
].join("\r\n");

test("nameKey ignora mayúsculas, acentos y puntuación", () => {
  assert.equal(nameKey("  Épsilon  S.A. "), nameKey("epsilon s a"));
});

test("isValidEmail rechaza fechas, números y correos con texto", () => {
  assert.equal(isValidEmail("a@b.com"), true);
  for (const bad of ["19/10/2026", "12345", "a@b.com (nota)", "", "a@b"]) assert.equal(isValidEmail(bad), false);
});

test("parseCsv respeta comillas, comas y CRLF", () => {
  assert.deepEqual(parseCsv('a,"b,c"\r\n"d ""x""",e\r\n'), [["a", "b,c"], ['d "x"', "e"]]);
});

test("planSheetImport conserva agrupaciones, marcas y no inventa correos", () => {
  const { records, issues } = planSheetImport(parseCsv(SHEET));
  assert.equal(records.length, 5); // "BETA " duplica a "Beta" en la misma agrupación
  const by = (n: string) => records.find((r) => r.name === n)!;
  assert.equal(by("Alfa SA").email, "ventas@alfa.com");
  assert.equal(by("Alfa SA").responseStatus, "responded");
  assert.equal(by("Beta").email, null);
  assert.match(by("Beta").notes ?? "", /beta@x\.com \(nota\)/);
  assert.deepEqual(by("Beta").whatsapp, { mariaJose: true, sergio: false, jose: true });
  assert.equal(by("Gamma").email, null);
  assert.equal(by("Gamma").segment, "venta");
  assert.deepEqual(by("Gamma").whatsapp, { mariaJose: false, sergio: true, jose: false });
  assert.equal(by("Delta").email, null);
  assert.equal(by("Delta").responseStatus, "undefined");
  assert.match(by("Épsilon").notes ?? "", /Perez/);
  const kinds = issues.map((i) => i.kind).sort();
  assert.deepEqual(kinds, ["duplicado_en_planilla", "email_con_texto", "email_descartado", "email_descartado", "sin_estado"]);
});

test("la importación es idempotente: las claves son únicas y estables", () => {
  const first = planSheetImport(parseCsv(SHEET)).records.map((r) => r.key);
  const second = planSheetImport(parseCsv(SHEET)).records.map((r) => r.key);
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, first.length);
});

test("computeStats usa las empresas registradas como denominador", () => {
  const list = [
    company({ responseStatus: "responded" }), company({ responseStatus: "responded" }),
    company({ responseStatus: "not_responded" }), company({ responseStatus: "undefined" })
  ];
  const stats = computeStats(list);
  assert.deepEqual(stats, { total: 4, responded: 2, notResponded: 1, undefinedCount: 1, pending: 2, rate: 0.5 });
  assert.equal(computeStats([]).rate, 0);
});

test("statsBySegment devuelve las cinco encuestas", () => {
  const stats = statsBySegment([company({ segment: "oil-gas", responseStatus: "responded" })]);
  assert.equal(stats.length, 5);
  assert.equal(stats.find((s) => s.id === "oil-gas")!.rate, 1);
  assert.equal(stats.find((s) => s.id === "venta")!.total, 0);
});

test("eliminar recalcula todos los estados, segmentos y el último registro sin dividir por cero", () => {
  const list = [
    company({ id: "a", responseStatus: "responded", segment: "venta" }),
    company({ id: "b", responseStatus: "not_responded", segment: "venta" }),
    company({ id: "c", responseStatus: "undefined", segment: "oil-gas" })
  ];
  assert.deepEqual(computeStats(list.filter((c) => c.id !== "a")), { total: 2, responded: 0, notResponded: 1, undefinedCount: 1, pending: 2, rate: 0 });
  assert.deepEqual(computeStats(list.filter((c) => c.id !== "b")), { total: 2, responded: 1, notResponded: 0, undefinedCount: 1, pending: 1, rate: 0.5 });
  assert.deepEqual(computeStats(list.filter((c) => c.id !== "c")), { total: 2, responded: 1, notResponded: 1, undefinedCount: 0, pending: 1, rate: 0.5 });
  const segments = statsBySegment(list.filter((c) => c.id !== "c"));
  assert.equal(segments.find((s) => s.id === "oil-gas")!.total, 0);
  assert.equal(segments.find((s) => s.id === "venta")!.rate, 0.5);
  assert.deepEqual(computeStats(list.filter(() => false)), { total: 0, responded: 0, notResponded: 0, undefinedCount: 0, pending: 0, rate: 0 });
});

test("filterCompanies combina búsqueda, segmento, estado y WhatsApp", () => {
  const list = [
    company({ id: "a", name: "Cañuelas", email: "x@a.com", segment: "venta", responseStatus: "responded", whatsapp: { mariaJose: true, sergio: false, jose: false } }),
    company({ id: "b", name: "Beta", contactName: "Zoe", segment: "oil-gas", responseStatus: "not_responded" })
  ];
  const ids = (f: Parameters<typeof filterCompanies>[1]) => filterCompanies(list, f).map((c) => c.id);
  assert.deepEqual(ids({ search: "canuelas" }), ["a"]);
  assert.deepEqual(ids({ search: "zoe" }), ["b"]);
  assert.deepEqual(ids({ segment: "oil-gas" }), ["b"]);
  assert.deepEqual(ids({ status: "responded" }), ["a"]);
  assert.deepEqual(ids({ whatsapp: "mariaJose" }), ["a"]);
  assert.deepEqual(ids({ whatsapp: "none" }), ["b"]);
  assert.deepEqual(ids({ segment: "all", status: "all", whatsapp: "all" }), ["a", "b"]);
});

test("validateCompanyInput valida alta completa y parcial", () => {
  assert.equal(validateCompanyInput({ name: "", segment: "x", email: "mal" }).valid, false);
  const ok = validateCompanyInput({ name: " Nueva  SA ", segment: "venta", email: "", whatsapp: { jose: true } });
  assert.equal(ok.valid, true);
  assert.equal(ok.value.name, "Nueva SA");
  assert.equal(ok.value.email, null);
  assert.equal(ok.value.responseStatus, "undefined");
  assert.deepEqual(ok.value.whatsapp, { mariaJose: false, sergio: false, jose: true });
  const partial = validateCompanyInput({ responseStatus: "responded" }, true);
  assert.deepEqual(partial.value, { responseStatus: "responded" });
  assert.equal(validateCompanyInput({ responseStatus: "otro" }, true).valid, false);
});

// ───────────────────────── CUIT ─────────────────────────
test("isValidCuit aplica longitud y dígito verificador módulo 11", () => {
  for (const ok of ["20123456786", "27200000000", "30712345671"]) assert.equal(isValidCuit(ok), true, ok);
  // Verificador incorrecto, resto 10 (sin dígito posible), longitud y caracteres inválidos.
  for (const bad of ["20123456787", "30693450239", "2012345678", "201234567866", "", "2012345678a"]) assert.equal(isValidCuit(bad), false, bad);
});

test("parseCuit normaliza a 11 dígitos con o sin guiones y trata vacío como sin CUIT", () => {
  for (const input of ["20-12345678-6", "20123456786", " 20 12345678 6 ", "20.12345678.6"]) assert.deepEqual(parseCuit(input), { value: "20123456786" });
  for (const empty of ["", "   ", null, undefined]) assert.deepEqual(parseCuit(empty), { value: null });
  for (const bad of ["20-12345678-7", "123", "20-12345678-X", 20123456786]) assert.equal(parseCuit(bad).error, CUIT_ERROR);
});

test("formatCuit muestra XX-XXXXXXXX-X, también de forma progresiva", () => {
  assert.equal(formatCuit("20123456786"), "20-12345678-6");
  assert.equal(formatCuit("20-12345678-6"), "20-12345678-6");
  assert.deepEqual(["2", "20", "201", "2012345678", "20123456786", "201234567869999"].map(formatCuit), ["2", "20", "20-1", "20-12345678", "20-12345678-6", "20-12345678-6"]);
  assert.equal(formatCuit(""), "");
  assert.equal(cuitDigits("20-12345678-6"), "20123456786");
});

test("validateCompanyInput: alta con CUIT válido, sin CUIT e inválido", () => {
  const base = { name: "Alfa", segment: "venta" };
  assert.equal(validateCompanyInput({ ...base, cuit: "20-12345678-6" }).value.cuit, "20123456786");
  assert.equal(validateCompanyInput({ ...base, cuit: "20123456786" }).value.cuit, "20123456786");
  const without = validateCompanyInput(base);
  assert.equal(without.valid, true); assert.equal(without.value.cuit, null);
  const bad = validateCompanyInput({ ...base, cuit: "20-12345678-0" });
  assert.equal(bad.valid, false); assert.equal(bad.errors.cuit, CUIT_ERROR);
});

test("validateCompanyInput parcial no toca el CUIT salvo que venga explícito", () => {
  assert.equal("cuit" in validateCompanyInput({ notes: "x" }, true).value, false);
  assert.equal("cuit" in validateCompanyInput({ responseStatus: "responded" }, true).value, false);
  assert.equal(validateCompanyInput({ cuit: "" }, true).value.cuit, null);
  assert.equal(validateCompanyInput({ cuit: null }, true).value.cuit, null);
  assert.equal(validateCompanyInput({ cuit: "27-20000000-0" }, true).value.cuit, "27200000000");
  assert.equal(validateCompanyInput({ cuit: "27-20000000-1" }, true).valid, false);
});

test("filterCompanies busca por CUIT con o sin guiones y conserva los demás filtros", () => {
  const list = [
    company({ id: "1", name: "Alfa", cuit: "20123456786" }),
    company({ id: "2", name: "Beta", cuit: "30712345671", segment: "oil-gas", responseStatus: "responded" }),
    company({ id: "3", name: "Gamma 3M", cuit: null })
  ];
  const ids = (f: Parameters<typeof filterCompanies>[1]) => filterCompanies(list, f).map((c) => c.id);
  for (const search of ["20123456786", "20-12345678-6", "20-1234", "12345678", "456786"]) assert.deepEqual(ids({ search }), ["1"], search);
  assert.deepEqual(ids({ search: "30-71234567-1" }), ["2"]);
  assert.deepEqual(ids({ search: "12345" }), ["1", "2"]);
  assert.deepEqual(ids({ search: "20123456786", segment: "oil-gas" }), []);
  assert.deepEqual(ids({ search: "30712345671", segment: "oil-gas", status: "responded" }), ["2"]);
  // Empresas con CUIT NULL no rompen la búsqueda y siguen apareciendo por nombre; un término corto no se toma como CUIT.
  assert.deepEqual(ids({ search: "3M" }), ["3"]);
  assert.deepEqual(ids({ search: "12" }), []);
  assert.deepEqual(ids({ search: "gamma" }), ["3"]);
});
