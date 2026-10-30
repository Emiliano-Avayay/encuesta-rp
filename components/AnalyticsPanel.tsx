"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { calculateMetrics, isSatisfactionQuestion, percentage, type QuestionMetric } from "@/lib/analytics";
import { generalQuestions, surveyName, surveys, visibleQuestions } from "@/lib/constants";
import { companyKey } from "@/lib/response-companies";
import { feedbackByCompany, noCompanyLabel, type CompanyFeedback, type ResponseFeedback } from "@/lib/response-feedback";
import type { SurveyResponse } from "@/lib/types";

export function AnalyticsPanel() {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ from: "", to: "", company: "", surveyId: "all" });
  const [openCompany, setOpenCompany] = useState<string | null>(null);
  const requestId = useRef(0);
  const companyRequestId = useRef(0);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const currentRequest = ++companyRequestId.current;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (filters.surveyId !== "all") params.set("surveyId", filters.surveyId);
    fetch(`/api/response-companies${params.size ? `?${params}` : ""}`, { signal: controller.signal })
      .then(async response => response.ok ? response.json() : null)
      .then(data => {
        if (currentRequest === companyRequestId.current && Array.isArray(data?.companies)) setCompanies(data.companies);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError") console.error("Unable to load response companies", error);
      });
    return () => controller.abort();
  }, [filters.surveyId]);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      let list: SurveyResponse[] = [];
      let nextError = "";
      try {
        const response = await fetch(`/api/responses?${params}`, { signal: controller.signal });
        const data = response.ok ? await response.json() : null;
        list = Array.isArray(data?.responses) ? data.responses : [];
        nextError = response.ok ? "" : "No se pudieron cargar los indicadores.";
      } catch (error: unknown) {
        if ((error as { name?: string }).name === "AbortError") return;
        nextError = "No se pudieron cargar los indicadores.";
      }
      if (currentRequest !== requestId.current) return;
      setResponses(list);
      setError(nextError);
      setLoading(false);
    })();
    return () => controller.abort();
  }, [filters]);

  useEffect(() => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    router.replace(`${pathname}?${params}`, { scroll: false });
  }, [filters, pathname, router]);

  const general = useMemo(() => calculateMetrics(responses, generalQuestions), [responses]);
  const specific = useMemo(
    () => calculateMetrics(responses, filters.surveyId === "all" ? [] : visibleQuestions(filters.surveyId).filter(question => question.block === "specific")),
    [responses, filters.surveyId]
  );
  // Built from the responses already scoped by every active filter, so the detail never mixes other companies or periods.
  const feedback = useMemo(() => feedbackByCompany(responses), [responses]);
  // A filter change that leaves the open company out of scope closes its detail instead of showing stale entries.
  const openGroup = openCompany === null ? undefined : feedback.find(group => group.key === openCompany);
  const companySelected = Boolean(filters.company);
  useEffect(() => { if (openCompany !== null && !loading && !openGroup) setOpenCompany(null); }, [openCompany, openGroup, loading]);

  return <main className="admin-shell"><header><p className="eyebrow">Indicadores</p><h1>Análisis de satisfacción</h1><p>El bloque general se compara entre segmentos; las preguntas específicas se analizan solo dentro de su segmento.</p></header><section className="admin-filters compact"><input type="date" className="field-input" value={filters.from} onChange={event => setFilters({ ...filters, from: event.target.value })}/><input type="date" className="field-input" value={filters.to} onChange={event => setFilters({ ...filters, to: event.target.value })}/><select className="field-input" value={filters.surveyId} onChange={event => setFilters({ ...filters, surveyId: event.target.value, company: "" })}><option value="all">Todas las encuestas</option>{surveys.map(survey => <option key={survey.id} value={survey.id}>{survey.name}</option>)}</select><select aria-label="Razón social" className="field-input" value={filters.company} onChange={event => setFilters({ ...filters, company: event.target.value })}><option value="">Todas las razones sociales</option>{companies.map(company => <option key={company} value={company}>{company}</option>)}</select></section>{loading ? <div className="loader"><Loader2 className="animate-spin"/>Calculando indicadores</div> : error ? <p className="empty">{error}</p> : <><section className="metrics"><Metric title="Respuestas totales" value={responses.length}/><Metric title="Satisfacción general promedio" value={general.count ? general.average.toFixed(1) : "-"}/><Metric title="No evaluables" value={general.noAnswer}/>{filters.surveyId !== "all" && <Metric title={`Promedio específico ${surveyName(filters.surveyId)}`} value={specific.count ? specific.average.toFixed(1) : "-"}/>}</section><QuestionList title="Bloque general comparable" data={general.items} companySelected={companySelected} onOpenCompany={setOpenCompany}/>{filters.surveyId !== "all" ? <QuestionList title={`Preguntas específicas · ${surveyName(filters.surveyId)}`} data={specific.items} companySelected={companySelected} onOpenCompany={setOpenCompany}/> : <p className="empty">Elegí un segmento para analizar sus preguntas específicas sin mezclarlas con las de otros segmentos.</p>}<FeedbackSection groups={feedback} companySelected={companySelected} onOpenCompany={setOpenCompany}/></>}{!loading && !error && openGroup && <FeedbackDialog group={openGroup} onClose={() => setOpenCompany(null)}/>}</main>;
}

function Metric({ title, value }: { title: string; value: string | number }) { return <div><p>{title}</p><strong>{value}</strong></div>; }
type OpenCompany = (key: string) => void;
function QuestionList({ title, data, companySelected, onOpenCompany }: { title: string; data: QuestionMetric[]; companySelected: boolean; onOpenCompany: OpenCompany }) { return <section className="question-analysis"><h2>{title}</h2>{data.map(item => <QuestionResult key={item.question.key} item={item} companySelected={companySelected} onOpenCompany={onOpenCompany}/>)}</section>; }
function QuestionResult({ item, companySelected, onOpenCompany }: { item: QuestionMetric; companySelected: boolean; onOpenCompany: OpenCompany }) {
  const { question } = item;
  const answeredChoices = item.yes + item.no;
  let detail: React.ReactNode;
  if (isSatisfactionQuestion(question)) detail = <span>{item.count} evaluables · promedio {item.count ? `${item.average.toFixed(2)}/5` : "-"} · {item.noAnswer} no evaluables</span>;
  else if (question.kind === "number") detail = <span>{item.count} respuestas numéricas · {item.count ? `Promedio: ${item.average.toFixed(2)}${question.unit === "days" ? " días" : ""}` : "Sin respuestas numéricas"}{item.noAnswer ? ` · ${item.noAnswer} prefieren no responder` : ""}</span>;
  else if (question.kind === "yesNo") detail = <span>Sí: {item.yes} ({percentage(item.yes, answeredChoices).toFixed(0)}%) · No: {item.no} ({percentage(item.no, answeredChoices).toFixed(0)}%){item.noAnswer ? ` · ${item.noAnswer} prefieren no responder` : ""}</span>;
  // With one company selected its answers are read in full; across companies only names are listed, each opening that company's detail.
  else detail = <><span>{item.textAnswers.length} respuestas de texto{item.noAnswer ? ` · ${item.noAnswer} prefieren no responder` : ""}</span>{item.textEntries.length > 0 && <details><summary>{companySelected ? "Ver respuestas" : "Ver empresas"}</summary>{companySelected ? <ul>{item.textEntries.map(entry => <li key={entry.responseId}>{entry.answer}</li>)}</ul> : <CompanyLinks companies={item.textEntries.map(entry => entry.company)} onOpenCompany={onOpenCompany}/>}</details>}</>;
  return <div><div><strong>{question.order}{question.subquestion ? ".a" : ""}. {question.label}</strong>{detail}</div></div>;
}
function CompanyLinks({ companies, onOpenCompany }: { companies: string[]; onOpenCompany: OpenCompany }) {
  const unique = new Map<string, { name: string; count: number }>();
  for (const company of companies) { const key = companyKey(company); const current = unique.get(key); unique.set(key, { name: current?.name || company.trim() || noCompanyLabel, count: (current?.count || 0) + 1 }); }
  return <ul className="feedback-companies">{Array.from(unique, ([key, { name, count }]) => <li key={key}><button type="button" className="feedback-company" aria-haspopup="dialog" onClick={() => onOpenCompany(key)}>{name}{count > 1 && <><span className="feedback-count" aria-hidden="true">{count}</span><span className="sr-only">{`, ${count} respuestas`}</span></>}</button></li>)}</ul>;
}
function FeedbackSection({ groups, companySelected, onOpenCompany }: { groups: CompanyFeedback[]; companySelected: boolean; onOpenCompany: OpenCompany }) {
  const entries = groups.flatMap(group => group.entries);
  return <section className="feedback-analysis" aria-labelledby="feedback-title"><h2 id="feedback-title">Comentarios y respuestas abiertas</h2>{!entries.length ? <p className="empty">No hay comentarios ni respuestas abiertas para los filtros elegidos.</p> : companySelected ? entries.map(entry => <FeedbackEntry key={entry.responseId} entry={entry}/>) : <><p className="feedback-hint">Seleccioná una empresa para ver sus comentarios y respuestas abiertas.</p><CompanyLinks companies={entries.map(entry => entry.company)} onOpenCompany={onOpenCompany}/></>}</section>;
}
function FeedbackEntry({ entry }: { entry: ResponseFeedback }) {
  return <article className="feedback-entry"><p className="detail-meta">{date(entry.createdAt)} · {surveyName(entry.surveyId)}{entry.contactName ? ` · ${entry.contactName}` : ""}</p>{entry.comment && <section className="feedback-block"><p className="eyebrow">Comentario</p><p>{entry.comment}</p></section>}{entry.openAnswers.length > 0 && <section className="feedback-block"><p className="eyebrow">Respuestas abiertas</p><dl>{entry.openAnswers.map(({ question, answer }) => <div key={question.key}><dt>{question.order}{question.subquestion ? ".a" : ""}. {question.label}</dt><dd>{answer}</dd></div>)}</dl></section>}</article>;
}
function FeedbackDialog({ group, onClose }: { group: CompanyFeedback; onClose: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { previous?.focus(); };
  }, []);
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    if (event.key === "Tab") {
      const controls = dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]");
      if (!controls?.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
  const total = group.entries.length;
  return <div className="data-use-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialog} className="data-use-modal feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-dialog-title" onKeyDown={onKeyDown}><button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar detalle de comentarios"><X size={20}/></button><p className="eyebrow">{total} {total === 1 ? "respuesta" : "respuestas"}</p><h2 id="feedback-dialog-title">{group.company}</h2>{group.entries.map(entry => <FeedbackEntry key={entry.responseId} entry={entry}/>)}</section></div>;
}
function date(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "-" : new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(parsed); }
