"use client";
import { Loader2, Pencil, Plus, Search, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  computeStats, filterCompanies, followUpSegments, responseStatuses, segmentName, statsBySegment, whatsappPeople,
  type FollowUpCompany, type ResponseStatus, type WhatsappPerson
} from "@/lib/follow-up-core";

const percent = (value: number) => `${(value * 100).toFixed(1).replace(".", ",")}%`;
const formatDate = (value: string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
type Draft = { name: string; segment: string; contactName: string; email: string; notes: string; responseStatus: ResponseStatus; whatsapp: Record<WhatsappPerson, boolean> };
const blank: Draft = { name: "", segment: "venta", contactName: "", email: "", notes: "", responseStatus: "undefined", whatsapp: { mariaJose: false, sergio: false, jose: false } };

export function FollowUpPanel() {
  const [companies, setCompanies] = useState<FollowUpCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ search: "", segment: "all", status: "all", whatsapp: "all" });
  const [editing, setEditing] = useState<FollowUpCompany | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/seguimiento");
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setCompanies(data.companies); setError(""); } else setError(data.error || "No pudimos cargar el seguimiento.");
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => filterCompanies(companies, filters), [companies, filters]);
  const total = useMemo(() => computeStats(companies), [companies]);
  const perSegment = useMemo(() => statsBySegment(companies), [companies]);

  // Cambios rápidos desde la tabla (estado y marcas de WhatsApp).
  async function quickPatch(company: FollowUpCompany, patch: Record<string, unknown>) {
    setBusy(company.id);
    const response = await fetch(`/api/seguimiento/${company.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) return setError(data.error || "No se pudo guardar el cambio.");
    setError("");
    setCompanies((items) => items.map((item) => (item.id === company.id ? data.company : item)));
  }

  return (
    <main className="admin-shell follow-up">
      <header>
        <p className="eyebrow">Gestión interna</p>
        <h1>Seguimiento de encuestas</h1>
        <p>Control de envío y respuesta por empresa. Los porcentajes se calculan con las empresas registradas.</p>
      </header>
      {error && <p className="field-error" role="alert">{error}</p>}

      <section className="fu-kpis" aria-label="Indicadores globales">
        <Kpi label="Empresas totales" value={String(total.total)} />
        <Kpi label="Respuestas recibidas" value={String(total.responded)} />
        <Kpi label="Pendientes" value={String(total.pending)} hint={`${total.notResponded} no respondieron · ${total.undefinedCount} sin definir`} />
        <Kpi label="Tasa de respuesta" value={percent(total.rate)} accent />
      </section>

      <section className="fu-segments" aria-label="Indicadores por encuesta">
        {perSegment.map((s) => (
          <button key={s.id} className={`fu-segment${filters.segment === s.id ? " active" : ""}`} onClick={() => setFilters((f) => ({ ...f, segment: f.segment === s.id ? "all" : s.id }))}>
            <strong>{s.name}</strong>
            <span className="fu-rate">{percent(s.rate)}</span>
            <small>{s.responded} de {s.total} respondieron</small>
            <i style={{ width: percent(s.rate) }} />
          </button>
        ))}
      </section>

      <section className="fu-toolbar">
        <label className="fu-search"><Search size={16} /><input className="field-input" placeholder="Buscar empresa, correo o contacto" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></label>
        <select className="field-input" aria-label="Segmento" value={filters.segment} onChange={(e) => setFilters({ ...filters, segment: e.target.value })}>
          <option value="all">Todos los segmentos</option>{followUpSegments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="field-input" aria-label="Estado de respuesta" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="all">Todos los estados</option>{responseStatuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="field-input" aria-label="Responsable de WhatsApp" value={filters.whatsapp} onChange={(e) => setFilters({ ...filters, whatsapp: e.target.value })}>
          <option value="all">Todos los responsables</option>
          {whatsappPeople.map((p) => <option key={p.id} value={p.id}>WhatsApp: {p.name}</option>)}
          <option value="none">Sin seguimiento por WhatsApp</option>
        </select>
        <button className="primary-action fu-add" onClick={() => setEditing("new")}><Plus size={16} /> Nueva empresa</button>
      </section>

      <p className="fu-count" aria-live="polite">{loading ? "Cargando…" : `${visible.length} de ${companies.length} empresas`}</p>
      {loading ? <p className="fu-empty"><Loader2 className="animate-spin" size={18} /> Cargando seguimiento…</p> : visible.length === 0 ? (
        <p className="fu-empty">{companies.length === 0 ? "Todavía no hay empresas registradas. Importá la planilla inicial o agregá una nueva." : "Ninguna empresa coincide con los filtros."}</p>
      ) : (
        <div className="fu-table-wrap">
          <table className="fu-table">
            <thead><tr><th>Empresa</th><th>Segmento</th><th>Correo</th><th>Contacto</th><th>Respuesta</th>{whatsappPeople.map((p) => <th key={p.id} className="fu-center">{p.name}</th>)}<th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id} className={busy === c.id ? "busy" : ""}>
                  <td data-label="Empresa"><strong>{c.name}</strong></td>
                  <td data-label="Segmento">{segmentName(c.segment)}</td>
                  <td data-label="Correo">{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : <span className="fu-muted">Sin correo</span>}</td>
                  <td data-label="Contacto">{c.contactName || <span className="fu-muted">—</span>}</td>
                  <td data-label="Respuesta">
                    <select className={`fu-status ${c.responseStatus}`} aria-label={`Estado de ${c.name}`} value={c.responseStatus} disabled={busy === c.id} onChange={(e) => quickPatch(c, { responseStatus: e.target.value })}>
                      {responseStatuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                  {whatsappPeople.map((p) => (
                    <td key={p.id} data-label={`WhatsApp ${p.name}`} className="fu-center">
                      <input type="checkbox" className="fu-check" aria-label={`WhatsApp ${p.name} para ${c.name}`} checked={c.whatsapp[p.id]} disabled={busy === c.id} onChange={(e) => quickPatch(c, { whatsapp: { ...c.whatsapp, [p.id]: e.target.checked } })} />
                    </td>
                  ))}
                  <td className="fu-actions"><button className="fu-icon" aria-label={`Editar ${c.name}`} onClick={() => setEditing(c)}><Pencil size={16} /> <span>Editar</span></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <EditDialog company={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={(saved) => { setCompanies((items) => items.some((i) => i.id === saved.id) ? items.map((i) => (i.id === saved.id ? saved : i)) : [...items, saved]); setEditing(null); }} />}
    </main>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return <div className={`fu-kpi${accent ? " accent" : ""}`}><small>{label}</small><strong>{value}</strong>{hint && <em>{hint}</em>}</div>;
}

type Detail = { history: { action: string; changes: Record<string, { from: unknown; to: unknown }>; actor: string; at: string }[]; suggestions: { id: string; createdAt: string; company: string; contactName: string }[] };

function EditDialog({ company, onClose, onSaved }: { company: FollowUpCompany | null; onClose: () => void; onSaved: (company: FollowUpCompany) => void }) {
  const [draft, setDraft] = useState<Draft>(company ? { name: company.name, segment: company.segment, contactName: company.contactName ?? "", email: company.email ?? "", notes: company.notes ?? "", responseStatus: company.responseStatus, whatsapp: company.whatsapp } : blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [linked, setLinked] = useState<string | null>(company?.linkedResponseId ?? null);

  useEffect(() => {
    if (!company) return;
    fetch(`/api/seguimiento/${company.id}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setDetail(d)).catch(() => undefined);
  }, [company]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(""); setErrors({});
    const response = await fetch(company ? `/api/seguimiento/${company.id}` : "/api/seguimiento", { method: company ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, ...(company ? { linkedResponseId: linked } : {}) }) });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) { setErrors(data.fields || {}); return setMessage(data.error || "No se pudo guardar."); }
    onSaved(data.company);
  }
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="fu-modal" role="dialog" aria-modal="true" aria-label={company ? "Editar empresa" : "Nueva empresa"}>
      <form className="fu-dialog" onSubmit={submit}>
        <div className="fu-dialog-head"><h2>{company ? "Editar empresa" : "Nueva empresa"}</h2><button type="button" className="fu-icon" aria-label="Cerrar" onClick={onClose}><X size={18} /></button></div>
        <label>Empresa *<input className="field-input" value={draft.name} onChange={(e) => set({ name: e.target.value })} />{errors.name && <span className="field-error">{errors.name}</span>}</label>
        <label>Segmento *<select className="field-input" value={draft.segment} onChange={(e) => set({ segment: e.target.value })}>{followUpSegments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>{errors.segment && <span className="field-error">{errors.segment}</span>}</label>
        <label>Correo electrónico<input className="field-input" type="email" value={draft.email} onChange={(e) => set({ email: e.target.value })} />{errors.email && <span className="field-error">{errors.email}</span>}</label>
        <label>Contacto<input className="field-input" value={draft.contactName} onChange={(e) => set({ contactName: e.target.value })} /></label>
        <label>Estado de respuesta<select className="field-input" value={draft.responseStatus} onChange={(e) => set({ responseStatus: e.target.value as ResponseStatus })}>{responseStatuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <fieldset><legend>Seguimiento por WhatsApp</legend>
          {whatsappPeople.map((p) => <label key={p.id} className="fu-inline"><input type="checkbox" checked={draft.whatsapp[p.id]} onChange={(e) => set({ whatsapp: { ...draft.whatsapp, [p.id]: e.target.checked } })} /> {p.name}</label>)}
        </fieldset>
        <label>Notas<textarea className="field-input" rows={2} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} /></label>

        {detail && detail.suggestions.length > 0 && (
          <div className="fu-suggest"><strong>Respuestas con el mismo correo</strong>
            {detail.suggestions.map((s) => (
              <p key={s.id}>{s.company} · {s.contactName} · {formatDate(s.createdAt)}
                {linked === s.id ? <em> Vinculada</em> : <button type="button" onClick={() => { setLinked(s.id); set({ responseStatus: "responded" }); }}>Vincular y marcar Respondió</button>}</p>
            ))}
            <small>Solo se sugieren coincidencias exactas de correo; confirmá el vínculo manualmente.</small>
          </div>
        )}
        {detail && detail.history.length > 0 && (
          <details className="fu-history"><summary>Historial de cambios ({detail.history.length})</summary>
            <ul>{detail.history.map((h, i) => <li key={i}><b>{h.actor}</b> · {formatDate(h.at)} · {h.action === "update" ? Object.keys(h.changes).join(", ") : h.action === "import" ? "importación inicial" : "alta"}</li>)}</ul>
          </details>
        )}
        {company && <small className="fu-muted">Última modificación: {company.updatedBy} · {formatDate(company.updatedAt)}</small>}
        {message && <p className="field-error" role="alert">{message}</p>}
        <div className="fu-dialog-actions"><button type="button" className="fu-secondary" onClick={onClose}>Cancelar</button><button className="primary-action" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button></div>
      </form>
    </div>
  );
}
