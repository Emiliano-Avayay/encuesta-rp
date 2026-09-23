import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getResponse } from "@/lib/store";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    requireAdmin();
    const response = await getResponse(params.id);
    if (!response) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    return NextResponse.json({ response });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}
