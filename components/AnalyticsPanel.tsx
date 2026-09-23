"use client";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ratingLabel, satisfactionQuestions, surveys } from "@/lib/constants";
import type { RatingValue, SatisfactionKey, SurveyResponse } from "@/lib/types";

export function AnalyticsPanel() {
  const [responses, setResponses] = useState<SurveyResponse[]>([]); const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from:"", to:"", company:"", surveyId:"all" });
  useEffect(() => { (async () => { setLoading(true); const p = new URLSearchParams(Object.entries(filters).filter(([,v]) => v)); const data = await fetch(`/api/responses?${p}`).then(r => r.json()); setResponses(data.responses || []); setLoading(false); })(); }, [filters]);
  const companies = useMemo(() => Array.from(new Set(responses.map(r => r.customer.company))).sort(), [responses]); const data = useMemo(() => buildMetrics(responses), [responses]);
  return <main className="admin-shell"><header><p className="eyebrow">Indicadores</p><h1>Análisis de satisfacción</h1><p>Encuestas centralizadas · respuestas evaluables y no evaluables por separado.</p></header><section className="admin-filters compact"><input type="date" className="field-input" value={filters.from} onChange={e => setFilters({...filters, from:e.target.value})}/><input type="date" className="field-input" value={filters.to} onChange={e => setFilters({...filters, to:e.target.value})}/><select className="field-input" value={filters.surveyId} onChange={e => setFilters({...filters, surveyId:e.target.value})}><option value="all">Todas las encuestas</option>{surveys.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select className="field-input" value={filters.company} onChange={e => setFilters({...filters, company:e.target.value})}><option value="">Todos los clientes</option>{companies.map(c => <option key={c}>{c}</option>)}</select></section>{loading ? <div className="loader"><Loader2 className="animate-spin"/>Calculando indicadores</div> : <><section className="metrics"><Metric title="Respuestas totales" value={responses.length}/><Metric title="Del período" value={responses.length}/><Metric title="Satisfacción promedio" value={data.average ? data.average.toFixed(1) : "-"}/><Metric title="No evaluables" value={data.notEvaluable}/><Metric title="Con comentarios" value={responses.filter(r=>r.satisfaction.additionalComments).length}/></section><section className="charts"><Chart title="Distribución de valoraciones"><BarChart data={data.distribution}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="cantidad" fill="#FF771C"/></BarChart></Chart><Chart title="Promedio por pregunta"><BarChart data={data.questions}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" hide/><YAxis domain={[0,5]}/><Tooltip/><Bar dataKey="promedio" fill="#4D4D4D"/></BarChart></Chart><Chart title="Evolución mensual"><LineChart data={data.monthly}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month"/><YAxis domain={[0,5]}/><Tooltip/><Line dataKey="promedio" stroke="#FF771C" strokeWidth={3}/></LineChart></Chart></section><section className="question-analysis"><h2>Análisis por pregunta</h2>{data.questions.map(q => <div key={q.key}><div><strong>{q.order}. {q.label}</strong><span>{q.count} evaluables · promedio {q.promedio || "-"} · {q.notEvaluable} no evaluables</span></div><div className="mini-bars">{q.distribution.map(x => <span key={x.name} style={{height:`${Math.max(4,x.cantidad*20)}px`}} title={`${x.name}: ${x.cantidad}`}/>)}</div></div>)}</section></>}</main>;
}
function numericValues(responses: SurveyResponse[], key: SatisfactionKey): number[] { return responses.map(r => r.satisfaction.ratings[key]).filter((value): value is Exclude<RatingValue, null> => value !== null); }
function average(values: number[]) { return values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0; }
function buildMetrics(responses: SurveyResponse[]) {
  const questions = satisfactionQuestions.map((question) => {
    const values = numericValues(responses, question.key);
    return { key: question.key, order: question.order, label: question.label, name: String(question.order), count: values.length, promedio: Number(average(values).toFixed(2)), notEvaluable: responses.filter((response) => response.satisfaction.ratings[question.key] === null).length, distribution: [1, 2, 3, 4, 5].map((value) => ({ name: String(value), cantidad: values.filter((rating) => rating === value).length })) };
  });
  const all = questions.flatMap((question) => numericValues(responses, question.key));
  const byMonth = new Map<string, number[]>();
  responses.forEach((response) => {
    const month = response.createdAt.slice(0, 7);
    const values = satisfactionQuestions.flatMap((question) => {
      const value = response.satisfaction.ratings[question.key];
      return typeof value === "number" ? [value] : [];
    });
    byMonth.set(month, [...(byMonth.get(month) || []), ...values]);
  });
  return {
    average: average(all),
    notEvaluable: responses.reduce((total, response) => total + satisfactionQuestions.filter((question) => response.satisfaction.ratings[question.key] === null).length, 0),
    distribution: [1, 2, 3, 4, 5].map((value) => ({ name: ratingLabel(value as RatingValue), cantidad: all.filter((rating) => rating === value).length })),
    questions,
    monthly: Array.from(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, values]) => ({ month, promedio: Number(average(values).toFixed(2)) }))
  };
}
function Metric({title,value}:{title:string;value:string|number}) { return <div><p>{title}</p><strong>{value}</strong></div>; }
function Chart({title,children}:{title:string;children:React.ReactElement}) { return <section><h2>{title}</h2><div><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></section>; }
