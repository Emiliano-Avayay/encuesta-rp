import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { FollowUpError, followUpHistory, getFollowUp, suggestedResponses, updateFollowUp } from "@/lib/follow-up";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET devuelve el detalle: historial de cambios y respuestas candidatas (solo por correo exacto).
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    requireAdmin();
    const company = await getFollowUp(params.id);
    if (!company) throw new FollowUpError("Empresa no encontrada.", 404);
    return NextResponse.json({ company, history: await followUpHistory(company.id), suggestions: await suggestedResponses(company) });
  } catch (error) { return fail(error); }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = requireAdmin();
    if (!(await getFollowUp(params.id))) throw new FollowUpError("Empresa no encontrada.", 404);
    return NextResponse.json({ company: await updateFollowUp(params.id, await request.json(), session.username) });
  } catch (error) { return fail(error); }
}

function fail(error: unknown) {
  if (error instanceof FollowUpError) return NextResponse.json({ error: error.message, fields: error.fields }, { status: error.status });
  if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  console.error("Follow-up request failed", error);
  return NextResponse.json({ error: "No se pudo procesar la solicitud." }, { status: 500 });
}
