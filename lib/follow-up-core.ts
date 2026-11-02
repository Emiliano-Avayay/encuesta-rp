// Lógica pura del módulo Seguimiento: sin acceso a base ni a Next, para poder probarla
// y reutilizarla desde el script de importación (Node ejecuta este archivo directamente).

export const followUpSegments = [
  { id: "venta", name: "Venta" },
  { id: "distribuidores", name: "Distribuidores" },
  { id: "agroindustria", name: "Agroindustria" },
  { id: "oil-gas", name: "Oil & Gas" },
  { id: "servicios-industriales", name: "Servicios Industriales" }
] as const;
export type FollowUpSegment = (typeof followUpSegments)[number]["id"];

export const responseStatuses = [
  { id: "responded", name: "Respondió" },
  { id: "not_responded", name: "No respondió" },
  { id: "undefined", name: "Sin definir" }
] as const;
export type ResponseStatus = (typeof responseStatuses)[number]["id"];

export const whatsappPeople = [
  { id: "mariaJose", name: "María José" },
  { id: "sergio", name: "Sergio" },
  { id: "jose", name: "José" }
] as const;
export type WhatsappPerson = (typeof whatsappPeople)[number]["id"];

export type FollowUpCompany = {
  id: string;
  name: string;
  segment: FollowUpSegment;
  contactName: string | null;
  email: string | null;
  /** 11 dígitos sin guiones, o null si todavía no se cargó. */
  cuit: string | null;
  responseStatus: ResponseStatus;
  whatsapp: Record<WhatsappPerson, boolean>;
  notes: string | null;
  sourceRow: string | null;
  linkedResponseId: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type CompanyInput = {
  name: string;
  segment: FollowUpSegment;
  contactName: string | null;
  email: string | null;
  cuit: string | null;
  responseStatus: ResponseStatus;
  whatsapp: Record<WhatsappPerson, boolean>;
  notes: string | null;
};

export const segmentName = (id: string) => followUpSegments.find((s) => s.id === id)?.name ?? id;
export const isSegment = (value: unknown): value is FollowUpSegment => followUpSegments.some((s) => s.id === value);
export const isStatus = (value: unknown): value is ResponseStatus => responseStatuses.some((s) => s.id === value);

/** Clave de comparación: sin acentos, minúsculas y espacios/puntuación colapsados. */
export function nameKey(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const EMAIL = /^[^\s@<>()',;]+@[^\s@<>()',;]+\.[^\s@<>()',;]+$/;
export const isValidEmail = (value: string) => EMAIL.test(value.trim());

// ───────────────────────── CUIT ─────────────────────────

const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Quita todo lo que no sea dígito: admite "20-12345678-6", "20 12345678 6" o "20123456786". */
export const cuitDigits = (value: string) => value.replace(/\D/g, "");

/** Formato visible XX-XXXXXXXX-X; también sirve para dar formato mientras se escribe. */
export function formatCuit(value: string) {
  const d = cuitDigits(value).slice(0, 11);
  return d.length <= 2 ? d : d.length <= 10 ? `${d.slice(0, 2)}-${d.slice(2)}` : `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/** Algoritmo oficial módulo 11: 11 dígitos y verificador = 11 - (suma ponderada mod 11); 11 → 0, 10 → inválido. */
export function isValidCuit(value: string) {
  if (!/^\d{11}$/.test(value)) return false;
  const sum = CUIT_WEIGHTS.reduce((acc, weight, i) => acc + weight * Number(value[i]), 0);
  const check = 11 - (sum % 11);
  return check !== 10 && (check === 11 ? 0 : check) === Number(value[10]);
}

export const CUIT_ERROR = "El CUIT no es válido. Revisá que tenga 11 dígitos y el formato XX-XXXXXXXX-X.";

/** Normaliza una entrada de formulario o API. Vacío → null (sin CUIT); inválido → error. */
export function parseCuit(raw: unknown): { value: string | null; error?: string } {
  if (raw === undefined || raw === null) return { value: null };
  if (typeof raw !== "string") return { value: null, error: CUIT_ERROR };
  if (!raw.trim()) return { value: null };
  if (/[^\d\s.-]/.test(raw)) return { value: null, error: CUIT_ERROR };
  const digits = cuitDigits(raw);
  return isValidCuit(digits) ? { value: digits } : { value: null, error: CUIT_ERROR };
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

const emptyWhatsapp = (): Record<WhatsappPerson, boolean> => ({ mariaJose: false, sergio: false, jose: false });

/** Valida el cuerpo de alta o edición. Con `partial` solo se validan los campos presentes. */
export function validateCompanyInput(raw: any, partial = false) {
  const errors: Record<string, string> = {};
  const value: Partial<CompanyInput> = {};
  const has = (key: string) => raw && Object.prototype.hasOwnProperty.call(raw, key);

  if (!partial || has("name")) {
    const name = clean(raw?.name, 160);
    if (!name) errors.name = "La empresa es obligatoria."; else value.name = name;
  }
  if (!partial || has("segment")) {
    if (!isSegment(raw?.segment)) errors.segment = "Seleccioná un segmento válido."; else value.segment = raw.segment;
  }
  if (!partial || has("email")) {
    const email = clean(raw?.email, 180);
    if (email && !isValidEmail(email)) errors.email = "El correo electrónico no es válido."; else value.email = email || null;
  }
  // Con `partial` el CUIT solo cambia si viene explícito en el cuerpo (cadena vacía o null lo borra).
  if (!partial || has("cuit")) {
    const cuit = parseCuit(raw?.cuit);
    if (cuit.error) errors.cuit = cuit.error; else value.cuit = cuit.value;
  }
  if (!partial || has("contactName")) value.contactName = clean(raw?.contactName, 160) || null;
  if (!partial || has("notes")) value.notes = clean(raw?.notes, 1000) || null;
  if (!partial || has("responseStatus")) {
    const status = raw?.responseStatus ?? "undefined";
    if (!isStatus(status)) errors.responseStatus = "Estado de respuesta inválido."; else value.responseStatus = status;
  }
  if (!partial || has("whatsapp")) {
    const wa = emptyWhatsapp();
    for (const person of whatsappPeople) wa[person.id] = raw?.whatsapp?.[person.id] === true;
    value.whatsapp = wa;
  }
  return { valid: Object.keys(errors).length === 0, errors, value };
}

export type FollowUpFilters = { search?: string; segment?: string; status?: string; whatsapp?: string };

/** La búsqueda se trata como CUIT solo si parece uno (dígitos y separadores, 3+ dígitos); así "3M" no coincide con cualquier CUIT. */
function matchesCuit(cuit: string | null, term: string) {
  if (!cuit || !/^[\d\s.-]+$/.test(term)) return false;
  const digits = cuitDigits(term);
  return digits.length >= 3 && cuit.includes(digits);
}

export function filterCompanies(companies: FollowUpCompany[], filters: FollowUpFilters) {
  const term = fold((filters.search ?? "").trim());
  return companies.filter((c) => {
    if (filters.segment && filters.segment !== "all" && c.segment !== filters.segment) return false;
    if (filters.status && filters.status !== "all" && c.responseStatus !== filters.status) return false;
    if (filters.whatsapp && filters.whatsapp !== "all") {
      // "none" = sin ninguna marca; el resto filtra por quién hizo el seguimiento.
      if (filters.whatsapp === "none" ? whatsappPeople.some((p) => c.whatsapp[p.id]) : !c.whatsapp[filters.whatsapp as WhatsappPerson]) return false;
    }
    if (term && !fold(`${c.name} ${c.email ?? ""} ${c.contactName ?? ""}`).includes(term) && !matchesCuit(c.cuit, term)) return false;
    return true;
  });
}

export type FollowUpStats = { total: number; responded: number; notResponded: number; undefinedCount: number; pending: number; rate: number };

/** El denominador son las empresas registradas; los porcentajes nunca se almacenan. */
export function computeStats(companies: Pick<FollowUpCompany, "responseStatus">[]): FollowUpStats {
  const total = companies.length;
  const responded = companies.filter((c) => c.responseStatus === "responded").length;
  const notResponded = companies.filter((c) => c.responseStatus === "not_responded").length;
  const undefinedCount = total - responded - notResponded;
  return { total, responded, notResponded, undefinedCount, pending: total - responded, rate: total ? responded / total : 0 };
}

export function statsBySegment(companies: FollowUpCompany[]) {
  return followUpSegments.map((s) => ({ ...s, ...computeStats(companies.filter((c) => c.segment === s.id)) }));
}

// ───────────────────────── Importación de la planilla ─────────────────────────

/** Parser CSV mínimo (RFC 4180): comillas, comas y saltos de línea dentro de celdas. */
export function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export type ImportRecord = CompanyInput & { sourceRow: string; key: string };
export type ImportIssue = { row: string; company: string; kind: "email_descartado" | "email_con_texto" | "sin_estado" | "duplicado_en_planilla"; detail: string };

function segmentFromHeader(label: string): FollowUpSegment | null {
  const key = nameKey(label.replace(/^\s*\d+\s*[.)]/, ""));
  const map: Record<string, FollowUpSegment> = { venta: "venta", distribuidores: "distribuidores", agroindustria: "agroindustria", "oil gas": "oil-gas", "servicios industriales": "servicios-industriales" };
  return map[key] ?? null;
}

/**
 * Convierte las filas de la planilla en registros. Las celdas de correo que no son
 * direcciones (fechas, números) se descartan y se informan; nunca se interpretan.
 */
export function planSheetImport(rows: string[][]) {
  const records: ImportRecord[] = []; const issues: ImportIssue[] = [];
  let segment: FollowUpSegment | null = null; const seen = new Set<string>();
  rows.forEach((cells, index) => {
    const at = `fila ${index + 1}`; const [a = "", b = "", c = "", d = "", e = "", f = "", g = "", h = ""] = cells.map((x) => x.trim());
    if (a === "% Respuesta") { segment = segmentFromHeader(b); return; }
    if (!segment || !b || b.toUpperCase() === "EMPRESA") return;
    const name = clean(b, 160); const key = `${segment}:${nameKey(name)}`;
    if (seen.has(key)) { issues.push({ row: at, company: name, kind: "duplicado_en_planilla", detail: "Repetida en la misma agrupación; se ignora." }); return; }
    seen.add(key);

    let email: string | null = null; const notes: string[] = [];
    if (c) {
      if (isValidEmail(c)) email = c;
      else if (c.includes("@")) { notes.push(`Correo original: ${c}`); issues.push({ row: at, company: name, kind: "email_con_texto", detail: `Contiene texto además del correo; revisar a mano: ${c}` }); }
      else issues.push({ row: at, company: name, kind: "email_descartado", detail: `Valor no válido como correo: "${c}"` });
    }
    if (h) notes.push(h);
    const status: ResponseStatus = a.toUpperCase() === "TRUE" ? "responded" : a.toUpperCase() === "FALSE" ? "not_responded" : "undefined";
    if (status === "undefined") issues.push({ row: at, company: name, kind: "sin_estado", detail: "Sin valor de respuesta en la planilla; queda Sin definir." });
    const on = (v: string) => v.toUpperCase() === "TRUE";
    records.push({
      name, segment, contactName: clean(d, 160) || null, email, cuit: null, responseStatus: status,
      whatsapp: { mariaJose: on(e), sergio: on(f), jose: on(g) },
      notes: notes.join(" · ").slice(0, 1000) || null, sourceRow: at, key
    });
  });
  return { records, issues };
}
