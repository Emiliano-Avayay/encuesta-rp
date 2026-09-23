import { Pool } from "pg";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { surveyQuestions } from "@/lib/constants";
import { cleanText } from "@/lib/validation";
import type { ResponseFilters, SurveyResponse } from "@/lib/types";

const SOURCE = "poleas-rp" as const;
const dataFile = path.join(process.cwd(), "data", "demo-responses.json");
const memory = globalThis as typeof globalThis & { __rpResponses?: SurveyResponse[]; __rpPool?: Pool };

const pgEnabled = () => Boolean(process.env.DATABASE_URL);
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function pool() {
  if (!memory.__rpPool) memory.__rpPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : undefined });
  return memory.__rpPool;
}

function fromRow(row: any): SurveyResponse {
  return {
    id: String(row.id),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    customer: row.customer,
    satisfaction: row.satisfaction,
    consent: row.consent,
    source: SOURCE,
    demo: row.source === "demo"
  };
}

async function demoRecords() {
  if (memory.__rpResponses) return memory.__rpResponses;
  try {
    const parsed = JSON.parse(await readFile(dataFile, "utf8"));
    memory.__rpResponses = Array.isArray(parsed) ? parsed.filter((record) => record.source === SOURCE) : [];
  } catch { memory.__rpResponses = []; }
  return memory.__rpResponses;
}

async function persist(records: SurveyResponse[]) {
  memory.__rpResponses = records;
  try {
    let legacy: unknown[] = [];
    try { const current = JSON.parse(await readFile(dataFile, "utf8")); legacy = Array.isArray(current) ? current.filter((record) => record?.source !== SOURCE) : []; } catch { /* first demo write */ }
    await mkdir(path.dirname(dataFile), { recursive: true });
    await writeFile(dataFile, JSON.stringify([...records, ...legacy], null, 2));
  } catch { /* demo remains in memory when storage is read-only */ }
}

function applyFilters(records: SurveyResponse[], filters: ResponseFilters) {
  const search = filters.search?.trim().toLowerCase();
  return records.filter((record) => {
    if (filters.company && !record.customer.company.toLowerCase().includes(filters.company.toLowerCase())) return false;
    if (filters.surveyId && filters.surveyId !== "all" && record.satisfaction.surveyId !== filters.surveyId) return false;
    if (filters.segment && record.customer.segment !== filters.segment) return false;
    if (filters.question && filters.rating) {
      const value = record.satisfaction.ratings[filters.question as keyof typeof record.satisfaction.ratings];
      if (String(value) !== filters.rating) return false;
    }
    if (filters.from && record.createdAt.slice(0, 10) < filters.from) return false;
    if (filters.to && record.createdAt.slice(0, 10) > filters.to) return false;
    if (!search) return true;
    return [record.customer.company, record.customer.contactName, record.customer.email, record.customer.position].filter(Boolean).join(" ").toLowerCase().includes(search);
  });
}

export async function createSurveyResponse(payload: any) {
  const record: SurveyResponse = {
    id: uuid(), createdAt: now(), source: SOURCE, consent: Boolean(payload.consent),
    customer: { company: cleanText(payload.customer.company, 160), contactName: cleanText(payload.customer.contactName, 160), position: cleanText(payload.customer.position, 160), email: cleanText(payload.customer.email, 180), phone: cleanText(payload.customer.phone, 80) },
    satisfaction: { surveyId: payload.satisfaction.surveyId, module: payload.satisfaction.module, ratings: payload.satisfaction.ratings, additionalComments: cleanText(payload.satisfaction.additionalComments, 2400) },
    demo: !pgEnabled()
  };
  if (pgEnabled()) {
    const result = await pool().query(
      `insert into survey_responses (created_at, customer, satisfaction, consent, source)
       values ($1, $2, $3, $4, $5) returning id`,
      [record.createdAt, JSON.stringify(record.customer), JSON.stringify(record.satisfaction), record.consent, SOURCE]
    );
    record.id = String(result.rows[0].id); record.demo = false;
    return record;
  }
  const records = await demoRecords(); records.unshift(record); await persist(records); return record;
}

export async function listResponses(filters: ResponseFilters = {}) {
  const records = pgEnabled()
    ? (await pool().query("select * from survey_responses where source = $1 order by created_at desc", [SOURCE])).rows.map(fromRow)
    : await demoRecords();
  return applyFilters(records, filters).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getResponse(id: string) {
  if (pgEnabled()) {
    if (!/^\d+$/.test(id)) return null;
    const { rows } = await pool().query("select * from survey_responses where id = $1::integer and source = $2", [id, SOURCE]);
    return rows[0] ? fromRow(rows[0]) : null;
  }
  return (await demoRecords()).find((record) => record.id === id) || null;
}

export function questionIds(surveyId = "venta") { return surveyQuestions(surveyId).map((question) => question.key); }
