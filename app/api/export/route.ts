import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listResponses } from "@/lib/store";

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

export async function GET(request: Request) {
  try {
    requireAdmin();
    const url = new URL(request.url);
    const responses = await listResponses(Object.fromEntries(url.searchParams.entries()));
    const header = [
      "fecha",
      "fecha", "modulo", "cliente", "responsable_encuestado", "cargo_sector", "email", "telefono",
      "calidad_productos", "atencion_comercial", "plazos_entrega", "informacion_tecnica", "reclamos", "logistica", "packaging", "ultima_compra", "comentario"
    ];
    const rows = responses.map((item) => [
      item.createdAt,
      item.satisfaction.module,
      item.customer.company,
      item.customer.contactName,
      item.customer.position,
      item.customer.email,
      item.customer.phone,
      ...Object.values(item.satisfaction.ratings),
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
