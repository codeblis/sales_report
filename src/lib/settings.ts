"use server";

import { db } from "@/lib/db";
import type { Settings } from "@/lib/types";

/** Configuración global (moneda, PIN de admin). */
export async function getSettings(): Promise<Settings> {
  const d = await db();
  const rows = await d.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
  const map = new Map(rows.results.map((r) => [r.key, r.value]));
  return {
    moneda_simbolo: map.get("moneda_simbolo") ?? "$",
    moneda_codigo: map.get("moneda_codigo") ?? "",
    admin_pin_hash: map.get("admin_pin_hash") ?? null,
  };
}

export async function setSetting(key: string, value: string): Promise<void> {
  const d = await db();
  await d
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key, value)
    .run();
}

export async function hasAdminPin(): Promise<boolean> {
  return (await getSettings()).admin_pin_hash !== null;
}
