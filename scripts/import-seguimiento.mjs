// Importación inicial NO destructiva de la planilla "Seguimiento y Control".
//   node scripts/import-seguimiento.mjs <planilla.csv> [--apply] [--report salida.csv]
//   node scripts/import-seguimiento.mjs <planilla.csv> --emit-sql <directorio>
// --emit-sql no se conecta a ninguna base: genera dryrun.sql (solo lectura) y apply.sql (una
// transacción, idempotente) para ejecutarlos con psql, p. ej. dentro del contenedor de Postgres.
// Sin --apply solo informa (dry-run). Con --apply inserta únicamente empresas que no existen
// (clave: segmento + nombre normalizado); nunca pisa datos ya editados. Es idempotente.
// La planilla se exporta desde Google Sheets: Archivo > Descargar > CSV.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { nameKey, parseCsv, planSheetImport, segmentName } from "../lib/follow-up-core.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const reportAt = args.indexOf("--report");
const reportPath = reportAt >= 0 ? args[reportAt + 1] : null;
const sqlAt = args.indexOf("--emit-sql");
const sqlDir = sqlAt >= 0 ? args[sqlAt + 1] : null;
const file = args.find((a, i) => !a.startsWith("--") && i !== (reportAt >= 0 ? reportAt + 1 : -1) && i !== (sqlAt >= 0 ? sqlAt + 1 : -1));
if (!file) { console.error("Uso: node scripts/import-seguimiento.mjs <planilla.csv> [--apply] [--report salida.csv]"); process.exit(1); }

const actor = "importacion-planilla";
const { records, issues } = planSheetImport(parseCsv(readFileSync(file, "utf8")));
if (sqlDir) {
  const lit = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
  const rows = records.map((r) => `(${[r.name, nameKey(r.name), r.segment, r.contactName, r.email, r.responseStatus].map(lit).join(", ")}, ${r.whatsapp.mariaJose}, ${r.whatsapp.sergio}, ${r.whatsapp.jose}, ${lit(r.notes)}, ${lit(r.sourceRow)})`).join(",\n  ");
  const cols = "name, name_key, segment, contact_name, email, response_status, wa_maria_jose, wa_sergio, wa_jose, notes, source_row";
  const values = `v(${cols}) as (values\n  ${rows}\n)`;
  const dry = `-- DRY-RUN: solo lectura. Resultado esperado antes de importar: nuevas=${records.length}, existentes=0.\nbegin read only;\nwith ${values}\nselect segment, count(*) as en_planilla,\n  count(*) filter (where exists (select 1 from follow_up_companies c where c.segment = v.segment and c.name_key = v.name_key)) as ya_existentes,\n  count(*) filter (where not exists (select 1 from follow_up_companies c where c.segment = v.segment and c.name_key = v.name_key)) as se_insertarian\nfrom v group by rollup (segment) order by segment nulls last;\nrollback;\n`;
  const applySql = `-- IMPORTACIÓN: una transacción; solo inserta lo que no existe (segmento + nombre normalizado).\nbegin;\nwith ${values},\nins as (\n  insert into follow_up_companies (id, ${cols}, created_by, updated_by)\n  select gen_random_uuid(), ${cols}, '${actor}', '${actor}' from v\n  on conflict (segment, name_key) do nothing\n  returning id, source_row\n)\ninsert into follow_up_audit (company_id, action, changes, actor)\nselect id, 'import', jsonb_build_object('source', source_row), '${actor}' from ins;\nselect count(*) as total_en_tabla from follow_up_companies;\ncommit;\n`;
  mkdirSync(sqlDir, { recursive: true });
  writeFileSync(`${sqlDir}/dryrun.sql`, dry); writeFileSync(`${sqlDir}/apply.sql`, applySql);
  console.log(`SQL generado en ${sqlDir} (${records.length} empresas, ${issues.length} observaciones). No se escribió en ninguna base.`);
  process.exit(0);
}
const hasDb = Boolean(process.env.DATABASE_URL || process.env.PGHOST);
if (apply && !hasDb) { console.error("--apply requiere DATABASE_URL (no se escribe nada fuera de PostgreSQL)."); process.exit(1); }

const client = hasDb ? new pg.Client({ connectionString: process.env.DATABASE_URL || undefined, ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : undefined }) : null;
const inserted = new Set();
try {
  let existing = new Set();
  if (client) {
    await client.connect();
    const found = await client.query("select to_regclass('public.follow_up_companies') as t");
    if (!found.rows[0].t) {
      if (apply) throw new Error("Falta la tabla follow_up_companies: aplicar primero db/migrations/2026-10-seguimiento.sql.");
      console.log("Aviso: la tabla follow_up_companies todavía no existe (migración pendiente); se asume vacía.");
    } else {
      const { rows } = await client.query("select segment, name_key from follow_up_companies");
      existing = new Set(rows.map((r) => `${r.segment}:${r.name_key}`));
    }
  }
  if (apply) {
    await client.query("begin");
    for (const r of records) {
      if (existing.has(r.key)) continue;
      const id = randomUUID();
      const res = await client.query(
        `insert into follow_up_companies (id, name, name_key, segment, contact_name, email, response_status, wa_maria_jose, wa_sergio, wa_jose, notes, source_row, created_by, updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) on conflict (segment, name_key) do nothing returning id`,
        [id, r.name, nameKey(r.name), r.segment, r.contactName, r.email, r.responseStatus, r.whatsapp.mariaJose, r.whatsapp.sergio, r.whatsapp.jose, r.notes, r.sourceRow, actor]
      );
      if (res.rowCount) { inserted.add(r.key); await client.query("insert into follow_up_audit (company_id, action, changes, actor) values ($1,'import',$2,$3)", [id, JSON.stringify({ source: r.sourceRow }), actor]); }
    }
    await client.query("commit");
  }

  const bySegment = {};
  for (const r of records) bySegment[segmentName(r.segment)] = (bySegment[segmentName(r.segment)] ?? 0) + 1;
  console.log(`Modo: ${apply ? "APLICAR" : "DRY-RUN (no se escribió nada)"}`);
  console.log(`Empresas leídas: ${records.length}`, bySegment);
  if (client) console.log(`Ya existentes: ${records.filter((r) => existing.has(r.key)).length} · ${apply ? "Insertadas" : "Se insertarían"}: ${apply ? inserted.size : records.filter((r) => !existing.has(r.key)).length}`);
  else console.log("Sin base conectada: no se pudo comparar con registros existentes.");
  console.log(`Con correo válido: ${records.filter((r) => r.email).length} · sin correo: ${records.filter((r) => !r.email).length}`);
  console.log(`Observaciones: ${issues.length}`);
  for (const i of issues) console.log(`  [${i.kind}] ${i.row} ${i.company}: ${i.detail}`);

  if (reportPath) {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = ["segmento,empresa,correo,contacto,estado,wa_mj,wa_sergio,wa_jose,notas,origen,accion"];
    for (const r of records) lines.push([segmentName(r.segment), r.name, r.email, r.contactName, r.responseStatus, r.whatsapp.mariaJose, r.whatsapp.sergio, r.whatsapp.jose, r.notes, r.sourceRow, existing.has(r.key) ? "existente" : apply ? "insertada" : "nueva"].map(q).join(","));
    writeFileSync(reportPath, lines.join("\n") + "\n");
    console.log(`Reporte escrito en ${reportPath}`);
  }
} catch (error) {
  if (apply) await client.query("rollback").catch(() => undefined);
  console.error("La importación falló; no se aplicaron cambios.", error.message);
  process.exitCode = 1;
} finally { await client?.end(); }
