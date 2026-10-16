"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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

  const general = useMemo(() => metrics(responses, generalQuestions), [responses]);
  const specific = useMemo(
    () => metrics(responses, filters.surveyId === "all" ? [] : visibleQuestions(filters.surveyId).filter(question => question.block === "specific")),
    [responses, filters.surveyId]
  );

  return <main className="admin-shell"><header><p className="eyebrow">Indicadores</p><h1>Análisis de satisfacción</h1><p>El bloque general se compara entre segmentos; las preguntas específicas se analizan solo dentro de su segmento.</p></header><section className="admin-filters compact"><input type="date" className="field-input" value={filters.from} onChange={event => setFilters({ ...filters, from: event.target.value })}/><input type="date" className="field-input" value={filters.to} onChange={event => setFilters({ ...filters, to: event.target.value })}/><select className="field-input" value={filters.surveyId} onChange={event => setFilters({ ...filters, surveyId: event.target.value, company: "" })}><option value="all">Todas las encuestas</option>{surveys.map(survey => <option key={survey.id} value={survey.id}>{survey.name}</option>)}</select><select aria-label="Razón social" className="field-input" value={filters.company} onChange={event => setFilters({ ...filters, company: event.target.value })}><option value="">Todas las razones sociales</option>{companies.map(company => <option key={company} value={company}>{company}</option>)}</select></section>{loading ? <div className="loader"><Loader2 className="animate-spin"/>Calculando indicadores</div> : error ? <p className="empty">{error}</p> : <><section className="metrics"><Metric title="Respuestas totales" value={responses.length}/><Metric title="Satisfacción general promedio" value={general.average ? general.average.toFixed(1) : "-"}/><Metric title="No evaluables" value={general.noAnswer}/>{filters.surveyId !== "all" && <Metric title={`Promedio específico ${surveyName(filters.surveyId)}`} value={specific.average ? specific.average.toFixed(1) : "-"}/>}</section><QuestionList title="Bloque general comparable" data={general.items}/>{filters.surveyId !== "all" ? <QuestionList title={`Preguntas específicas · ${surveyName(filters.surveyId)}`} data={specific.items}/> : <p className="empty">Elegí un segmento para analizar sus preguntas específicas sin mezclarlas con las de otros segmentos.</p>}</>}</main>;
}

function metrics(responses: SurveyResponse[], questions: ReturnType<typeof visibleQuestions>) {
  const items = questions.map(question => {
    const values = responses.map(response => response.satisfaction.ratings[question.key]).filter(value => typeof value === "number") as number[];
    return { key: question.key, label: question.label, order: question.order, count: values.length, average: avg(values), noAnswer: responses.filter(response => response.satisfaction.ratings[question.key] === null).length };
  });
  const all = items.flatMap(item => responses.flatMap(response => typeof response.satisfaction.ratings[item.key] === "number" ? [response.satisfaction.ratings[item.key] as number] : []));
  return { items, average: avg(all), noAnswer: items.reduce((number, item) => number + item.noAnswer, 0) };
}
function avg(values: number[]) { return values.length ? values.reduce((left, right) => left + right, 0) / values.length : 0; }
function Metric({ title, value }: { title: string; value: string | number }) { return <div><p>{title}</p><strong>{value}</strong></div>; }
function QuestionList({ title, data }: { title: string; data: { key: string; label: string; order: number; count: number; average: number; noAnswer: number }[] }) { return <section className="question-analysis"><h2>{title}</h2>{data.map(question => <div key={question.key}><div><strong>{question.order}. {question.label}</strong><span>{question.count} evaluables · promedio {question.average ? question.average.toFixed(2) : "-"} · {question.noAnswer} no evaluables</span></div></div>)}</section>; }
