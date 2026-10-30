import assert from "node:assert/strict";
import { test } from "node:test";
import { validateSurveyPayload } from "../lib/validation";

const general = { productQuality: 4, commercialAttention: 5, deliveryDeadlines: 4, technicalInformation: 5, claimResponse: 4 };
const oilGas = (ratings: Record<string, unknown>, additionalComments = "") => ({
  customer: { company: "Oil SA", contactName: "Ana", email: "ana@oil.com" },
  satisfaction: { surveyId: "oil-gas", module: "Oil & Gas", ratings: { ...general, "oilGas.emergencyLogistics": 4, "oilGas.trainingInterest": "yes", "oilGas.fieldSurvey": "no", "oilGas.packaging": "yes", "oilGas.beltUse": "no", ...ratings }, additionalComments },
  consent: true
});

test("an answered optional question is valid", () => {
  assert.deepEqual(validateSurveyPayload(oilGas({ "oilGas.packagingSuggestion": "Cajas más firmes" }, "Gracias")).errors, {});
});

test("regression: an unanswered optional question no longer blocks the submission", () => {
  assert.deepEqual(validateSurveyPayload(oilGas({}, "Solo comentario")).errors, {});
  assert.deepEqual(validateSurveyPayload(oilGas({ "oilGas.packagingSuggestion": "" }, "Solo comentario")).errors, {});
});

test("the closing comment stays optional", () => {
  assert.deepEqual(validateSurveyPayload(oilGas({ "oilGas.packagingSuggestion": "Mejor rotulado" })).errors, {});
});

test("required questions still need an answer or an explicit decline", () => {
  const missing = validateSurveyPayload(oilGas({ "oilGas.beltUse": "yes" }));
  assert.ok(missing.errors["oilGas.beltTypeAndSize"], "required conditional open answer");
  assert.equal(validateSurveyPayload(oilGas({ "oilGas.beltUse": "yes", "oilGas.beltTypeAndSize": null })).valid, true);
  const distributor = validateSurveyPayload({ customer: { company: "D", contactName: "Ana", email: "a@d.com" }, satisfaction: { surveyId: "distribuidores", module: "Distribuidores", ratings: general }, consent: true });
  assert.ok(distributor.errors["distributors.salesSupport"]);
  assert.ok(distributor.errors["distributors.maxDeliveryDays"]);
});

test("quantity answers are validated as quantities, not as 1-5 ratings", () => {
  const distributor = (days: unknown) => validateSurveyPayload({ customer: { company: "D", contactName: "Ana", email: "a@d.com" }, satisfaction: { surveyId: "distribuidores", module: "Distribuidores", ratings: { ...general, "distributors.catalogClarity": 4, "distributors.commercialConditions": "yes", "distributors.packaging": 4, "distributors.productRotation": "yes", "distributors.specialDeliveryDeadlines": "yes", "distributors.maxDeliveryDays": days, "distributors.salesSupport": "Nada" } }, consent: true });
  for (const days of [0, 1, 4, 5, 6, 30, 365]) assert.equal(distributor(days).valid, true, String(days));
  for (const days of [-1, 2.5, "4", 3651]) assert.equal(distributor(days).valid, false, String(days));
});
