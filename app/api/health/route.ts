import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Container health endpoint. It deliberately exposes no application data. */
export async function GET() {
  try {
    await checkDatabase();
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
