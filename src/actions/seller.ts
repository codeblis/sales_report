"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

import {
  checkSellerToken,
  clientIp,
  makeSellerToken,
  recordAttempt,
  sellerCookieName,
  tooManyAttempts,
  verifyPin,
} from "@/lib/auth";
import { lineStates, sellerLines } from "@/lib/calculos";
import { db, newId } from "@/lib/db";
import { todayISO } from "@/lib/format";
import { getSellerByToken, loadSnapshot } from "@/lib/repo";

const SECURE = process.env.NODE_ENV === "production";

function sellerCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: SECURE,
    path: "/v",
    maxAge: 60 * 60 * 24 * 90,
  };
}

async function currentSeller(token: string) {
  const seller = await getSellerByToken(token);
  if (seller?.activo !== 1) return null;
  const c = await cookies();
  const ok = await checkSellerToken(c.get(sellerCookieName(token))?.value, seller.id);
  return ok ? seller : null;
}

export type SellerLoginResult = { error?: string };

export async function sellerLogin(_prev: SellerLoginResult, formData: FormData): Promise<SellerLoginResult> {
  // El enlace del vendedor es público y el PIN tiene 4 dígitos: sin límite de
  // intentos se adivina por fuerza bruta, igual que en el acceso de admin.
  // El contador va con prefijo propio para que un vendedor que se equivoca de
  // PIN no deje al administrador fuera del panel desde la misma conexión.
  const bucket = `v:${clientIp(await headers())}`;
  if (await tooManyAttempts(bucket)) {
    return { error: "Demasiados intentos. Espera 15 minutos y vuelve a intentar." };
  }
  const token = String(formData.get("token") ?? "");
  const pin = String(formData.get("pin") ?? "").trim();
  const seller = await getSellerByToken(token);
  if (seller?.activo !== 1) {
    await recordAttempt(bucket);
    return { error: "Enlace inválido." };
  }
  if (!(await verifyPin(pin, seller.pin_hash))) {
    await recordAttempt(bucket);
    return { error: "PIN incorrecto." };
  }
  const c = await cookies();
  c.set(sellerCookieName(token), await makeSellerToken(seller.id), sellerCookieOptions());
  const d = await db();
  await d
    .prepare("UPDATE sellers SET last_login = ?1 WHERE id = ?2")
    .bind(new Date().toISOString(), seller.id)
    .run();
  revalidatePath(`/v/${token}`);
  return {};
}

export async function sellerLogout(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const c = await cookies();
  c.delete(sellerCookieName(token));
  revalidatePath(`/v/${token}`);
}

export type SaleResult = { error?: string; ok?: boolean };

export async function reportSale(_prev: SaleResult, formData: FormData): Promise<SaleResult> {
  const token = String(formData.get("token") ?? "");
  const seller = await currentSeller(token);
  if (!seller) return { error: "Sesión inválida. Vuelve a entrar con tu PIN." };

  const productId = String(formData.get("product_id") ?? "");
  const cantidad = Number(formData.get("cantidad") ?? 0);
  if (!productId || cantidad <= 0) return { error: "Elige un producto y escribe la cantidad." };

  const snap = await loadSnapshot();
  const states = lineStates(snap);
  const lines = sellerLines(snap, seller.id, states).filter((l) => l.productId === productId && l.enMano > 0);
  if (lines.length === 0) return { error: "No tienes este producto en mano." };
  const line = lines[0];
  if (cantidad > line.enMano) {
    return { error: `Solo tienes ${line.enMano} unidades en mano.` };
  }

  const d = await db();
  await d
    .prepare("INSERT INTO sales (id, assignment_id, product_id, cantidad, fecha) VALUES (?1,?2,?3,?4,?5)")
    .bind(newId(), line.assignmentId, productId, cantidad, todayISO())
    .run();
  revalidatePath(`/v/${token}`);
  return { ok: true };
}
