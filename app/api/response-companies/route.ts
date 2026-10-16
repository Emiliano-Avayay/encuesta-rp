import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listResponses } from "@/lib/store";

// The company catalog intentionally has no UI filters. In particular, it must
// not be built from responses that were already narrowed by `company`.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    requireAdmin();
    const companies = Array.from(
      new Set(
        (await listResponses())
          .map((response) => response.customer.company)
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right, "es"));
    return NextResponse.json({ companies });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("Unable to list response companies", error);
    return NextResponse.json({ error: "No se pudieron cargar las razones sociales." }, { status: 500 });
  }
}
