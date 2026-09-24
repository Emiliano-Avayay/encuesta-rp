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
  const ratingRows = ratings.map((rating, index) => `
    <tr>
      <td style="padding:14px 0; border-bottom:${index === ratings.length - 1 ? "0" : "1px solid #ebe8e4"}; color:#4d4d4d; font-family:Arial,sans-serif; font-size:14px; line-height:20px;">${escapeHtml(rating.label)}</td>
      <td align="right" style="padding:14px 0; border-bottom:${index === ratings.length - 1 ? "0" : "1px solid #ebe8e4"}; font-family:Arial,sans-serif; font-size:13px; font-weight:700; white-space:nowrap;"><span style="display:inline-block; border-radius:999px; background:#fff1e6; color:#d95e0b; padding:6px 10px;">${escapeHtml(rating.value)}</span></td>
    </tr>`).join("");
  const detailRows = [
    ["Cliente", response.customer.company],
    ["Responsable", response.customer.contactName],
    response.customer.position ? ["Cargo o sector", response.customer.position] : null,
    response.customer.email ? ["Correo", response.customer.email] : null,
    ["Encuesta", response.satisfaction.module]
  ].filter((row): row is [string, string] => Boolean(row)).map(([label, value]) => `
    <tr><td style="padding:4px 0; color:#89847e; font-family:Arial,sans-serif; font-size:13px; width:122px;">${escapeHtml(label)}</td><td style="padding:4px 0; color:#303030; font-family:Arial,sans-serif; font-size:14px; font-weight:700;">${escapeHtml(value)}</td></tr>`).join("");
  const html = `<!doctype html>
  <html lang="es"><body style="margin:0; padding:0; background:#f5f4f2;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f4f2;"><tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px; background:#ffffff; border-radius:12px; overflow:hidden;">
        <tr><td style="padding:24px 32px; background:#4d4d4d;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td style="font-family:Arial,sans-serif; font-size:18px; font-weight:800; letter-spacing:.8px; color:#ffffff;">POLEAS <span style="color:#ff771c;">RP</span></td>
            <td align="right" style="font-family:Arial,sans-serif; font-size:11px; font-weight:700; letter-spacing:1px; color:#d6d3cf;">NUEVA RESPUESTA</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px; color:#ff771c; font-family:Arial,sans-serif; font-size:11px; font-weight:800; letter-spacing:1.4px;">ENCUESTA DE SATISFACCIÓN</p>
          <h1 style="margin:0 0 24px; color:#303030; font-family:Arial,sans-serif; font-size:27px; line-height:34px;">Llegó una nueva respuesta</h1>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; border-left:4px solid #ff771c; background:#fbfaf8;"><tr><td style="padding:16px 18px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${detailRows}</table></td></tr></table>
          <h2 style="margin:0 0 8px; color:#303030; font-family:Arial,sans-serif; font-size:18px; line-height:25px;">Valoraciones recibidas</h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">${ratingRows}</table>
          ${response.satisfaction.additionalComments ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#fff7f1;"><tr><td style="padding:16px 18px;"><p style="margin:0 0 6px; color:#d95e0b; font-family:Arial,sans-serif; font-size:11px; font-weight:800; letter-spacing:1.1px;">COMENTARIO</p><p style="margin:0; color:#4d4d4d; font-family:Arial,sans-serif; font-size:14px; line-height:21px;">${escapeHtml(response.satisfaction.additionalComments).replace(/\n/g, "<br>")}</p></td></tr></table>` : ""}
          ${panelUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:4px; background:#ff771c;"><a href="${escapeHtml(panelUrl)}" style="display:inline-block; padding:13px 18px; color:#ffffff; font-family:Arial,sans-serif; font-size:13px; font-weight:800; letter-spacing:.3px; text-decoration:none;">VER RESPUESTAS EN EL PANEL →</a></td></tr></table>` : ""}
        </td></tr>
        <tr><td style="padding:18px 32px; border-top:1px solid #ebe8e4; color:#89847e; font-family:Arial,sans-serif; font-size:11px; line-height:16px;">Notificación automática de Encuestas RP Poleas.</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

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
