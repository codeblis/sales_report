/**
 * Corta en seco cualquier instalación que no sea con pnpm.
 *
 * Sin esto, un `npm install` distraído regenera package-lock.json y el
 * proyecto acaba con dos lockfiles que resuelven versiones distintas. Se
 * ejecuta desde el script `preinstall`, antes de que el gestor toque nada.
 */

const ua = process.env.npm_config_user_agent ?? "";
const gestor = ua.split("/")[0] || "desconocido";

if (gestor !== "pnpm") {
  console.error(`
  ✖ Este proyecto se instala con pnpm, y estás usando ${gestor}.

    pnpm install

  Si no lo tienes:  npm install -g pnpm
  El lockfile es pnpm-lock.yaml; no debe existir package-lock.json.
`);
  process.exit(1);
}
