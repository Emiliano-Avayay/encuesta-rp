import assert from "node:assert/strict";
import { test } from "node:test";
import { feedbackByCompany, noCompanyLabel, responseFeedback } from "../lib/response-feedback";
import { applyFilters, sanitizeResponse } from "../lib/response-filters";
import type { SurveyId, SurveyResponse } from "../lib/types";

type Ratings = Record<string, number | string | null | undefined>;
const response = (id: string, company: string, surveyId: SurveyId, ratings: Ratings, additionalComments?: string, createdAt = "2026-10-10T12:00:00.000Z"): SurveyResponse => ({
  id, createdAt, consent: true, source: "poleas-rp",
  customer: { company, contactName: `Contacto ${id}` },
  satisfaction: { surveyId, module: surveyId, ratings, ...(additionalComments === undefined ? {} : { additionalComments }) }
});

const both = response("both", "ACME S.A.", "distribuidores", { "distributors.maxDeliveryDays": 4, "distributors.salesSupport": "Más stock en invierno" }, "Muy buena atención");
const onlyComment = response("only-comment", "ACME S.A.", "venta", { productQuality: 5 }, "Llegó tarde", "2026-10-05T12:00:00.000Z");
const onlyAnswer = response("only-answer", "Beta SRL", "distribuidores", { "distributors.salesSupport": "Folletos impresos" }, "");
const neither = response("neither", "Gamma", "venta", { productQuality: 4 }, "   ");

test("the detail shows both the comment and the open answer of a response", () => {
  const entry = responseFeedback(both)!;
  assert.equal(entry.comment, "Muy buena atención");
  assert.deepEqual(entry.openAnswers.map(item => [item.question.key, item.answer]), [["distributors.salesSupport", "Más stock en invierno"]]);
  assert.equal(entry.company, "ACME S.A.");
  assert.equal(entry.responseId, "both");
});

test("a response with only a comment, or only an open answer, still appears", () => {
  assert.deepEqual([responseFeedback(onlyComment)!.comment, responseFeedback(onlyComment)!.openAnswers], ["Llegó tarde", []]);
  const answer = responseFeedback(onlyAnswer)!;
  assert.equal(answer.comment, "");
  assert.deepEqual(answer.openAnswers.map(item => item.answer), ["Folletos impresos"]);
  assert.equal(responseFeedback(neither), null, "blank comment and no open answers is not feedback");
});

test("historical records and absent optional fields are read without inventing data", () => {
  const legacy = { id: "legacy", createdAt: "2026-08-01T10:00:00.000Z", consent: true, source: "poleas-rp", customer: { company: "Histórica", contactName: "Ana" }, satisfaction: { surveyId: "venta", module: "Venta", ratings: { productQuality: 4, logistics: 5 } } } as SurveyResponse;
  assert.equal(responseFeedback(legacy), null);
  assert.equal(responseFeedback({ ...legacy, satisfaction: { ...legacy.satisfaction, additionalComments: "Comentario antiguo" } })!.comment, "Comentario antiguo");
  const malformed = [
    { ...legacy, id: "no-ratings", satisfaction: { surveyId: "venta", module: "Venta", additionalComments: "Sin ratings" } },
    { ...legacy, id: "no-satisfaction", satisfaction: undefined },
    { ...legacy, id: "no-customer", customer: undefined, satisfaction: { ...legacy.satisfaction, additionalComments: "Sin cliente" } },
    { ...legacy, id: "numeric-comment", satisfaction: { ...legacy.satisfaction, additionalComments: 42 } }
  ] as unknown as SurveyResponse[];
  assert.doesNotThrow(() => feedbackByCompany(malformed));
  const groups = feedbackByCompany(malformed);
  assert.deepEqual(groups.map(group => [group.company, group.entries.map(entry => entry.responseId)]), [["Histórica", ["no-ratings"]], [noCompanyLabel, ["no-customer"]]]);
});

test("declined, blank and hidden conditional open answers are not shown as answers", () => {
  const declined = response("declined", "Oil", "oil-gas", { "oilGas.packagingSuggestion": null, "oilGas.beltUse": "no", "oilGas.beltTypeAndSize": "No aplica: oculto" });
  assert.equal(responseFeedback(declined), null);
  const shown = response("shown", "Oil", "oil-gas", { "oilGas.packagingSuggestion": "  ", "oilGas.beltUse": "yes", "oilGas.beltTypeAndSize": "B-52" });
  assert.deepEqual(responseFeedback(shown)!.openAnswers.map(item => item.question.key), ["oilGas.beltTypeAndSize"]);
});

test("general view groups every commented response by company without losing any", () => {
  const caseVariant = response("variant", " acme s.a. ", "venta", {}, "Otra visita", "2026-09-01T12:00:00.000Z");
  const groups = feedbackByCompany([both, onlyComment, onlyAnswer, neither, caseVariant]);
  assert.deepEqual(groups.map(group => group.company), ["ACME S.A.", "Beta SRL"]);
  assert.deepEqual(groups[0].entries.map(entry => entry.responseId), ["both", "only-comment", "variant"]);
  assert.deepEqual(groups[1].entries.map(entry => entry.responseId), ["only-answer"]);
});

test("company filter scopes feedback to that company only, combined with date and survey filters", () => {
  const lookalike = response("lookalike", "ACME S.A. Sucursal", "venta", {}, "No debe mezclarse");
  const all = [both, onlyComment, onlyAnswer, lookalike].map(sanitizeResponse);
  const company = feedbackByCompany(applyFilters(all, { company: "acme s.a." }));
  assert.deepEqual(company.map(group => group.company), ["ACME S.A."]);
  assert.deepEqual(company[0].entries.map(entry => entry.responseId), ["both", "only-comment"]);
  assert.deepEqual(feedbackByCompany(applyFilters(all, { company: "ACME S.A.", from: "2026-10-08" }))[0].entries.map(entry => entry.responseId), ["both"]);
  assert.deepEqual(feedbackByCompany(applyFilters(all, { company: "ACME S.A.", surveyId: "venta" }))[0].entries.map(entry => entry.responseId), ["only-comment"]);
  assert.deepEqual(feedbackByCompany(applyFilters(all, { company: "Beta SRL", surveyId: "venta" })), []);
});
