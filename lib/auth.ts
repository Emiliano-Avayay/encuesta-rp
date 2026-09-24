import { cookies } from "next/headers";
import { createHmac, pbkdf2Sync, timingSafeEqual } from "node:crypto";

const cookieName = "fl_admin_session";
const ttlMs = 8 * 60 * 60 * 1000;

type SessionPayload = {
  username: string;
  exp: number;
};

function secret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required in production");
  return "demo-auth-secret-change-before-production";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function encode(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token?: string): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature || sign(body) !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function verifyPbkdf2(password: string, stored: string) {
  const [algo, iterations, salt, hash] = stored.split("$");
  if (algo !== "pbkdf2" || !iterations || !salt || !hash) return false;
  const calculated = pbkdf2Sync(password, salt, Number(iterations), 32, "sha256");
  const expected = Buffer.from(hash, "base64url");
  return expected.length === calculated.length && timingSafeEqual(expected, calculated);
}

export function makePasswordHash(password: string) {
  const salt = crypto.randomUUID();
  const iterations = 120000;
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

export function validateAdminCredentials(username: string, password: string) {
  const envUser = process.env.ADMIN_USERNAME;
  const envHash = process.env.ADMIN_PASSWORD_HASH;

  if (envUser && envHash) {
    return username === envUser && verifyPbkdf2(password, envHash);
  }

  return process.env.NODE_ENV !== "production" && username === "admin" && password === "admin";
}

export async function setAdminCookie(username: string) {
  const payload = { username, exp: Date.now() + ttlMs };
  cookies().set(cookieName, encode(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttlMs / 1000
  });
}

export async function clearAdminCookie() {
  cookies().set(cookieName, "", { path: "/", maxAge: 0 });
}

export function getSessionFromCookies() {
  return decode(cookies().get(cookieName)?.value);
}

export function requireAdmin() {
  const session = getSessionFromCookies();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
