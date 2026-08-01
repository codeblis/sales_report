"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_COOKIE,
  checkAdminToken,
  clientIp,
  hashPin,
  makeAdminToken,
  recordAttempt,
  tooManyAttempts,
  verifyPin,
} from "@/lib/auth";
import { getSettings, hasAdminPin, setSetting } from "@/lib/settings";

const PIN_RE = /^\d{4,6}$/;
const SECURE = process.env.NODE_ENV === "production";

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: SECURE,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export async function requireAdmin(): Promise<boolean> {
  const c = await cookies();
  return checkAdminToken(c.get(ADMIN_COOKIE)?.value);
}

/** Primer arranque: define el PIN de administrador e inicia sesión. */
export async function createAdminPin(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  if (await hasAdminPin()) return { error: "El PIN de administrador ya está creado." };
  const pin = String(formData.get("pin") ?? "").trim();
  const pin2 = String(formData.get("pin2") ?? "").trim();
  if (!PIN_RE.test(pin)) return { error: "El PIN tiene que tener entre 4 y 6 dígitos." };
  if (pin !== pin2) return { error: "Los PIN no coinciden." };
  await setSetting("admin_pin_hash", await hashPin(pin));
  const c = await cookies();
  c.set(ADMIN_COOKIE, await makeAdminToken(), sessionCookieOptions());
  redirect("/panel");
}

export async function loginAdmin(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const h = await headers();
  const ip = clientIp(h);
  if (await tooManyAttempts(ip)) {
    return { error: "Demasiados intentos. Espera 15 minutos y vuelve a intentar." };
  }
  const pin = String(formData.get("pin") ?? "").trim();
  if (!PIN_RE.test(pin)) return { error: "El PIN tiene que tener entre 4 y 6 dígitos." };
  const s = await getSettings();
  if (!s.admin_pin_hash) {
    return { error: "Primero crea el PIN de administrador en el primer arranque." };
  }
  if (!(await verifyPin(pin, s.admin_pin_hash))) {
    await recordAttempt(ip);
    return { error: "PIN incorrecto." };
  }
  const c = await cookies();
  c.set(ADMIN_COOKIE, await makeAdminToken(), sessionCookieOptions());
  redirect("/panel");
}

export async function logout(): Promise<void> {
  const c = await cookies();
  c.delete(ADMIN_COOKIE);
  redirect("/login");
}

export async function changeAdminPin(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  if (!(await requireAdmin())) return { error: "Sesión inválida." };
  const s = await getSettings();
  if (!s.admin_pin_hash) return { error: "No hay PIN de administrador." };
  const actual = String(formData.get("actual") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  const pin2 = String(formData.get("pin2") ?? "").trim();
  if (!(await verifyPin(actual, s.admin_pin_hash))) return { error: "PIN actual incorrecto." };
  if (!PIN_RE.test(pin)) return { error: "El PIN tiene que tener entre 4 y 6 dígitos." };
  if (pin !== pin2) return { error: "Los PIN no coinciden." };
  await setSetting("admin_pin_hash", await hashPin(pin));
  return { ok: true };
}

export async function updateSettings(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  if (!(await requireAdmin())) return { error: "Sesión inválida." };
  const simbolo =
    String(formData.get("moneda_simbolo") ?? "$")
      .trim()
      .slice(0, 4) || "$";
  const codigo = String(formData.get("moneda_codigo") ?? "")
    .trim()
    .slice(0, 8);
  await setSetting("moneda_simbolo", simbolo);
  await setSetting("moneda_codigo", codigo);
  revalidatePath("/panel/ajustes");
  revalidatePath("/panel", "layout");
  return { ok: true };
}
