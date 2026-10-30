import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateMetrics } from "../lib/analytics";
import { generalQuestions, notEvaluableLabel, ratingLabel, surveyQuestions, type SurveyQuestion } from "../lib/constants";
import { applyFilters } from "../lib/response-filters";
import type { SurveyResponse } from "../lib/types";

const question = (key: string) => surveyQuestions("distribuidores").concat(surveyQuestions("venta")).find(item => item.key === key)!;
const days = question("distributors.maxDeliveryDays");

test("a quantity question always reads as a number with its unit, whatever the value", () => {
  assert.equal(days.kind, "number");
  assert.deepEqual([1, 4, 5, 6, 8, 30, 365].map(value => ratingLabel(value, days)), ["1 día", "4 días", "5 días", "6 días", "8 días", "30 días", "365 días"]);
  assert.equal(ratingLabel(0, days), "0 días");
  assert.equal(ratingLabel(null, days), notEvaluableLabel);
  const unitless: SurveyQuestion = { ...days, unit: undefined };
  assert.deepEqual([1, 4, 5, 6].map(value => ratingLabel(value, unitless)), ["1", "4", "5", "6"]);
});

test("real ratings of 4 and 5 keep reading as satisfaction", () => {
  assert.equal(ratingLabel(4, question("productQuality")), "Satisfecho/a");
  assert.equal(ratingLabel(5, question("productQuality")), "Muy satisfecho/a");
  assert.equal(ratingLabel(4, question("technicalInformation")), "Completa");
  assert.equal(ratingLabel(0, question("venta.purchaseSatisfaction")), "Muy insatisfecho");
  assert.equal(ratingLabel(4, question("venta.logistics")), "★★★★☆ (4/5)");
  assert.equal(ratingLabel(5, question("distributors.packaging")), "★★★★★ (5/5)");
  // A malformed historical star value is shown as stored instead of throwing.
  assert.equal(ratingLabel(9, question("venta.logistics")), "9");
});

test("open text answers are shown verbatim even when they read like a scale value", () => {
  const text = question("distributors.salesSupport");
  assert.equal(ratingLabel("no", text), "no");
  assert.equal(ratingLabel("4", text), "4");
  assert.equal(ratingLabel("", text), "-");
  assert.equal(ratingLabel("yes", question("distributors.commercialConditions")), "Sí");
});

const record = (id: string, company: string, delivery: number | null, rating: number, createdAt = "2026-10-10T12:00:00.000Z"): SurveyResponse => ({
  id, createdAt, consent: true, source: "poleas-rp", customer: { company, contactName: "Ana" },
  satisfaction: { surveyId: "distribuidores", module: "Distribuidores", ratings: { productQuality: rating, commercialAttention: rating, deliveryDeadlines: rating, technicalInformation: rating, claimResponse: rating, "distributors.catalogClarity": rating, "distributors.maxDeliveryDays": delivery } }
});

test("quantities of 1 to 6 and above never enter satisfaction averages; their own average keeps days", () => {
  const records = [record("a", "Uno", 1, 4), record("b", "Dos", 4, 5), record("c", "Tres", 5, 4), record("d", "Cuatro", 6, 5), record("e", "Cinco", 40, 4), record("f", "Seis", null, 5)];
  const specific = calculateMetrics(records, surveyQuestions("distribuidores").filter(item => item.block === "specific"));
  assert.equal(specific.average, 4.5, "only catalogClarity ratings count");
  assert.equal(specific.count, 6);
  const delivery = specific.items.find(item => item.question.key === "distributors.maxDeliveryDays")!;
  assert.equal(delivery.count, 5);
  assert.equal(delivery.average, (1 + 4 + 5 + 6 + 40) / 5);
  assert.equal(delivery.noAnswer, 1);
  assert.equal(specific.noAnswer, 0, "a declined quantity is not a non-evaluable satisfaction answer");
  assert.equal(calculateMetrics(records, generalQuestions).average, 4.5);
});

test("filters keep scoping quantity statistics", () => {
  const records = [record("in", "Uno", 4, 5, "2026-10-10T12:00:00.000Z"), record("out", "Dos", 100, 1, "2026-09-10T12:00:00.000Z")];
  const scoped = calculateMetrics(applyFilters(records, { company: "uno", from: "2026-10-01" }), surveyQuestions("distribuidores").filter(item => item.block === "specific"));
  assert.equal(scoped.items.find(item => item.question.key === "distributors.maxDeliveryDays")!.average, 4);
  assert.equal(scoped.average, 5);
});
