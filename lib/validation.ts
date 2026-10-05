import { getSurvey, visibleQuestions } from "@/lib/constants";
import type { AnswerValue, CustomerData, SatisfactionData } from "@/lib/types";
export type ValidationErrors = Record<string, string>;
export function cleanText(value: unknown, max = 1200) { return typeof value === "string" ? value.replace(/[<>]/g, "").trim().slice(0, max) : ""; }
const validEmail = (email: unknown) => typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
function validAnswer(value: unknown, question: ReturnType<typeof visibleQuestions>[number]) {
  if (value === null) return true;
  if (question.kind === "slider") return Number.isInteger(value) && typeof value === "number" && value >= (question.key === "venta.purchaseSatisfaction" ? 0 : 1) && value <= 5;
  if (question.kind === "stars") return Number.isInteger(value) && typeof value === "number" && value >= 1 && value <= 5;
  if (question.kind === "yesNo") return value === "yes" || value === "no";
  if (question.kind === "number") return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3650;
  return typeof value === "string" && value.trim().length > 0 && value.length <= 2400;
}
export function validateSurveyPayload(payload: any) {
  const errors: ValidationErrors = {}; const customer = payload?.customer as CustomerData | undefined; const satisfaction = payload?.satisfaction as SatisfactionData | undefined;
  if (!customer?.company?.trim()) errors.company = "La razón social es obligatoria.";
  if (!customer?.contactName?.trim()) errors.contactName = "El nombre y apellido es obligatorio.";
  if (!validEmail(customer?.email)) errors.email = "Ingresá un correo electrónico válido.";
  const survey = getSurvey(satisfaction?.surveyId || "");
  if (!survey?.active || satisfaction?.module !== survey.name) errors.form = "La encuesta no es válida o no está activa.";
  const ratings = satisfaction?.ratings || {};
  const allowed = new Set(visibleQuestions(satisfaction?.surveyId || "", ratings).map((question) => question.key));
  for (const key of Object.keys(ratings)) if (!allowed.has(key)) errors.form = "La encuesta contiene respuestas que no corresponden al segmento.";
  for (const question of visibleQuestions(satisfaction?.surveyId || "", ratings)) {
    const value = ratings[question.key] as AnswerValue | undefined;
    if (value === undefined || (question.required && !validAnswer(value, question)) || (!question.required && value !== undefined && value !== "" && !validAnswer(value, question))) errors[question.key] = "Respondé esta pregunta o seleccioná “Prefiero no responder”.";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
