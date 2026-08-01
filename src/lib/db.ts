import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Instancia D1 ligada al request actual (Cloudflare). */
export async function db(): Promise<D1Database> {
  const ctx = await getCloudflareContext({ async: true });
  return ctx.env.DB;
}

/** Lee una variable de entorno/secreto: binding del worker o process.env (build). */
export async function getSecret(name: string): Promise<string | undefined> {
  try {
    const env = (await getCloudflareContext({ async: true })).env as unknown as Record<string, unknown>;
    const v = env[name];
    if (typeof v === "string" && v) return v;
  } catch {
    // fuera de Cloudflare (build/next dev): usamos process.env
  }
  return process.env[name];
}

export const newId = (): string => crypto.randomUUID();
