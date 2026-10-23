import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createFollowUp, FollowUpError, listFollowUp } from "@/lib/follow-up";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { requireAdmin(); return NextResponse.json({ companies: await listFollowUp() }); } catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  try {
    const session = requireAdmin();
    return NextResponse.json({ company: await createFollowUp(await request.json(), session.username) }, { status: 201 });
  } catch (error) { return fail(error); }
}

function fail(error: unknown) {
  if (error instanceof FollowUpError) return NextResponse.json({ error: error.message, fields: error.fields }, { status: error.status });
  if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  console.error("Follow-up request failed", error);
  return NextResponse.json({ error: "No se pudo procesar la solicitud." }, { status: 500 });
}
