"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/actions/admin";
import { hashPin } from "@/lib/auth";
import { db, newId } from "@/lib/db";

function randPin(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 10000 || 1).padStart(4, "0");
}

export async function randToken(): Promise<string> {
  return crypto.randomUUID().replace(/-/g, "");
}

export type SellerResult = { error?: string; ok?: boolean; pin?: string; token?: string; id?: string };

export async function createSeller(_prev: SellerResult, formData: FormData): Promise<SellerResult> {
  if (!(await requireAdmin())) return { error: "Sesión inválida." };
  const nombre = String(formData.get("nombre") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();
  if (!nombre) return { error: "El nombre es obligatorio." };
  const pin = randPin();
  const token = await randToken();
  const id = newId();
  const d = await db();
  await d
    .prepare("INSERT INTO sellers (id, nombre, telefono, pin_hash, token) VALUES (?1,?2,?3,?4,?5)")
    .bind(id, nombre, telefono, await hashPin(pin), token)
    .run();
  revalidatePath("/panel/vendedores");
  revalidatePath("/panel", "layout");
  return { ok: true, id, pin, token };
}

/** Renueva el PIN de un vendedor y devuelve el PIN nuevo para comunicárselo. */
export async function renewSellerPin(sellerId: string): Promise<SellerResult> {
  if (!(await requireAdmin())) return { error: "Sesión inválida." };
  const d = await db();
  const seller = await d
    .prepare("SELECT id FROM sellers WHERE id = ?1")
    .bind(sellerId)
    .first<{ id: string }>();
  if (!seller) return { error: "El vendedor no existe." };
  const pin = randPin();
  await d
    .prepare("UPDATE sellers SET pin_hash = ?1 WHERE id = ?2")
    .bind(await hashPin(pin), sellerId)
    .run();
  revalidatePath("/panel/vendedores");
  revalidatePath("/panel", "layout");
  return { ok: true, id: sellerId, pin };
}

export async function updateSeller(_prev: SellerResult, formData: FormData): Promise<SellerResult> {
  if (!(await requireAdmin())) return { error: "Sesión inválida." };
  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();
  const activo = formData.get("activo") === "1" ? 1 : 0;
  if (!id || !nombre) return { error: "Faltan datos." };
  const resetPin = formData.get("reset_pin") === "1";
  if (resetPin) {
    const pin = randPin();
    const d = await db();
    await d
      .prepare("UPDATE sellers SET nombre = ?1, telefono = ?2, activo = ?3, pin_hash = ?4 WHERE id = ?5")
      .bind(nombre, telefono, activo, await hashPin(pin), id)
      .run();
    revalidatePath("/panel/vendedores");
    revalidatePath("/panel", "layout");
    return { ok: true, pin };
  }
  const d = await db();
  await d
    .prepare("UPDATE sellers SET nombre = ?1, telefono = ?2, activo = ?3 WHERE id = ?4")
    .bind(nombre, telefono, activo, id)
    .run();
  revalidatePath("/panel/vendedores");
  revalidatePath("/panel", "layout");
  return { ok: true };
}
