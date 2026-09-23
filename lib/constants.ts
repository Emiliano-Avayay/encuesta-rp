import type { RatingValue, SatisfactionKey } from "@/lib/types";

export const ratingOptions: Array<{ value: Exclude<RatingValue, null>; label: string }> = [
  { value: 1, label: "Malo" }, { value: 2, label: "Regular" }, { value: 3, label: "Bueno" }, { value: 4, label: "Muy bueno" }, { value: 5, label: "Excelente" }
];
export const notEvaluableLabel = "No contestar";
export const ratingLabel = (value: RatingValue) => value === null ? notEvaluableLabel : ratingOptions.find((item) => item.value === value)?.label || "-";
export type SurveyQuestion = { key: SatisfactionKey; label: string; block: "general" | "specific"; order: number; required: boolean; active: boolean };
export const generalQuestions: SurveyQuestion[] = [
  { key: "productQuality", label: "Calidad general de los productos", block: "general", order: 1, required: true, active: true },
  { key: "commercialAttention", label: "Atención comercial o técnico-comercial", block: "general", order: 2, required: true, active: true },
  { key: "deliveryDeadlines", label: "Plazos de entrega", block: "general", order: 3, required: true, active: true },
  { key: "technicalInformation", label: "Información técnica y catálogo", block: "general", order: 4, required: true, active: true },
  { key: "claimResponse", label: "Respuesta ante reclamos o inconvenientes", block: "general", order: 5, required: true, active: true }
];
const ventaQuestions: SurveyQuestion[] = [
  { key: "logistics", label: "¿Cómo evalúa el servicio de logística?", block: "specific", order: 6, required: true, active: true },
  { key: "packaging", label: "¿Qué le pareció el embalaje / packaging del producto?", block: "specific", order: 7, required: true, active: true },
  { key: "lastPurchase", label: "¿Qué tan satisfecho está con su última compra realizada a Poleas RP?", block: "specific", order: 8, required: true, active: true }
];
export const surveys = [
  { id:"venta", slug:"venta", name:"Venta", active:true, specificTitle:"Evaluación de la compra", specificNote:"Su experiencia en la última compra realizada.", specificQuestions:ventaQuestions },
  { id:"distribuidores", slug:"distribuidores", name:"Distribuidores", active:false, specificTitle:"", specificNote:"", specificQuestions:[] },
  { id:"oil-gas", slug:"oil-gas", name:"Oil & Gas", active:false, specificTitle:"", specificNote:"", specificQuestions:[] },
  { id:"agroindustria", slug:"agroindustria", name:"Agroindustria", active:false, specificTitle:"", specificNote:"", specificQuestions:[] },
  { id:"servicios-industriales", slug:"servicios-industriales", name:"Servicios industriales", active:false, specificTitle:"", specificNote:"", specificQuestions:[] }
] as const;
export const getSurvey = (id: string) => surveys.find((survey) => survey.id === id);
export const surveyQuestions = (id: string) => { const survey = getSurvey(id); return survey ? [...generalQuestions, ...survey.specificQuestions] : []; };
export const satisfactionQuestions = surveyQuestions("venta");
