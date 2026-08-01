<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# El gestor de paquetes es pnpm

`pnpm install`, `pnpm dev`, `pnpm test`. Nada de `npm` ni `yarn`: el lockfile
es `pnpm-lock.yaml` y no hay `package-lock.json`. Los scripts de instalación se
aprueban en `pnpm-workspace.yaml` (clave `allowBuilds`), no en package.json.
