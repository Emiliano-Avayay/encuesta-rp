import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateMetrics } from "../lib/analytics";
import { generalQuestions, surveyQuestions } from "../lib/constants";
import { applyFilters } from "../lib/response-filters";
import type { SurveyId, SurveyResponse } from "../lib/types";

const response = (id: string, surveyId: SurveyId, ratings: Record<string, number | string | null | undefined>, createdAt = "2026-10-01T12:00:00.000Z"): SurveyResponse => ({
  id, createdAt, consent: true, source: "poleas-rp",
  customer: { company: id === "other" ? "Otra SA" : "RP SA", contactName: "Ana" },
  satisfaction: { surveyId, module: surveyId, ratings }
});

test("Distributor delivery days are shown as a quantity and excluded from its satisfaction average", () => {
  const records = [response("distributor", "distribuidores", {
    productQuality: 4, commercialAttention: 4, deliveryDeadlines: 4, technicalInformation: 4, claimResponse: 4,
    "distributors.catalogClarity": 5, "distributors.packaging": 3, "distributors.maxDeliveryDays": 14.56
  })];
  const metrics = calculateMetrics(records, surveyQuestions("distribuidores").filter(question => question.block === "specific"));
  assert.equal(metrics.average, 4);
  const days = metrics.items.find(item => item.question.key === "distributors.maxDeliveryDays")!;
  assert.equal(days.average, 14.56);
  assert.equal(days.question.unit, "days");
});

test("Numeric values above five never contaminate satisfaction indicators", () => {
  const records = [response("numeric", "distribuidores", {
    productQuality: 5, commercialAttention: 3, deliveryDeadlines: 4, technicalInformation: 2, claimResponse: 1,
    "distributors.maxDeliveryDays": 100
  })];
  assert.equal(calculateMetrics(records, generalQuestions).average, 3);
  assert.equal(calculateMetrics(records, surveyQuestions("distribuidores").filter(question => question.block === "specific")).average, 0);
});

test("Valid satisfaction ratings calculate correctly and null answers remain non-evaluable", () => {
  const records = [
    response("first", "venta", { productQuality: 5, commercialAttention: null, deliveryDeadlines: 3, technicalInformation: 1, claimResponse: 4 }),
    response("second", "venta", { productQuality: 3, commercialAttention: 1, deliveryDeadlines: null, technicalInformation: 5, claimResponse: 2 })
  ];
  const metrics = calculateMetrics(records, generalQuestions);
  assert.equal(metrics.average, 3);
  assert.equal(metrics.noAnswer, 2);
});

test("A valid zero rating is retained instead of being rendered as an absent average", () => {
  const metrics = calculateMetrics([response("zero", "venta", { "venta.purchaseSatisfaction": 0 })], surveyQuestions("venta").filter(question => question.block === "specific"));
  assert.equal(metrics.count, 1);
  assert.equal(metrics.average, 0);
});

test("Conditional answers are counted only when their condition makes them applicable", () => {
  const records = [
    response("shown", "servicios-industriales", { "industrial.performance": "no", "industrial.performanceReason": "No cumple" }),
    response("hidden", "servicios-industriales", { "industrial.performance": "yes", "industrial.performanceReason": "No debe contarse" }),
    response("declined", "servicios-industriales", { "industrial.performance": "no", "industrial.performanceReason": null })
  ];
  const metrics = calculateMetrics(records, surveyQuestions("servicios-industriales").filter(question => question.key === "industrial.performanceReason"));
  assert.equal(metrics.items[0].applicable, 2);
  assert.deepEqual(metrics.items[0].textAnswers, ["No cumple"]);
  assert.equal(metrics.items[0].noAnswer, 1);
});

test("Date, segment and company filtering scopes the indicator inputs", () => {
  const records = [
    response("in-scope", "venta", { productQuality: 5 }, "2026-10-05T12:00:00.000Z"),
    response("other", "venta", { productQuality: 1 }, "2026-09-05T12:00:00.000Z")
  ];
  const filtered = applyFilters(records, { surveyId: "venta", company: "rp sa", from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(filtered.map(item => item.id), ["in-scope"]);
  assert.equal(calculateMetrics(filtered, generalQuestions).average, 5);
});

test("Every segment contributes only its rating controls to satisfaction averages", () => {
  const cases: Array<[SurveyId, Record<string, number | string | null | undefined>, number]> = [
    ["venta", { "venta.logistics": 4, "venta.packaging": 2, "venta.purchaseSatisfaction": 5 }, 11 / 3],
    ["distribuidores", { "distributors.catalogClarity": 4, "distributors.packaging": 2, "distributors.maxDeliveryDays": 30 }, 3],
    ["agroindustria", { "agro.catalogClarity": 4, "agro.priceQuality": 2, "agro.packaging": 3, "agro.trainingInterest": "yes" }, 3],
    ["oil-gas", { "oilGas.emergencyLogistics": 4, "oilGas.trainingInterest": "yes" }, 4],
    ["servicios-industriales", { "industrial.catalogClarity": 4, "industrial.afterSales": 2, "industrial.performance": "yes" }, 3]
  ];
  for (const [surveyId, ratings, expected] of cases) {
    const metrics = calculateMetrics([response(surveyId, surveyId, ratings)], surveyQuestions(surveyId).filter(question => question.block === "specific"));
    assert.equal(metrics.average, expected, surveyId);
  }
});
