"use client";

import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { getSurvey, surveyQuestions } from "@/lib/constants";
import { RatingSlider } from "@/components/RatingSlider";
import type { RatingValue, SatisfactionKey, SurveyId } from "@/lib/types";
import { validateSurveyPayload, type ValidationErrors } from "@/lib/validation";

export function SurveyForm({ surveyId = "venta" }: { surveyId?: SurveyId }) {
  const survey = getSurvey(surveyId)!;
  const questions = surveyQuestions(surveyId);
  const emptyRatings = Object.fromEntries(questions.map((q) => [q.key, undefined])) as Record<SatisfactionKey, RatingValue | undefined>;
  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState({ company: "", contactName: "", position: "", email: "", phone: "" });
  const [ratings, setRatings] = useState(emptyRatings);
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const groups = [{ title: "Evaluación general", note: "Su percepción sobre nuestra relación comercial.", questions: questions.filter((q) => q.block === "general") }, { title: survey.specificTitle, note: survey.specificNote, questions: questions.filter((q) => q.block === "specific") }];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, complete]);

  const payload = { customer, satisfaction: { surveyId, module: survey.name, ratings, additionalComments: comment }, consent };
  function validateCurrent() {
    const next = validateSurveyPayload(payload);
    setErrors(next.errors);
    return next.valid;
  }
  function next() {
    if (step === 0 && (!customer.company.trim() || !customer.contactName.trim())) { validateCurrent(); return; }
    if (step > 0) {
      const unanswered = groups[step - 1].questions.find((question) => ratings[question.key] === undefined);
      if (unanswered) {
        setErrors((current) => ({ ...current, [unanswered.key]: "missing" }));
        document.getElementById(`question-${unanswered.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    setStep((value) => Math.min(value + 1, 2));
  }
  async function submit() {
    const validation = validateSurveyPayload(payload); setErrors(validation.errors); if (!validation.valid) return;
    setSubmitting(true);
    const response = await fetch("/api/responses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({})); setSubmitting(false);
    if (!response.ok) { setErrors(data.errors || { form: "No pudimos enviar la encuesta. Intente nuevamente." }); return; }
    setComplete(true); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (complete) return <section className="survey-shell py-16"><div className="success-panel"><Check size={30}/><h1>Gracias por su tiempo.</h1><p>Su respuesta fue recibida correctamente. En Poleas RP la utilizaremos para seguir mejorando su experiencia.</p></div></section>;

  return <main className="survey-shell py-8 sm:py-12">
    <div className="survey-intro"><p className="eyebrow">Encuesta de satisfacción</p><h1>Su experiencia con <span>Poleas RP</span>.</h1><p>Nos lleva menos de tres minutos. Sus respuestas nos ayudan a mejorar cada compra.</p></div>
    <div className="progress" aria-label={`Paso ${step + 1} de 3`}><span style={{ width: `${((step + 1) / 3) * 100}%` }}/><p>Paso {step + 1} de 3</p></div>
    {step === 0 && <section className="form-section"><p className="eyebrow">Antes de comenzar</p><h2>Datos del cliente</h2><p className="section-copy">Solo pedimos la información necesaria para comprender su respuesta.</p><div className="fields-grid"><Field label="Cliente *" error={errors.company}><input className="field-input" value={customer.company} onChange={(e) => setCustomer({...customer, company:e.target.value})}/></Field><Field label="Responsable encuestado *" error={errors.contactName}><input className="field-input" value={customer.contactName} onChange={(e) => setCustomer({...customer, contactName:e.target.value})}/></Field><Field label="Cargo o sector"><input className="field-input" value={customer.position} onChange={(e) => setCustomer({...customer, position:e.target.value})}/></Field><Field label="Correo electrónico"><input type="email" className="field-input" value={customer.email} onChange={(e) => setCustomer({...customer, email:e.target.value})}/></Field></div><Nav onNext={next}/></section>}
    {step > 0 && <section className="form-section"><p className="eyebrow">Encuesta {survey.name}</p><h2>{groups[step - 1].title}</h2><p className="section-copy">{groups[step - 1].note}</p><div className="questions">{groups[step - 1].questions.map((question) => <Rating key={question.key} question={question} value={ratings[question.key]} error={errors[question.key]} onChange={(value) => setRatings({...ratings, [question.key]: value})}/>)}</div>{step === 2 && <><Field label="¿Desea dejarnos algún comentario adicional?"><textarea className="field-input comment" value={comment} onChange={(e) => setComment(e.target.value)} /></Field><label className="consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}/><span>Acepto que Poleas RP utilice esta información para analizar y mejorar sus productos y servicios.</span></label>{errors.consent && <p className="field-error">{errors.consent}</p>}{errors.form && <p className="form-error"><AlertCircle size={18}/>{errors.form}</p>}</>}<Nav onBack={() => setStep(step - 1)} onNext={step === 2 ? submit : next} submit={step === 2} loading={submitting}/></section>}
  </main>;
}

function Rating({ question, value, error, onChange }: { question: ReturnType<typeof surveyQuestions>[number]; value: RatingValue | undefined; error?: string; onChange: (value: RatingValue) => void }) { return <fieldset className="question" id={`question-${question.key}`}><legend><span>{question.order}</span>{question.label}</legend><RatingSlider label={question.label} value={value} required={question.required} onChange={onChange} onNoAnswer={() => onChange(null)} />{error && <p className="field-error">Respondé esta pregunta o seleccioná “No contestar”.</p>}</fieldset>; }
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}{error && <p className="field-error">{error}</p>}</label>; }
function Nav({ onBack, onNext, submit, loading }: { onBack?: () => void; onNext: () => void; submit?: boolean; loading?: boolean }) { return <div className="form-nav">{onBack && <button type="button" className="secondary-action" onClick={onBack}><ChevronLeft size={18}/> Volver</button>}<button type="button" className="primary-action" onClick={onNext} disabled={loading}>{loading ? <Loader2 className="animate-spin"/> : submit ? <Send size={18}/> : null}{loading ? "Enviando" : submit ? "Enviar respuesta" : <>Continuar <ChevronRight size={18}/></>}</button></div>; }
