import assert from "node:assert/strict";
import { test } from "node:test";
import { applyFilters, sanitizeResponse } from "../lib/response-filters";
import type { SurveyResponse } from "../lib/types";

const make = (id: string, overrides: Record<string, unknown> = {}): SurveyResponse => ({
  id, createdAt: "2026-09-28T11:50:24.640Z", consent: true, source: "poleas-rp",
  customer: { company: "TRANSCADEN", contactName: "Ana" },
  satisfaction: { surveyId: "venta", module: "Venta", ratings: { productQuality: 4 } },
  ...overrides
} as SurveyResponse);

// Regression: filtering by company threw TypeError when any stored record had no company,
// which the API reported as 401 and broke the whole admin screen.
const records = [
  make("ok"),
  make("null-company", { customer: { company: null, contactName: "X" } }),
  make("missing-company", { customer: { contactName: "Y" } }),
  make("numeric-company", { customer: { company: 123, contactName: "Z" } }),
  make("null-customer", { customer: null }),
  make("bad-date", { createdAt: undefined }),
  make("no-ratings", { satisfaction: { surveyId: "venta", module: "Venta" } }),
  make("other", { customer: { company: "OTRA S.A.", contactName: "Q" } })
];

test("company filter ignores malformed records instead of throwing", () => {
  const result = applyFilters(records.map(sanitizeResponse), { company: "TRANSCADEN" });
  assert.ok(result.some((r) => r.id === "ok"));
  assert.ok(!result.some((r) => r.id === "other"));
});

test("filters do not throw on raw (unsanitized) malformed records", () => {
  for (const filters of [{ company: "TRANSCADEN" }, { search: "ana" }, { from: "2026-01-01", to: "2026-12-31" }, { surveyId: "venta", question: "productQuality", rating: "4" }]) {
    assert.doesNotThrow(() => applyFilters(records, filters));
  }
});

test("sanitizeResponse yields renderable values", () => {
  for (const r of records.map(sanitizeResponse)) {
    assert.equal(typeof r.customer.company, "string");
    assert.ok(r.createdAt === "" || !Number.isNaN(Date.parse(r.createdAt)));
    assert.equal(typeof r.satisfaction.ratings, "object");
  }
});

test("valid results are unchanged by sanitizing", () => {
  const [ok] = [make("ok")];
  assert.deepEqual(sanitizeResponse(ok), ok);
});

// ---- Mixed valid + malformed data: nothing valid may be dropped, nothing stored may change. ----
const valid = [
  make("v1", { customer: { company: "TRANSCADEN S.A.", contactName: "Ana", email: "a@x.com" }, createdAt: "2026-09-10T10:00:00.000Z" }),
  make("v2", { customer: { company: "otra empresa", contactName: "Beto" }, createdAt: "2026-09-20T10:00:00.000Z", satisfaction: { surveyId: "venta", module: "Venta", ratings: { productQuality: 5, claimResponse: null }, additionalComments: "ok" } })
];
const mixed = [...valid, ...records.filter((r) => r.id !== "ok" && r.id !== "other")];
const ids = (list: SurveyResponse[]) => list.map((r) => r.id).sort();

test("no filter: every record (valid and malformed) is kept", () => {
  assert.equal(applyFilters(mixed.map(sanitizeResponse), {}).length, mixed.length);
});

test("any company filter keeps every valid match, case-insensitive, and never throws", () => {
  const all = mixed.map(sanitizeResponse);
  // bad-date / no-ratings belong to TRANSCADEN too: a defect in another field must not hide them.
  assert.deepEqual(ids(applyFilters(all, { company: "transcaden" })), ["bad-date", "no-ratings", "v1"]);
  assert.deepEqual(ids(applyFilters(all, { company: "OTRA EMPRESA" })), ["v2"]);
  assert.deepEqual(ids(applyFilters(all, { company: "123" })), ["numeric-company"]);
  assert.deepEqual(applyFilters(all, { company: "no existe" }), []);
});

test("company filter combined with date, survey and search filters", () => {
  const all = mixed.map(sanitizeResponse);
  assert.deepEqual(ids(applyFilters(all, { company: "transcaden", from: "2026-09-01", to: "2026-09-15", surveyId: "venta", search: "ana" })), ["v1"]);
  assert.deepEqual(ids(applyFilters(all, { company: "transcaden", from: "2026-09-15" })), ["no-ratings"]);
});

test("records without a usable date are excluded only when a date range is requested", () => {
  const all = mixed.map(sanitizeResponse);
  assert.ok(applyFilters(all, {}).some((r) => r.id === "bad-date"));
  assert.ok(!applyFilters(all, { from: "2000-01-01" }).some((r) => r.id === "bad-date"));
  assert.ok(!applyFilters(all, { to: "2100-01-01" }).some((r) => r.id === "bad-date"));
});

test("sanitizing never alters valid data, ratings (incl. null) or the input objects", () => {
  const before = structuredClone(mixed);
  const out = mixed.map(sanitizeResponse);
  assert.deepEqual(mixed, before, "input must not be mutated");
  for (const id of ["v1", "v2"]) assert.deepEqual(out.find((r) => r.id === id), before.find((r) => r.id === id));
  assert.strictEqual(out.find((r) => r.id === "v2")!.satisfaction.ratings.claimResponse, null);
  assert.ok(!("claimResponse" in out.find((r) => r.id === "v1")!.satisfaction.ratings), "unanswered stays undefined/absent");
});

test("an unusable date is not replaced by a made-up one", () => {
  assert.equal(sanitizeResponse(make("d", { createdAt: "basura" })).createdAt, "");
});
