import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { ACTION_PLAN_LIMIT, actionPlanCategories, isPreviewable, type ActionPlan } from "@/lib/action-plan-constants";

const configuredMaxFileSize = Number(process.env.ACTION_PLANS_MAX_FILE_SIZE || 20 * 1024 * 1024);
export const ACTION_PLAN_MAX_FILE_SIZE = Number.isFinite(configuredMaxFileSize) && configuredMaxFileSize > 0 ? configuredMaxFileSize : 20 * 1024 * 1024;
const allowed = new Map([
  ["pdf", ["application/pdf"]], ["jpg", ["image/jpeg"]], ["jpeg", ["image/jpeg"]], ["png", ["image/png"]], ["webp", ["image/webp"]],
  ["doc", ["application/msword"]], ["docx", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]]
]);
const dataFile = path.join(process.cwd(), "data", "action-plans.json");
const root = path.resolve(process.env.ACTION_PLANS_STORAGE_PATH || path.join(process.cwd(), "data", "action-plans"));
const globalStore = globalThis as typeof globalThis & { __rpActionPlans?: ActionPlan[]; __rpActionPool?: Pool };

export { ACTION_PLAN_LIMIT, actionPlanCategories, isPreviewable, type ActionPlan };
export class ActionPlanError extends Error { constructor(message: string, public status = 400) { super(message); } }
const pgEnabled = () => Boolean(process.env.DATABASE_URL || process.env.PGHOST);
function pool() { return globalStore.__rpActionPool ||= new Pool({ connectionString: process.env.DATABASE_URL || undefined, ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : undefined }); }
export function isCategory(category: string) { return actionPlanCategories.some((item) => item.id === category); }
function record(row: any): ActionPlan { return { id: row.id, category: row.category, title: row.title, description: row.description, originalFilename: row.original_filename ?? row.originalFilename, storedFilename: row.stored_filename ?? row.storedFilename, mimeType: row.mime_type ?? row.mimeType, fileSize: Number(row.file_size ?? row.fileSize), uploadedBy: row.uploaded_by ?? row.uploadedBy, createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at ?? row.createdAt }; }
function extension(name: string) { return path.extname(name).slice(1).toLowerCase(); }
function safeFileName(name: string) { return name.replace(/[\r\n\\/]/g, "_").slice(0, 255) || "archivo"; }
function safePath(category: string, storedFilename: string) { const target = path.resolve(root, category, storedFilename); if (!target.startsWith(`${root}${path.sep}`)) throw new ActionPlanError("Ruta de archivo inválida."); return target; }
function matchesSignature(bytes: Buffer, ext: string) {
  if (ext === "pdf") return bytes.subarray(0, 5).toString() === "%PDF-";
  if (ext === "jpg" || ext === "jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (ext === "png") return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (ext === "webp") return bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (ext === "doc") return bytes.subarray(0, 8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]));
  return ext === "docx" && bytes.subarray(0, 4).toString() === "PK\x03\x04" && bytes.includes(Buffer.from("word/"));
}
export function validateUpload(input: { title: string; file: File }) {
  const title = input.title.trim(); const ext = extension(input.file.name);
  if (!title) throw new ActionPlanError("El título es obligatorio.");
  if (title.length > 180) throw new ActionPlanError("El título no puede superar 180 caracteres.");
  if (!allowed.has(ext) || !allowed.get(ext)?.includes(input.file.type)) throw new ActionPlanError("El tipo de archivo no está permitido.");
  if (!input.file.size) throw new ActionPlanError("Seleccione un archivo válido.");
  if (input.file.size > ACTION_PLAN_MAX_FILE_SIZE) throw new ActionPlanError(`El archivo supera el límite de ${Math.floor(ACTION_PLAN_MAX_FILE_SIZE / 1024 / 1024)} MB.`);
  return { title, ext };
}
async function demoRecords(): Promise<ActionPlan[]> { if (globalStore.__rpActionPlans) return globalStore.__rpActionPlans; try { globalStore.__rpActionPlans = JSON.parse(await readFile(dataFile, "utf8")).map(record); } catch { globalStore.__rpActionPlans = []; } return globalStore.__rpActionPlans!; }
async function saveDemo(records: ActionPlan[]) { globalStore.__rpActionPlans = records; await mkdir(path.dirname(dataFile), { recursive: true }); await writeFile(dataFile, JSON.stringify(records, null, 2)); }
export async function listActionPlans(category?: string) {
  if (category && !isCategory(category)) throw new ActionPlanError("Categoría inválida.");
  if (pgEnabled()) { const result = await pool().query(`select * from action_plans ${category ? "where category = $1" : ""} order by created_at desc`, category ? [category] : []); return result.rows.map(record); }
  return (await demoRecords()).filter((item) => !category || item.category === category).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function createActionPlan(category: string, title: string, description: string, file: File, uploadedBy: string) {
  if (!isCategory(category)) throw new ActionPlanError("Categoría inválida.");
  const validation = validateUpload({ title, file }); const bytes = Buffer.from(await file.arrayBuffer());
  if (!matchesSignature(bytes, validation.ext)) throw new ActionPlanError("El contenido del archivo no coincide con su tipo declarado.");
  const id = crypto.randomUUID(); const storedFilename = `${id}.${validation.ext}`; const item: ActionPlan = { id, category, title: validation.title, description: description.trim().slice(0, 2000) || null, originalFilename: safeFileName(file.name), storedFilename, mimeType: file.type, fileSize: file.size, uploadedBy, createdAt: new Date().toISOString() };
  const destination = safePath(category, storedFilename); await mkdir(path.dirname(destination), { recursive: true }); const temporary = `${destination}.uploading`;
  if (pgEnabled()) {
    const client = await pool().connect(); let written = false;
    try {
      await client.query("begin"); await client.query("select pg_advisory_xact_lock(hashtext($1))", [category]);
      const count = await client.query("select count(*)::int as count from action_plans where category = $1", [category]);
      if ((count.rows[0]?.count ?? 0) >= ACTION_PLAN_LIMIT) throw new ActionPlanError("Esta categoría alcanzó el límite de 5 documentos.", 409);
      await writeFile(temporary, bytes, { flag: "wx" }); await rename(temporary, destination); written = true;
      await client.query("insert into action_plans (id, category, title, description, original_filename, stored_filename, mime_type, file_size, uploaded_by, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [id, category, item.title, item.description, item.originalFilename, storedFilename, item.mimeType, item.fileSize, uploadedBy, item.createdAt]);
      await client.query("commit"); return item;
    } catch (error) { await client.query("rollback").catch(() => undefined); if (written) await unlink(destination).catch(() => console.error("Could not clean up action plan file", destination)); await unlink(temporary).catch(() => undefined); throw error; } finally { client.release(); }
  }
  const records = await demoRecords(); if (records.filter((entry) => entry.category === category).length >= ACTION_PLAN_LIMIT) throw new ActionPlanError("Esta categoría alcanzó el límite de 5 documentos.", 409);
  await writeFile(temporary, bytes, { flag: "wx" }); try { await rename(temporary, destination); records.unshift(item); await saveDemo(records); return item; } catch (error) { await unlink(destination).catch(() => undefined); throw error; }
}
export async function getActionPlan(id: string) { if (!/^[0-9a-f-]{36}$/i.test(id)) return null; if (pgEnabled()) { const result = await pool().query("select * from action_plans where id = $1", [id]); return result.rows[0] ? record(result.rows[0]) : null; } return (await demoRecords()).find((item) => item.id === id) || null; }
export async function readActionPlanFile(item: ActionPlan) { try { return await readFile(safePath(item.category, item.storedFilename)); } catch (error: any) { if (error?.code === "ENOENT") { console.error("Action plan metadata points to a missing file", item.id); throw new ActionPlanError("El archivo ya no está disponible.", 404); } throw error; } }
export async function deleteActionPlan(id: string) { const item = await getActionPlan(id); if (!item) throw new ActionPlanError("Documento no encontrado.", 404); if (pgEnabled()) await pool().query("delete from action_plans where id = $1", [id]); else await saveDemo((await demoRecords()).filter((entry) => entry.id !== id)); try { await unlink(safePath(item.category, item.storedFilename)); } catch (error: any) { if (error?.code !== "ENOENT") { console.error("Unable to delete action plan file", item.id, error); throw new ActionPlanError("El registro se eliminó, pero no pudimos eliminar el archivo físico.", 500); } console.warn("Action plan file was already missing", item.id); } return item; }
