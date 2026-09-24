import { NextResponse } from "next/server";
import { createSurveyResponse, listResponses } from "@/lib/store";
import { requireAdmin } from "@/lib/auth";
import { notifySurveyResponse } from "@/lib/notifications";
import { validateSurveyPayload } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    requireAdmin();
    const url = new URL(request.url);
    const responses = await listResponses(Object.fromEntries(url.searchParams.entries()));
    return NextResponse.json({ responses });
  } catch (error) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  let payload: any;
  try {
    payload = body;
  } catch {
    return NextResponse.json({ errors: { form: "No pudimos interpretar los datos enviados." } }, { status: 400 });
  }

  const validation = validateSurveyPayload(payload);
  if (!validation.valid) return NextResponse.json({ errors: validation.errors }, { status: 400 });

  try {
    const response = await createSurveyResponse(payload);
    try {
      await notifySurveyResponse(response);
    } catch (error) {
      // Notifications must never make an already persisted survey fail.
      console.error("Unable to send survey notification", error);
    }
    return NextResponse.json({ response }, { status: 201 });
  } catch (error: any) {
    const message = String(error?.message || "");
    return NextResponse.json({ errors: { form: "No se pudo guardar la respuesta. Intenta nuevamente." } }, { status: 500 });
  }
}
