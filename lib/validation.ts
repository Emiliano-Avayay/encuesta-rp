import { getSurvey, surveyQuestions } from "@/lib/constants";
import type { CustomerData, RatingValue, SatisfactionData } from "@/lib/types";

export type ValidationErrors = Record<string, string>;

export function cleanText(value: unknown, max = 1200) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").trim().slice(0, max);
}

function isValidRating(value: unknown): value is RatingValue {
  return value === null || (Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5);
}

export function validateSurveyPayload(payload: any) {
  const errors: ValidationErrors = {};
  const customer = payload?.customer as CustomerData | undefined;
  const satisfaction = payload?.satisfaction as SatisfactionData | undefined;
  if (!customer?.company?.trim()) errors.company = "El cliente es obligatorio.";
  if (!customer?.contactName?.trim()) errors.contactName = "El responsable encuestado es obligatorio.";
  if (!payload?.consent) errors.consent = "Debes aceptar el uso de la informacion para continuar.";

  const survey = getSurvey(satisfaction?.surveyId || "");
  if (!survey?.active || satisfaction?.module !== survey.name) errors.form = "La encuesta no es válida o no está activa.";
  for (const question of surveyQuestions(satisfaction?.surveyId || "")) {
    if (!isValidRating(satisfaction?.ratings?.[question.key])) errors[question.key] = "Selecciona una valoración.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
