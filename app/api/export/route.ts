import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listResponses } from "@/lib/store";
import { surveyQuestions } from "@/lib/constants";

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

export async function GET(request: Request) {
  try {
    requireAdmin();
    const url = new URL(request.url);
    const responses = await listResponses(Object.fromEntries(url.searchParams.entries()));
    const questions = Array.from(new Map(["venta", "distribuidores", "agroindustria", "oil-gas", "servicios-industriales"].flatMap((id) => surveyQuestions(id).map((question) => [question.key, question]))).values());
    const header = ["fecha", "segmento", "modulo", "razon_social", "nombre_y_apellido", "cargo_sector", "email", "telefono", ...questions.map((question) => question.label), "comentario"];
    const rows = responses.map((item) => [
      item.createdAt,
      item.satisfaction.surveyId,
      item.satisfaction.module,
      item.customer.company,
      item.customer.contactName,
      item.customer.position,
      item.customer.email,
      item.customer.phone,
      ...questions.map((question) => item.satisfaction.ratings[question.key] ?? ""),
      item.satisfaction.additionalComments
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"encuesta-poleas-rp.csv\""
      }
    });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}
