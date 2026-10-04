"use client";

import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getSurvey, surveyQuestions } from "@/lib/constants";
import { RatingSlider } from "@/components/RatingSlider";
import { StarRating } from "@/components/StarRating";
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
  const [isDataUseModalOpen, setIsDataUseModalOpen] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const dataUseLinkRef = useRef<HTMLButtonElement>(null);
  const modalCloseRef = useRef<HTMLButtonElement>(null);
  const groups = [{ title: "Evaluación general", note: "Su percepción sobre nuestra relación comercial.", questions: questions.filter((q) => q.block === "general") }, { title: survey.specificTitle, note: survey.specificNote, questions: questions.filter((q) => q.block === "specific") }];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, complete]);

  // Keep the existing technical consent value for storage compatibility. Submission is
  // now the affirmative action, after the notice displayed immediately above it.
  const payload = { customer, satisfaction: { surveyId, module: survey.name, ratings, additionalComments: comment }, consent: true };

  function closeDataUseModal() {
    setIsDataUseModalOpen(false);
    window.setTimeout(() => dataUseLinkRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!isDataUseModalOpen) return;
    modalCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDataUseModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDataUseModalOpen]);
  function validateCurrent() {
    const next = validateSurveyPayload(payload);
    setErrors(next.errors);
    return next.valid;
  }
  function next() {
    if (step === 0 && (!customer.company.trim() || !customer.contactName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim()))) { validateCurrent(); return; }
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
  if (complete) return <section className="survey-shell py-16"><div className="success-panel"><Check size={30}/><h1>Gracias por su tiempo.</h1><p>Su respuesta fue recibida correctamente. En RP Poleas la utilizaremos para seguir mejorando su experiencia.</p></div></section>;

  return <main className="survey-shell py-8 sm:py-12">
    <div className="survey-intro"><p className="eyebrow">Encuesta de satisfacción</p><h1>Su experiencia con <br/><span>RP Poleas</span>.</h1><p>Lleva entre 3 y 5 minutos. Sus respuestas nos ayudan a mejorar cada compra.</p></div>
    <div className="progress" aria-label={`Paso ${step + 1} de 3`}><span style={{ width: `${((step + 1) / 3) * 100}%` }}/><p>Paso {step + 1} de 3</p></div>
    {step === 0 && <section className="form-section"><p className="eyebrow">Antes de comenzar</p><h2>Datos del cliente</h2><div className="fields-grid"><Field label="Razón social *" error={errors.company}><input className="field-input" value={customer.company} onChange={(e) => setCustomer({...customer, company:e.target.value})}/></Field><Field label="Nombre y Apellido *" error={errors.contactName}><input className="field-input" value={customer.contactName} onChange={(e) => setCustomer({...customer, contactName:e.target.value})}/></Field><Field label="Cargo o sector"><input className="field-input" value={customer.position} onChange={(e) => setCustomer({...customer, position:e.target.value})}/></Field><Field label="Correo electrónico *" error={errors.email}><input type="email" required className="field-input" value={customer.email} onChange={(e) => setCustomer({...customer, email:e.target.value})}/></Field></div><Nav onNext={next}/></section>}
    {step > 0 && <section className="form-section"><h2>{groups[step - 1].title}</h2><p className="section-copy">{groups[step - 1].note}</p><div className="questions">{groups[step - 1].questions.map((question) => <Rating key={question.key} question={question} value={ratings[question.key]} error={errors[question.key]} onChange={(value) => setRatings({...ratings, [question.key]: value})}/>)}</div>{step === 2 && <><Field label="¿Desea dejarnos algún comentario adicional?"><textarea className="field-input comment" value={comment} onChange={(e) => setComment(e.target.value)} /></Field><DataUseNotice onOpen={() => setIsDataUseModalOpen(true)} linkRef={dataUseLinkRef}/>{errors.form && <p className="form-error"><AlertCircle size={18}/>{errors.form}</p>}</>}<Nav onBack={() => setStep(step - 1)} onNext={step === 2 ? submit : next} submit={step === 2} loading={submitting}/></section>}
    {isDataUseModalOpen && (
      <DataUseModal closeRef={modalCloseRef} onClose={closeDataUseModal}/>
    )}
  </main>;
}

function Rating({ question, value, error, onChange }: { question: ReturnType<typeof surveyQuestions>[number]; value: RatingValue | undefined; error?: string; onChange: (value: RatingValue) => void }) { return <fieldset className="question" id={`question-${question.key}`}><legend><span>{question.order}</span>{question.label}</legend>{question.block === "specific" ? <StarRating questionId={question.key} label={question.label} value={value} required={question.required} onChange={onChange} onNoAnswer={() => onChange(null)} /> : <RatingSlider label={question.label} options={question.ratingOptions} value={value} required={question.required} onChange={onChange} onNoAnswer={() => onChange(null)} />}{error && <p className="field-error">Respondé esta pregunta o seleccioná “Prefiero no responder”.</p>}</fieldset>; }
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}{error && <p className="field-error">{error}</p>}</label>; }
function DataUseNotice({ onOpen, linkRef }: { onOpen: () => void; linkRef: React.RefObject<HTMLButtonElement> }) { return <aside className="data-use-notice" aria-label="Información sobre el uso de datos"><p>Al finalizar esta encuesta, autorizás a RP Poleas a utilizar la información proporcionada para analizar tu experiencia y mejorar nuestros productos, servicios y atención.</p><button ref={linkRef} type="button" className="data-use-link" onClick={onOpen}>Más información sobre el uso de tus datos</button></aside>; }
function DataUseModal({ onClose, closeRef }: { onClose: () => void; closeRef: React.RefObject<HTMLButtonElement> }) { return <div className="data-use-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="data-use-modal" role="dialog" aria-modal="true" aria-labelledby="data-use-modal-title"><button ref={closeRef} type="button" className="modal-close" onClick={onClose} aria-label="Cerrar información sobre el uso de datos"><X size={20}/></button><h2 id="data-use-modal-title">Uso de tus datos</h2><div className="data-use-modal-content"><h3>¿Para qué utilizamos esta información?</h3><p>La información proporcionada en esta encuesta será utilizada por RP Poleas para analizar la experiencia de sus clientes y detectar oportunidades de mejora.</p><p>Las respuestas podrán ser utilizadas para mejorar nuestros productos, servicios, atención comercial, soporte, logística y otros procesos relacionados con la experiencia del cliente.</p><h3>Información proporcionada</h3><p>Los datos ingresados, como razón social, nombre y apellido, correo electrónico y respuestas de la encuesta, serán utilizados en relación con el análisis y seguimiento de la experiencia del cliente.</p><h3>Seguimiento</h3><p>Cuando resulte necesario, RP Poleas podrá utilizar los datos de contacto proporcionados para realizar un seguimiento relacionado con los comentarios o respuestas brindadas en la encuesta.</p><h3>Análisis interno</h3><p>Los resultados podrán ser analizados de forma individual o agrupada por personal autorizado de RP Poleas con el objetivo de identificar tendencias, problemas y oportunidades de mejora.</p></div><button type="button" className="primary-action modal-confirm" onClick={onClose}>Entendido</button></section></div>; }
function Nav({ onBack, onNext, submit, loading }: { onBack?: () => void; onNext: () => void; submit?: boolean; loading?: boolean }) { return <div className="form-nav">{onBack && <button type="button" className="secondary-action" onClick={onBack}><ChevronLeft size={18}/> Volver</button>}<button type="button" className="primary-action" onClick={onNext} disabled={loading}>{loading ? <Loader2 className="animate-spin"/> : submit ? <Send size={18}/> : null}{loading ? "Enviando" : submit ? "Finalizar encuesta" : <>Continuar <ChevronRight size={18}/></>}</button></div>; }
