// default open-next.config.ts file created by @opennextjs/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default {
  // Evita recursión infinita: por defecto OpenNext corre `npm run build`,
  // que aquí es justamente `opennextjs-cloudflare build`.
  buildCommand: "next build",
  ...defineCloudflareConfig({
    incrementalCache: r2IncrementalCache,
  }),
};
