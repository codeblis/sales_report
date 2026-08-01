import { db, getSecret } from "@/lib/db";

/**
 * Autenticación: PINs hasheados con HMAC-SHA256 y cookies firmadas.
 * Solo lo importan acciones y páginas server.
 */

let secretCache: string | null = null;

async function secret(): Promise<string> {
  if (secretCache) return secretCache;
  const s = (await getSecret("AUTH_SECRET")) || "dev-secret-change-me";
  secretCache = s;
  return s;
}

async function hmacHex(data: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hash de un PIN de vendedor o de admin. */
export async function hashPin(pin: string): Promise<string> {
  const key = `${await secret()}:pin`;
  return hmacHex(pin, key);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const key = `${await secret()}:pin`;
  const computed = await hmacHex(pin, key);
  if (computed.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

/** Firma un valor para cookie: `valor.firma`. */
export async function signValue(value: string): Promise<string> {
  return `${value}.${await hmacHex(value, await secret())}`;
}

/** Verifica y devuelve el valor firmado, o null si es inválido/expirado. */
export async function verifySigned(raw: string | undefined): Promise<string | null> {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const value = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = await hmacHex(value, await secret());
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? value : null;
}

export const ADMIN_COOKIE = "rv_admin";
const ADMIN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SELLER_COOKIE_PREFIX = "rv_seller_";
const SELLER_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Valor de cookie de sesión admin: `expiresAtUnixMs`. */
export async function makeAdminToken(): Promise<string> {
  return signValue(String(Date.now() + ADMIN_TTL_MS));
}

export async function checkAdminToken(raw: string | undefined): Promise<boolean> {
  const v = await verifySigned(raw);
  if (!v) return false;
  const exp = Number(v);
  return Number.isFinite(exp) && exp > Date.now();
}

/** Cookie de vendedor: `sellerId|expiresAt`, firmada. */
export function sellerCookieName(token: string): string {
  return SELLER_COOKIE_PREFIX + token;
}

export async function makeSellerToken(sellerId: string): Promise<string> {
  return signValue(`${sellerId}|${Date.now() + SELLER_TTL_MS}`);
}

export async function checkSellerToken(raw: string | undefined, sellerId: string): Promise<boolean> {
  const v = await verifySigned(raw);
  if (!v) return false;
  const pipe = v.indexOf("|");
  if (pipe <= 0) return false;
  const id = v.slice(0, pipe);
  const exp = Number(v.slice(pipe + 1));
  return id === sellerId && Number.isFinite(exp) && exp > Date.now();
}

/* ---------- Rate limit de intentos de PIN ---------- */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function tooManyAttempts(ip: string): Promise<boolean> {
  const d = await db();
  const now = Date.now();
  await d
    .prepare("DELETE FROM login_attempts WHERE ts < ?1")
    .bind(now - 60 * 60 * 1000)
    .run();
  const row = await d
    .prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ?1 AND ts > ?2")
    .bind(ip, now - WINDOW_MS)
    .first<{ n: number }>();
  return (row?.n ?? 0) >= MAX_ATTEMPTS;
}

export async function recordAttempt(ip: string): Promise<void> {
  const d = await db();
  await d.prepare("INSERT INTO login_attempts (ip, ts) VALUES (?1, ?2)").bind(ip, Date.now()).run();
}

/** IP del request, tolerante a proxies. */
export function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf;
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "local";
}
