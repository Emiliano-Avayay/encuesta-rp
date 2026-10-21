"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { calculateMetrics, isSatisfactionQuestion, percentage, type QuestionMetric } from "@/lib/analytics";
import { generalQuestions, surveyName, surveys, visibleQuestions } from "@/lib/constants";
import type { SurveyResponse } from "@/lib/types";

export function AnalyticsPanel() {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ from: "", to: "", company: "", surveyId: "all" });
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

  return <main className="admin-shell"><header><p className="eyebrow">Indicadores</p><h1>Análisis de satisfacción</h1><p>El bloque general se compara entre segmentos; las preguntas específicas se analizan solo dentro de su segmento.</p></header><section className="admin-filters compact"><input type="date" className="field-input" value={filters.from} onChange={event => setFilters({ ...filters, from: event.target.value })}/><input type="date" className="field-input" value={filters.to} onChange={event => setFilters({ ...filters, to: event.target.value })}/><select className="field-input" value={filters.surveyId} onChange={event => setFilters({ ...filters, surveyId: event.target.value, company: "" })}><option value="all">Todas las encuestas</option>{surveys.map(survey => <option key={survey.id} value={survey.id}>{survey.name}</option>)}</select><select aria-label="Razón social" className="field-input" value={filters.company} onChange={event => setFilters({ ...filters, company: event.target.value })}><option value="">Todas las razones sociales</option>{companies.map(company => <option key={company} value={company}>{company}</option>)}</select></section>{loading ? <div className="loader"><Loader2 className="animate-spin"/>Calculando indicadores</div> : error ? <p className="empty">{error}</p> : <><section className="metrics"><Metric title="Respuestas totales" value={responses.length}/><Metric title="Satisfacción general promedio" value={general.count ? general.average.toFixed(1) : "-"}/><Metric title="No evaluables" value={general.noAnswer}/>{filters.surveyId !== "all" && <Metric title={`Promedio específico ${surveyName(filters.surveyId)}`} value={specific.count ? specific.average.toFixed(1) : "-"}/>}</section><QuestionList title="Bloque general comparable" data={general.items}/>{filters.surveyId !== "all" ? <QuestionList title={`Preguntas específicas · ${surveyName(filters.surveyId)}`} data={specific.items}/> : <p className="empty">Elegí un segmento para analizar sus preguntas específicas sin mezclarlas con las de otros segmentos.</p>}</>}</main>;
}

function Metric({ title, value }: { title: string; value: string | number }) { return <div><p>{title}</p><strong>{value}</strong></div>; }
function QuestionList({ title, data }: { title: string; data: QuestionMetric[] }) { return <section className="question-analysis"><h2>{title}</h2>{data.map(item => <QuestionResult key={item.question.key} item={item}/>)}</section>; }
function QuestionResult({ item }: { item: QuestionMetric }) {
  const { question } = item;
  const answeredChoices = item.yes + item.no;
  let detail: React.ReactNode;
  if (isSatisfactionQuestion(question)) detail = <span>{item.count} evaluables · promedio {item.count ? `${item.average.toFixed(2)}/5` : "-"} · {item.noAnswer} no evaluables</span>;
  else if (question.kind === "number") detail = <span>{item.count} respuestas numéricas · {item.count ? `Promedio: ${item.average.toFixed(2)}${question.unit === "days" ? " días" : ""}` : "Sin respuestas numéricas"}{item.noAnswer ? ` · ${item.noAnswer} prefieren no responder` : ""}</span>;
  else if (question.kind === "yesNo") detail = <span>Sí: {item.yes} ({percentage(item.yes, answeredChoices).toFixed(0)}%) · No: {item.no} ({percentage(item.no, answeredChoices).toFixed(0)}%){item.noAnswer ? ` · ${item.noAnswer} prefieren no responder` : ""}</span>;
  else detail = <><span>{item.textAnswers.length} respuestas de texto{item.noAnswer ? ` · ${item.noAnswer} prefieren no responder` : ""}</span>{item.textAnswers.length > 0 && <details><summary>Ver respuestas</summary><ul>{item.textAnswers.map((answer, index) => <li key={`${index}-${answer}`}>{answer}</li>)}</ul></details>}</>;
  return <div><div><strong>{question.order}{question.subquestion ? ".a" : ""}. {question.label}</strong>{detail}</div></div>;
}
