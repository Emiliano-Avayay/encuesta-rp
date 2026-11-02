import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test, type TestContext } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { FollowUpPanel } from "../components/FollowUpPanel";
import { companyFixture } from "./follow-up-fixtures";
import type { FollowUpCompany } from "../lib/follow-up-core";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
const globals = ["window", "document", "navigator", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"] as const;
const original = new Map(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let root: Root;
let container: HTMLDivElement;
before(() => {
  for (const key of globals) Object.defineProperty(globalThis, key, { configurable: true, value: key === "IS_REACT_ACT_ENVIRONMENT" ? true : dom.window[key as "window"], writable: true });
});
beforeEach(() => {
  container = document.createElement("div"); document.body.append(container);
  // Importar después de instalar el DOM para que React active sus eventos de inputs.
  root = (require("react-dom/client") as typeof import("react-dom/client")).createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
after(() => {
  dom.window.close();
  for (const key of globals) { const descriptor = original.get(key); if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
});

function button(text: string) {
  const found = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
  assert.ok(found, `No se encontró el botón ${text}`); return found;
}
async function click(element: Element) { await act(async () => { element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); }
async function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype = element.tagName === "INPUT" ? dom.window.HTMLInputElement.prototype : dom.window.HTMLSelectElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new dom.window.Event(element.tagName === "INPUT" ? "input" : "change", { bubbles: true }));
  });
}
function setupFetch(t: TestContext, companies: FollowUpCompany[], remove: () => Promise<Response> = async () => new Response(null, { status: 204 })) {
  const calls: { url: string; method: string; body?: any }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"; calls.push({ url, method, body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
    if (method === "DELETE") return remove();
    if (method === "PATCH" || method === "POST") return Response.json({ company: { ...companies[0], ...JSON.parse(String(init?.body)) } });
    return Response.json(url === "/api/seguimiento" ? { companies } : { history: [], suggestions: [] });
  });
  return calls;
}
async function render() { await act(async () => root.render(createElement(FollowUpPanel))); }
async function edit() { await click(container.querySelector('[aria-label="Editar Empresa exacta S.A."]')!); }

test("el alta no muestra Eliminar empresa", async (t) => {
  setupFetch(t, []); await render(); await click(button("Nueva empresa"));
  assert.ok(container.querySelector('[aria-label="Nueva empresa"]'));
  assert.ok(!container.textContent?.includes("Eliminar empresa"));
});

test("confirmación muestra el nombre exacto guardado y cancelar conserva empresa y borrador", async (t) => {
  const calls = setupFetch(t, [companyFixture()]); await render(); await edit();
  const name = container.querySelector('.fu-dialog input') as HTMLInputElement;
  await change(name, "Nombre sin guardar");
  await click(button("Eliminar empresa"));
  const confirm = container.querySelector('[role="alertdialog"]')!;
  assert.equal(confirm.querySelector("strong")?.textContent, companyFixture().name);
  assert.equal(document.activeElement, button("Cancelar"));
  await click(button("Cancelar"));
  assert.equal((container.querySelector('.fu-dialog input') as HTMLInputElement).value, "Nombre sin guardar");
  assert.equal(document.activeElement, button("Eliminar empresa"));
  assert.ok(container.querySelector('[aria-label="Editar empresa"]'));
  assert.equal(calls.filter((c) => c.method === "DELETE").length, 0);
  assert.match(container.querySelector('.fu-count')!.textContent!, /1 de 1/);
  await click(button("Cancelar"));
  assert.equal(container.querySelector('[role="dialog"]'), null);
});

test("eliminar cierra modal, notifica y recalcula indicadores globales y por segmento conservando filtros", async (t) => {
  const companies = [
    companyFixture(),
    companyFixture({ id: "2", name: "Empresa pendiente", responseStatus: "not_responded" }),
    companyFixture({ id: "3", name: "Empresa indefinida", responseStatus: "undefined" }),
    companyFixture({ id: "4", name: "Fuera de búsqueda", segment: "oil-gas" })
  ];
  const calls = setupFetch(t, companies); await render();
  const search = container.querySelector('.fu-search input') as HTMLInputElement;
  const segment = container.querySelector('[aria-label="Segmento"]') as HTMLSelectElement;
  await change(search, "Empresa"); await change(segment, "venta");
  assert.match(container.querySelector('.fu-count')!.textContent!, /3 de 4/);
  await edit(); await click(button("Eliminar empresa"));
  assert.equal(calls.filter((c) => c.method === "DELETE").length, 0);
  await click(button("Eliminar definitivamente"));
  assert.equal(container.querySelector('[role="alertdialog"]'), null);
  assert.equal(container.querySelector('[aria-label="Editar Empresa exacta S.A."]'), null);
  assert.match(container.querySelector('[role="status"]')!.textContent!, /Se eliminó.*Empresa exacta S.A./);
  assert.match(container.querySelector('.fu-count')!.textContent!, /2 de 3/);
  assert.deepEqual([...container.querySelectorAll('.fu-kpi strong')].map((e) => e.textContent), ["3", "1", "2", "33,3%"]);
  assert.match(container.querySelector('.fu-kpi em')!.textContent!, /1 no respondieron · 1 sin definir/);
  const segments = [...container.querySelectorAll('.fu-segment')];
  assert.match(segments[0].textContent!, /0,0%.*0 de 2 respondieron/);
  assert.match(segments[3].textContent!, /100,0%.*1 de 1 respondieron/);
  assert.equal(search.value, "Empresa"); assert.equal(segment.value, "venta");
  assert.equal(calls.filter((c) => c.method === "DELETE").length, 1);
  assert.equal(calls.filter((c) => c.url === "/api/seguimiento").length, 1);
});

test("solicitud pendiente bloquea doble envío y cancelación; error PostgreSQL permite reintentar", async (t) => {
  let resolve!: (response: Response) => void;
  const pending = new Promise<Response>((done) => { resolve = done; });
  const calls = setupFetch(t, [companyFixture()], () => pending);
  await render(); await edit(); await click(button("Eliminar empresa"));
  const remove = button("Eliminar definitivamente");
  await act(async () => { remove.click(); remove.click(); });
  assert.equal(calls.filter((c) => c.method === "DELETE").length, 1);
  assert.ok(remove.disabled); assert.ok(button("Cancelar").disabled);
  await act(async () => { container.querySelector('[role="alertdialog"]')!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  assert.ok(container.querySelector('[role="alertdialog"]'));
  await act(async () => resolve(Response.json({ error: "No se pudo procesar la solicitud." }, { status: 500 })));
  assert.match(container.querySelector('[role="alert"]')!.textContent!, /No se pudo procesar/);
  assert.ok(!button("Eliminar definitivamente").disabled); assert.ok(!button("Cancelar").disabled);
  assert.match(container.querySelector('.fu-count')!.textContent!, /1 de 1/);
  await click(button("Cancelar"));
  assert.ok(container.querySelector('[aria-label="Editar empresa"]'));
});

test("eliminar la última empresa conserva todos los filtros y deja indicadores en cero", async (t) => {
  setupFetch(t, [companyFixture()]); await render();
  await change(container.querySelector('.fu-search input') as HTMLInputElement, "Empresa");
  const filters = { Segmento: "venta", "Estado de respuesta": "responded", "Responsable de WhatsApp": "mariaJose" };
  for (const [label, value] of Object.entries(filters)) await change(container.querySelector(`[aria-label="${label}"]`) as HTMLSelectElement, value);
  await edit(); await click(button("Eliminar empresa")); await click(button("Eliminar definitivamente"));
  assert.match(container.querySelector('.fu-count')!.textContent!, /0 de 0/);
  assert.deepEqual([...container.querySelectorAll('.fu-kpi strong')].map((e) => e.textContent), ["0", "0", "0", "0,0%"]);
  for (const [label, value] of Object.entries(filters)) assert.equal((container.querySelector(`[aria-label="${label}"]`) as HTMLSelectElement).value, value);
  assert.equal((container.querySelector('.fu-search input') as HTMLInputElement).value, "Empresa");
  assert.ok([...container.querySelectorAll('.fu-rate')].every((e) => e.textContent === "0,0%"));
});

test("error de red conserva la empresa y muestra un mensaje claro", async (t) => {
  setupFetch(t, [companyFixture()], async () => { throw new TypeError("Network error"); });
  await render(); await edit(); await click(button("Eliminar empresa")); await click(button("Eliminar definitivamente"));
  assert.match(container.querySelector('[role="alert"]')!.textContent!, /Revisá la conexión/);
  assert.match(container.querySelector('.fu-count')!.textContent!, /1 de 1/);
  assert.ok(!button("Eliminar definitivamente").disabled);
});

const cuitInput = () => [...container.querySelectorAll<HTMLInputElement>(".fu-dialog input")].find((i) => i.placeholder === "XX-XXXXXXXX-X")!;

test("Nueva empresa: campo CUIT (opcional) da formato mientras se escribe y se guarda sin CUIT si queda vacío", async (t) => {
  const calls = setupFetch(t, []); await render(); await click(button("Nueva empresa"));
  assert.ok([...container.querySelectorAll(".fu-dialog label")].some((l) => l.textContent?.startsWith("CUIT (opcional)")));
  await change(cuitInput(), "20123456786");
  assert.equal(cuitInput().value, "20-12345678-6");
  await change(container.querySelector(".fu-dialog input") as HTMLInputElement, "Empresa nueva");
  await change(cuitInput(), "");
  await click(button("Guardar"));
  assert.equal(calls.find((c) => c.method === "POST")?.body.cuit, "");
});

test("CUIT inválido muestra el mensaje y el servidor lo rechaza", async (t) => {
  setupFetch(t, []); await render(); await click(button("Nueva empresa"));
  await change(cuitInput(), "20-12345678-0");
  await act(async () => { cuitInput().dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true })); });
  assert.match(container.querySelector(".fu-dialog .field-error")?.textContent ?? "", /CUIT no es válido/);
});

test("Editar empresa: recupera el CUIT formateado, permite modificarlo y borrarlo", async (t) => {
  const calls = setupFetch(t, [companyFixture({ cuit: "20123456786" })]); await render(); await edit();
  assert.equal(cuitInput().value, "20-12345678-6");
  await change(cuitInput(), "30-71234567-1");
  await click(button("Guardar"));
  assert.equal(calls.filter((c) => c.method === "PATCH").at(-1)?.body.cuit, "30-71234567-1");
  await edit(); await change(cuitInput(), ""); await click(button("Guardar"));
  assert.equal(calls.filter((c) => c.method === "PATCH").at(-1)?.body.cuit, "");
});

test("Editar empresa sin CUIT guardado muestra el campo vacío y permite cargarlo", async (t) => {
  setupFetch(t, [companyFixture({ cuit: null })]); await render(); await edit();
  assert.equal(cuitInput().value, "");
});

test("el buscador encuentra empresas por CUIT con y sin guiones", async (t) => {
  setupFetch(t, [companyFixture({ cuit: "20123456786" }), companyFixture({ id: "2", name: "Otra SA", cuit: null })]); await render();
  const search = container.querySelector(".fu-search input") as HTMLInputElement;
  for (const term of ["20-12345678-6", "20123456786"]) {
    await change(search, term);
    assert.match(container.querySelector(".fu-count")!.textContent!, /1 de 2/); assert.ok(container.querySelector('[aria-label="Editar Empresa exacta S.A."]'));
  }
  assert.equal(container.querySelector("th")?.textContent, "Empresa");
  assert.ok(![...container.querySelectorAll("th")].some((th) => /cuit/i.test(th.textContent ?? "")));
});
