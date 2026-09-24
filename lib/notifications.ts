import nodemailer from "nodemailer";
import { ratingLabel, surveyQuestions } from "@/lib/constants";
import type { SurveyResponse } from "@/lib/types";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

function recipients() {
  return (process.env.NOTIFICATION_EMAIL || "").split(",").map((email) => email.trim()).filter(Boolean);
}

function isConfigured() {
  return Boolean(
    recipients().length
    && process.env.NOTIFICATION_FROM
    && process.env.SMTP_HOST
    && process.env.SMTP_USER
    && process.env.SMTP_PASSWORD
  );
}

/** Sends a best-effort internal notification after a response is persisted. */
export async function notifySurveyResponse(response: SurveyResponse) {
  if (!isConfigured()) return false;

  const questions = surveyQuestions(response.satisfaction.surveyId);
  const ratings = questions.map((question) => ({
    label: question.label,
    value: ratingLabel(response.satisfaction.ratings[question.key])
  }));
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  const panelUrl = appUrl ? `${appUrl}/staff-rp/respuestas` : undefined;
  const text = [
    "Se recibió una nueva respuesta de encuesta.",
    `Cliente: ${response.customer.company}`,
    `Responsable: ${response.customer.contactName}`,
    response.customer.position ? `Cargo o sector: ${response.customer.position}` : "",
    response.customer.email ? `Correo: ${response.customer.email}` : "",
    `Encuesta: ${response.satisfaction.module}`,
    ...ratings.map((rating) => `${rating.label}: ${rating.value}`),
    response.satisfaction.additionalComments ? `Comentario: ${response.satisfaction.additionalComments}` : "",
    panelUrl ? `Ver panel: ${panelUrl}` : ""
  ].filter(Boolean).join("\n");
  const html = `
    <h2>Nueva respuesta de encuesta</h2>
    <p><strong>Cliente:</strong> ${escapeHtml(response.customer.company)}<br>
    <strong>Responsable:</strong> ${escapeHtml(response.customer.contactName)}<br>
    ${response.customer.position ? `<strong>Cargo o sector:</strong> ${escapeHtml(response.customer.position)}<br>` : ""}
    ${response.customer.email ? `<strong>Correo:</strong> ${escapeHtml(response.customer.email)}<br>` : ""}
    <strong>Encuesta:</strong> ${escapeHtml(response.satisfaction.module)}</p>
    <h3>Valoraciones</h3>
    <ul>${ratings.map((rating) => `<li><strong>${escapeHtml(rating.label)}:</strong> ${escapeHtml(rating.value)}</li>`).join("")}</ul>
    ${response.satisfaction.additionalComments ? `<p><strong>Comentario:</strong><br>${escapeHtml(response.satisfaction.additionalComments).replace(/\n/g, "<br>")}</p>` : ""}
    ${panelUrl ? `<p><a href="${escapeHtml(panelUrl)}">Ver respuestas en el panel</a></p>` : ""}
  `;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000
  });
  await transporter.sendMail({
    from: process.env.NOTIFICATION_FROM,
    to: recipients().join(", "),
    replyTo: response.customer.email || undefined,
    subject: `Nueva encuesta: ${response.customer.company}`,
    text,
    html
  });
  return true;
}
