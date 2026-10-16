import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listResponses } from "@/lib/store";
import { responseCompanies } from "@/lib/response-companies";

// The company catalog intentionally has no UI filters. In particular, it must
// not be built from responses that were already narrowed by `company`.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireAdmin();
    const surveyId = new URL(request.url).searchParams.get("surveyId") || "all";
    // Do not pass any other request filters to this query. In particular, the
    // catalog must remain available if the current result list is empty.
    const companies = responseCompanies(await listResponses(), surveyId);
    return NextResponse.json({ companies });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("Unable to list response companies", error);
    return NextResponse.json({ error: "No se pudieron cargar las razones sociales." }, { status: 500 });
  }
}
