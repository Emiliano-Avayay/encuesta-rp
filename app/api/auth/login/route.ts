import { NextResponse } from "next/server";
import { setAdminCookie, validateAdminCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || "");
  const password = String(body.password || "");

  if (!validateAdminCredentials(username, password)) {
    return NextResponse.json({ error: "Usuario o contrasena incorrectos." }, { status: 401 });
  }

  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const secure = new URL(request.url).protocol === "https:" || forwardedProtocol === "https";
  await setAdminCookie(username, secure);
  return NextResponse.json({ ok: true });
}
