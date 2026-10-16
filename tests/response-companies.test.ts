import assert from "node:assert/strict";
import { test } from "node:test";
import { responseCompanies } from "../lib/response-companies";
import type { SurveyResponse } from "../lib/types";

const response = (id: string, company: string, surveyId: SurveyResponse["satisfaction"]["surveyId"]): SurveyResponse => ({
  id, createdAt: "2026-10-01T00:00:00.000Z", consent: true, source: "poleas-rp",
  customer: { company, contactName: "Contacto" },
  satisfaction: { surveyId, module: surveyId, ratings: {} }
});

const records = [
  response("v1", "Empresa compartida", "venta"),
  response("v2", "Empresa Venta", "venta"),
  response("v3", " empresa venta ", "venta"),
  response("d1", "Empresa compartida", "distribuidores"),
  response("d2", "Empresa Distribuidores", "distribuidores"),
  response("a1", "Empresa Agro", "agroindustria"),
  response("o1", "Empresa Oil", "oil-gas"),
  response("s1", "Empresa Servicios", "servicios-industriales")
];

test("company catalog is scoped only by survey and removes duplicates", () => {
  assert.deepEqual(responseCompanies(records, "venta"), ["Empresa compartida", "Empresa Venta"]);
  assert.deepEqual(responseCompanies(records, "distribuidores"), ["Empresa compartida", "Empresa Distribuidores"]);
  assert.deepEqual(responseCompanies(records, "agroindustria"), ["Empresa Agro"]);
  assert.deepEqual(responseCompanies(records, "oil-gas"), ["Empresa Oil"]);
  assert.deepEqual(responseCompanies(records, "servicios-industriales"), ["Empresa Servicios"]);
  assert.deepEqual(responseCompanies(records), ["Empresa Agro", "Empresa compartida", "Empresa Distribuidores", "Empresa Oil", "Empresa Servicios", "Empresa Venta"]);
});

test("company catalog stays populated even if a separate response list is empty", () => {
  assert.deepEqual(responseCompanies(records, "venta"), ["Empresa compartida", "Empresa Venta"]);
  assert.deepEqual(responseCompanies(records, "no-results"), []);
});
