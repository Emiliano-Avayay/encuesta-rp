import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test, type TestContext } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { responseCompanies } from "../lib/response-companies";
import { applyFilters } from "../lib/response-filters";
import type { SurveyResponse } from "../lib/types";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/staff-rp/analisis" });
const globals = ["window", "document", "navigator", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"] as const;
const original = new Map(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let root: Root;
let container: HTMLDivElement;
let AnalyticsPanel: typeof import("../components/AnalyticsPanel").AnalyticsPanel;
before(() => {
  for (const key of globals) Object.defineProperty(globalThis, key, { configurable: true, value: key === "IS_REACT_ACT_ENVIRONMENT" ? true : dom.window[key as "window"], writable: true });
  // The App Router is not mounted in tests: the panel only needs the pathname and a router.replace.
  const navigation = require.resolve("next/navigation");
  require.cache[navigation] = { id: navigation, filename: navigation, loaded: true, exports: { usePathname: () => "/staff-rp/analisis", useRouter: () => ({ replace() {} }) } } as NodeModule;
  AnalyticsPanel = (require("../components/AnalyticsPanel") as typeof import("../components/AnalyticsPanel")).AnalyticsPanel;
});
beforeEach(() => {
  container = document.createElement("div"); document.body.append(container);
  root = (require("react-dom/client") as typeof import("react-dom/client")).createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
after(() => {
  dom.window.close();
  for (const key of globals) { const descriptor = original.get(key); if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
});

const general = { productQuality: 4, commercialAttention: 4, deliveryDeadlines: 4, technicalInformation: 4, claimResponse: 4 };
const record = (id: string, company: string, ratings: Record<string, unknown>, additionalComments: string | undefined, createdAt: string): SurveyResponse => ({
  id, createdAt, consent: true, source: "poleas-rp", customer: { company, contactName: `Contacto ${id}` },
  satisfaction: { surveyId: "distribuidores", module: "Distribuidores", ratings: { ...general, "distributors.maxDeliveryDays": 4, ...ratings } as SurveyResponse["satisfaction"]["ratings"], additionalComments }
});
const responses = [
  record("1", "ACME S.A.", { "distributors.salesSupport": "Acción ACME uno" }, "Comentario ACME uno", "2026-10-20T12:00:00.000Z"),
  record("2", "ACME S.A.", {}, "Comentario ACME dos", "2026-10-10T12:00:00.000Z"),
  record("3", "Beta SRL", { "distributors.salesSupport": "Acción Beta" }, undefined, "2026-10-05T12:00:00.000Z"),
  record("4", "ACME S.A. Sucursal", {}, "Comentario sucursal", "2026-10-01T12:00:00.000Z")
];

function setupFetch(t: TestContext) {
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(url);
    const parsed = new URL(url, "http://localhost");
    const filters = Object.fromEntries(parsed.searchParams.entries());
    if (parsed.pathname === "/api/response-companies") return Response.json({ companies: responseCompanies(responses, filters.surveyId) });
    return Response.json({ responses: applyFilters(responses, filters) });
  });
  return urls;
}
async function render() { await act(async () => root.render(createElement(AnalyticsPanel))); await flush(); }
async function flush() { for (let i = 0; i < 5; i++) await act(async () => { await new Promise((resolve) => dom.window.setTimeout(resolve, 0)); }); }
const section = () => container.querySelector<HTMLElement>(".feedback-analysis")!;
const dialog = () => container.querySelector<HTMLElement>('[role="dialog"]');
function companyButton(scope: HTMLElement, name: string) {
  const found = [...scope.querySelectorAll<HTMLButtonElement>("button.feedback-company")].find((b) => b.firstChild?.textContent === name);
  assert.ok(found, `No se encontró la empresa ${name}`); return found;
}
async function click(element: Element) { await act(async () => { element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); }
async function select(element: HTMLSelectElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  await flush();
}

test("vista general: solo nombres de empresa clickeables, sin textos completos", async (t) => {
  setupFetch(t); await render();
  const names = [...section().querySelectorAll("button.feedback-company")].map((b) => b.firstChild?.textContent);
  assert.deepEqual(names, ["ACME S.A.", "ACME S.A. Sucursal", "Beta SRL"]);
  assert.equal(companyButton(section(), "ACME S.A.").querySelector(".feedback-count")?.textContent, "2");
  assert.ok(!section().textContent?.includes("Comentario ACME uno"));
  assert.ok(!section().textContent?.includes("Acción Beta"));
  assert.equal(dialog(), null);
});

test("al hacer clic se ven todas las respuestas de la empresa con comentario y acción, sin mezclar otras", async (t) => {
  setupFetch(t); await render();
  const trigger = companyButton(section(), "ACME S.A.");
  trigger.focus(); await click(trigger);
  const opened = dialog()!;
  assert.equal(opened.getAttribute("aria-modal"), "true");
  assert.equal(opened.querySelector("h2")?.textContent, "ACME S.A.");
  const text = opened.textContent!;
  for (const expected of ["Comentario ACME uno", "Acción ACME uno", "Comentario ACME dos", "2 respuestas"]) assert.ok(text.includes(expected), expected);
  assert.ok(text.includes("¿Qué podríamos mejorar para apoyarlo mejor en la venta a sus clientes?"), "the open answer keeps its question");
  assert.ok(!text.includes("Comentario sucursal") && !text.includes("Acción Beta"));
  assert.equal(opened.querySelectorAll(".feedback-entry").length, 2);
  await act(async () => { opened.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  assert.equal(dialog(), null);
  assert.equal(document.activeElement, trigger, "focus returns to the company name");
});

test("una empresa con solo acción también se puede consultar", async (t) => {
  setupFetch(t); await render();
  await click(companyButton(section(), "Beta SRL"));
  assert.ok(dialog()!.textContent!.includes("Acción Beta"));
  assert.ok(!dialog()!.textContent!.includes("Comentario"), "no empty comment block");
});

test("filtrar por empresa muestra sus comentarios y acciones directamente, respetando los demás filtros", async (t) => {
  const urls = setupFetch(t); await render();
  const company = container.querySelector<HTMLSelectElement>('select[aria-label="Razón social"]')!;
  await select(company, "ACME S.A.");
  assert.ok(urls.some((url) => url.startsWith("/api/responses?") && new URL(url, "http://localhost").searchParams.get("company") === "ACME S.A."));
  const text = section().textContent!;
  for (const expected of ["Comentario ACME uno", "Acción ACME uno", "Comentario ACME dos"]) assert.ok(text.includes(expected), expected);
  assert.ok(!text.includes("Comentario sucursal"), "a company containing the name is not mixed in");
  assert.equal(section().querySelectorAll("button.feedback-company").length, 0);
  assert.ok(container.textContent!.includes("Respuestas totales2"));

  const from = container.querySelector<HTMLInputElement>('input[type="date"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(from, "2026-10-15");
    from.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  await flush();
  assert.ok(section().textContent!.includes("Comentario ACME uno"));
  assert.ok(!section().textContent!.includes("Comentario ACME dos"), "the date filter still applies");
});

test("las preguntas abiertas por segmento listan empresas y las numéricas se informan en días", async (t) => {
  setupFetch(t); await render();
  await select(container.querySelector<HTMLSelectElement>("section.admin-filters select")!, "distribuidores");
  const question = [...container.querySelectorAll(".question-analysis > div")].find((row) => row.textContent?.includes("¿Qué podríamos mejorar"))!;
  assert.deepEqual([...question.querySelectorAll("button.feedback-company")].map((b) => b.firstChild?.textContent), ["ACME S.A.", "Beta SRL"]);
  assert.ok(!question.textContent!.includes("Acción ACME uno"));
  const days = [...container.querySelectorAll(".question-analysis > div")].find((row) => row.textContent?.includes("plazo de entrega en días"))!;
  assert.ok(days.textContent!.includes("Promedio: 4.00 días"));
  assert.ok(!days.textContent!.includes("Satisfecho"));
});
