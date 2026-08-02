import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * En desarrollo Next bloquea sus recursos `/_next/*` si la petición llega desde
 * un origen distinto de aquel con el que arrancó (`localhost`). Al abrir la app
 * por la IP de la red —desde el móvil, o desde el propio navegador usando la
 * URL "Network" que imprime `next dev`— el bundle del cliente no carga: la
 * página se ve, pero React no hidrata y nada que dependa de JS responde.
 *
 * Se autorizan las IPv4 propias de la máquina. Se calculan en vez de fijarlas
 * porque el router las reasigna por DHCP. En producción esto no se usa.
 */
const ipsDeLaMaquina = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i?.family === "IPv4" && !i.internal)
  .map((i) => i?.address ?? "");

const nextConfig: NextConfig = {
  allowedDevOrigins: ipsDeLaMaquina.filter(Boolean),
};

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
