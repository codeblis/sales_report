/**
 * Rescate del acceso de administrador.
 *
 * Borra `admin_pin_hash` de la tabla `settings`. Con eso la app vuelve a
 * enseñar la pantalla de primer arranque y se crea un PIN nuevo, que exige el
 * SETUP_TOKEN: por eso devolver la app a ese estado no la deja a merced del
 * primero que pase.
 *
 * No toca AUTH_SECRET a propósito. Los PIN de los vendedores están hasheados
 * con ese secreto como clave, así que rotarlo los invalidaría todos de golpe;
 * borrar solo el hash del admin los deja intactos. Además los secretos de
 * Cloudflare son de solo escritura, así que un rescate que necesitara leer
 * AUTH_SECRET no serviría de nada.
 *
 *   pnpm pin:reset            → contra la base remota (producción)
 *   pnpm pin:reset --local    → contra la base de desarrollo
 */

import { spawnSync } from "node:child_process";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

const BASE = "reportes-d1";
const local = process.argv.includes("--local");
const destino = local ? "--local" : "--remote";
const donde = local ? "la base LOCAL de desarrollo" : "la base REMOTA de producción";

const rl = createInterface({ input: stdin, output: stdout });

console.log(`
  Vas a borrar el PIN de administrador de ${donde}.

  Después de esto:
    · La app pedirá crear un PIN nuevo la próxima vez que abras /login.
    · Necesitarás el SETUP_TOKEN para crearlo.
    · Los PIN de los vendedores NO se tocan: seguirán funcionando.
`);

const respuesta = await rl.question("  Escribe BORRAR para continuar: ");
rl.close();

if (respuesta.trim() !== "BORRAR") {
  console.log("\n  Cancelado. No se ha tocado nada.\n");
  process.exit(1);
}

const r = spawnSync(
  "npx",
  [
    "wrangler",
    "d1",
    "execute",
    BASE,
    destino,
    "--command",
    "DELETE FROM settings WHERE key = 'admin_pin_hash'",
  ],
  { stdio: "inherit" },
);

if (r.status !== 0) {
  console.error("\n  ✖ No se pudo borrar. Revisa el error de wrangler ahí arriba.\n");
  process.exit(r.status ?? 1);
}

console.log(`
  ✔ Listo. Abre /login y crea el PIN nuevo con tu SETUP_TOKEN.

  Si no recuerdas el token, ponlo de nuevo antes:
    wrangler secret put SETUP_TOKEN
`);
