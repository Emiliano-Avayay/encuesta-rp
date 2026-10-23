import { Pool } from "pg";
import { listResponses } from "@/lib/store";
import {
  nameKey, validateCompanyInput, whatsappPeople,
  type CompanyInput, type FollowUpCompany, type WhatsappPerson
} from "@/lib/follow-up-core";

export class FollowUpError extends Error { constructor(message: string, public status = 400, public fields?: Record<string, string>) { super(message); } }

// Sin DATABASE_URL el módulo funciona en memoria (demo); nunca escribe archivos locales.
const globalStore = globalThis as typeof globalThis & { __rpFollowUp?: FollowUpCompany[]; __rpFollowUpPool?: Pool };
const pgEnabled = () => Boolean(process.env.DATABASE_URL || process.env.PGHOST);
function pool() { return globalStore.__rpFollowUpPool ||= new Pool({ connectionString: process.env.DATABASE_URL || undefined, ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : undefined }); }
const demo = () => {
  // En producción nunca se guarda solo en memoria: sin PostgreSQL el módulo falla de forma explícita.
  if (process.env.NODE_ENV === "production") throw new FollowUpError("PostgreSQL no está configurado: el seguimiento no puede guardar información.", 503);
  return globalStore.__rpFollowUp ||= [];
};
const iso = (value: unknown) => value instanceof Date ? value.toISOString() : String(value);

function fromRow(row: any): FollowUpCompany {
  return {
    id: row.id, name: row.name, segment: row.segment, contactName: row.contact_name, email: row.email,
    responseStatus: row.response_status,
    whatsapp: { mariaJose: row.wa_maria_jose, sergio: row.wa_sergio, jose: row.wa_jose },
    notes: row.notes, sourceRow: row.source_row,
    linkedResponseId: row.linked_response_id == null ? null : String(row.linked_response_id),
    createdAt: iso(row.created_at), createdBy: row.created_by, updatedAt: iso(row.updated_at), updatedBy: row.updated_by
  };
}

const sortByName = (a: FollowUpCompany, b: FollowUpCompany) => a.name.localeCompare(b.name, "es");

export async function listFollowUp() {
  if (pgEnabled()) return (await pool().query("select * from follow_up_companies")).rows.map(fromRow).sort(sortByName);
  return [...demo()].sort(sortByName);
}

export async function getFollowUp(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (pgEnabled()) { const { rows } = await pool().query("select * from follow_up_companies where id = $1", [id]); return rows[0] ? fromRow(rows[0]) : null; }
  return demo().find((c) => c.id === id) ?? null;
}

const duplicate = () => new FollowUpError("Ya existe una empresa con ese nombre en el segmento.", 409, { name: "Ya existe en este segmento." });
const isUnique = (error: any) => error?.code === "23505";

/** Campos que cambiaron, con valor anterior y nuevo, para la bitácora. */
function diff(before: FollowUpCompany, after: Partial<CompanyInput>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of ["name", "segment", "contactName", "email", "responseStatus", "notes"] as const) {
    if (key in after && after[key] !== before[key]) changes[key] = { from: before[key], to: after[key] };
  }
  if (after.whatsapp) for (const p of whatsappPeople) if (after.whatsapp[p.id] !== before.whatsapp[p.id]) changes[`whatsapp.${p.id}`] = { from: before.whatsapp[p.id], to: after.whatsapp[p.id] };
  return changes;
}

export async function createFollowUp(body: unknown, actor: string) {
  const { valid, errors, value } = validateCompanyInput(body);
  if (!valid) throw new FollowUpError("Revisá los datos ingresados.", 400, errors);
  const input = value as CompanyInput; const id = crypto.randomUUID(); const now = new Date().toISOString();
  const company: FollowUpCompany = { id, ...input, sourceRow: null, linkedResponseId: null, createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor };
  if (pgEnabled()) {
    const client = await pool().connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into follow_up_companies (id, name, name_key, segment, contact_name, email, response_status, wa_maria_jose, wa_sergio, wa_jose, notes, created_by, updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
        [id, input.name, nameKey(input.name), input.segment, input.contactName, input.email, input.responseStatus, input.whatsapp.mariaJose, input.whatsapp.sergio, input.whatsapp.jose, input.notes, actor]
      );
      await client.query("insert into follow_up_audit (company_id, action, changes, actor) values ($1,'create',$2,$3)", [id, JSON.stringify(input), actor]);
      await client.query("commit");
    } catch (error) { await client.query("rollback").catch(() => undefined); if (isUnique(error)) throw duplicate(); throw error; } finally { client.release(); }
    return company;
  }
  const key = nameKey(input.name);
  if (demo().some((c) => c.segment === input.segment && nameKey(c.name) === key)) throw duplicate();
  demo().push(company);
  return company;
}

export async function updateFollowUp(id: string, body: any, actor: string) {
  const { valid, errors, value } = validateCompanyInput(body, true);
  if (!valid) throw new FollowUpError("Revisá los datos ingresados.", 400, errors);
  const linked = body && Object.prototype.hasOwnProperty.call(body, "linkedResponseId") ? body.linkedResponseId : undefined;
  if (linked !== undefined && linked !== null && !/^\d+$/.test(String(linked))) throw new FollowUpError("Respuesta vinculada inválida.");
  const now = new Date().toISOString();

  if (pgEnabled()) {
    const client = await pool().connect();
    try {
      await client.query("begin");
      const current = await client.query("select * from follow_up_companies where id = $1 for update", [id]);
      if (!current.rows[0]) throw new FollowUpError("Empresa no encontrada.", 404);
      const before = fromRow(current.rows[0]);
      const changes: Record<string, unknown> = diff(before, value);
      if (linked !== undefined && String(linked ?? "") !== String(before.linkedResponseId ?? "")) changes.linkedResponseId = { from: before.linkedResponseId, to: linked };
      if (Object.keys(changes).length === 0) { await client.query("rollback"); return before; }
      const next = { ...before, ...value, whatsapp: value.whatsapp ?? before.whatsapp };
      const result = await client.query(
        `update follow_up_companies set name=$2, name_key=$3, segment=$4, contact_name=$5, email=$6, response_status=$7,
           wa_maria_jose=$8, wa_sergio=$9, wa_jose=$10, notes=$11, linked_response_id=$12, updated_at=$13, updated_by=$14
         where id=$1 returning *`,
        [id, next.name, nameKey(next.name), next.segment, next.contactName, next.email, next.responseStatus, next.whatsapp.mariaJose, next.whatsapp.sergio, next.whatsapp.jose, next.notes, linked === undefined ? before.linkedResponseId : linked, now, actor]
      );
      await client.query("insert into follow_up_audit (company_id, action, changes, actor) values ($1,'update',$2,$3)", [id, JSON.stringify(changes), actor]);
      await client.query("commit");
      return fromRow(result.rows[0]);
    } catch (error) { await client.query("rollback").catch(() => undefined); if (isUnique(error)) throw duplicate(); throw error; } finally { client.release(); }
  }

  const company = demo().find((c) => c.id === id);
  if (!company) throw new FollowUpError("Empresa no encontrada.", 404);
  const merged = { ...company, ...value, whatsapp: value.whatsapp ?? company.whatsapp };
  const key = nameKey(merged.name);
  if (demo().some((c) => c.id !== id && c.segment === merged.segment && nameKey(c.name) === key)) throw duplicate();
  Object.assign(company, merged, { updatedAt: now, updatedBy: actor });
  if (linked !== undefined) company.linkedResponseId = linked === null ? null : String(linked);
  return company;
}

export async function followUpHistory(id: string) {
  if (!pgEnabled()) return [];
  const { rows } = await pool().query("select action, changes, actor, at from follow_up_audit where company_id = $1 order by at desc limit 50", [id]);
  return rows.map((r) => ({ action: r.action as string, changes: r.changes, actor: r.actor as string, at: iso(r.at) }));
}

/**
 * Respuestas candidatas para vincular: SOLO coincidencia exacta de correo (sin distinguir
 * mayúsculas) y misma encuesta. Es una ayuda; el vínculo lo confirma una persona.
 */
export async function suggestedResponses(company: FollowUpCompany) {
  if (!company.email) return [];
  const email = company.email.trim().toLowerCase();
  const responses = await listResponses({ surveyId: company.segment });
  return responses
    .filter((r) => r.customer.email?.trim().toLowerCase() === email)
    .map((r) => ({ id: r.id, createdAt: r.createdAt, company: r.customer.company, contactName: r.customer.contactName }));
}

export type { WhatsappPerson };
