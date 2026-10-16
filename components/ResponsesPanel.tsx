"use client";
import { Eye, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ratingLabel, surveyName, visibleQuestions, surveys } from "@/lib/constants";
import type { SurveyResponse } from "@/lib/types";
export function ResponsesPanel() {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [selected, setSelected] = useState<SurveyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ search: "", from: "", to: "", company: "", surveyId: "all" });
  const requestId = useRef(0);
  const responseController = useRef<AbortController | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/response-companies", { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => { if (Array.isArray(data?.companies)) setCompanies(data.companies); })
      .catch((error: unknown) => { if ((error as { name?: string }).name !== "AbortError") console.error("Unable to load response companies", error); });
    return () => controller.abort();
  }, []);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    responseController.current?.abort();
    const controller = new AbortController();
    responseController.current = controller;
    setLoading(true);
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    let list: SurveyResponse[] = [];
    let nextError = "";
    try {
      const response = await fetch(`/api/responses?${params}`, { signal: controller.signal });
      const data = response.ok ? await response.json() : null;
      list = Array.isArray(data?.responses) ? data.responses : [];
      nextError = response.ok ? "" : "No se pudieron cargar las respuestas.";
    } catch (error: unknown) {
      if ((error as { name?: string }).name === "AbortError") return;
      nextError = "No se pudieron cargar las respuestas.";
    }
    // A delayed response from an old filter selection must not overwrite the latest one.
    if (currentRequest !== requestId.current) return;
    setResponses(list);
    setSelected(list[0] || null);
    setError(nextError);
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => () => responseController.current?.abort(), []);

  useEffect(() => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    router.replace(`${pathname}?${params}`, { scroll: false });
  }, [filters, pathname, router]);

  return <main className="admin-shell"><header><p className="eyebrow">Gestión interna</p><h1>Respuestas de clientes</h1><p>Encuestas de satisfacción · todos los módulos en un único panel.</p></header><form className="admin-filters" onSubmit={event => { event.preventDefault(); load(); }}><input className="field-input" placeholder="Buscar razón social o responsable" value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })}/><input type="date" className="field-input" value={filters.from} onChange={event => setFilters({ ...filters, from: event.target.value })}/><input type="date" className="field-input" value={filters.to} onChange={event => setFilters({ ...filters, to: event.target.value })}/><select className="field-input" value={filters.surveyId} onChange={event => setFilters({ ...filters, surveyId: event.target.value })}><option value="all">Todas</option>{surveys.map(survey => <option key={survey.id} value={survey.id}>{survey.name}</option>)}</select><select aria-label="Razón social" className="field-input" value={filters.company} onChange={event => setFilters({ ...filters, company: event.target.value })}><option value="">Todas las razones sociales</option>{companies.map(company => <option key={company} value={company}>{company}</option>)}</select><button className="primary-action"><Search size={17}/>Aplicar</button></form><div className="response-layout"><section className="response-list">{loading?<div className="loader"><Loader2 className="animate-spin"/>Cargando respuestas</div>:responses.length?<><div className="response-header"><span>Fecha</span><span>Razón social</span><span>Nombre y Apellido</span><span>Segmento</span><span>Ver</span></div>{responses.map(response=><button key={response.id} className={selected?.id===response.id?"response-row active":"response-row"} onClick={()=>setSelected(response)}><span>{date(response.createdAt)}</span><strong>{response.customer.company}</strong><small>{response.customer.contactName}</small><small>{surveyName(response.satisfaction.surveyId)}</small><Eye size={17}/></button>)}</>:<p className="empty">{error||"No hay respuestas para los filtros elegidos."}</p>}</section><Detail response={selected}/></div></main>;
}
function Detail({response}:{response:SurveyResponse|null}) { if(!response)return <aside className="detail-panel empty">Seleccione una respuesta.</aside>;const questions=visibleQuestions(response.satisfaction.surveyId,response.satisfaction.ratings);return <aside className="detail-panel"><p className="eyebrow">Encuesta individual · {surveyName(response.satisfaction.surveyId)}</p><h2>{response.customer.company}</h2><p className="detail-meta">{response.customer.contactName}{response.customer.position?` · ${response.customer.position}`:""}</p><p className="detail-meta">{date(response.createdAt)}</p><div className="answer-list">{questions.map(q=><div key={q.key}><span>{q.order}. {q.label}</span><strong>{ratingLabel(response.satisfaction.ratings[q.key],q)}</strong></div>)}</div>{response.satisfaction.additionalComments&&<section className="comment-detail"><p>Comentario</p><span>{response.satisfaction.additionalComments}</span></section>}</aside>; }
function date(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?"-":new Intl.DateTimeFormat("es-AR",{dateStyle:"medium",timeStyle:"short"}).format(d);}
