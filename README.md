# Reportes de Ventas

Panel para distribuidores: compras, asignaciones a vendedores, cortes de venta,
cobros e inventario. Cada vendedor entra por su propio enlace con un PIN y
reporta sus ventas.

Next.js sobre Cloudflare Workers, con D1 de base de datos.

## Desarrollo

```bash
pnpm install
pnpm dev
```

Este proyecto usa **pnpm**. No uses `npm` ni `yarn`: el lockfile es
`pnpm-lock.yaml` y un `preinstall` corta cualquier otro gestor.

Copia `.dev.vars.example` a `.dev.vars` antes de arrancar. Para abrir la app
desde el móvil, usa la URL "Network" que imprime `next dev`: las IP de la
máquina se autorizan solas en `next.config.ts`.

```bash
pnpm test        # pruebas de los cálculos del negocio
pnpm typecheck
pnpm lint
pnpm build       # build de Cloudflare (OpenNext)
```

## Acceso de administrador

El PIN se guarda hasheado con HMAC, usando `AUTH_SECRET` como clave. Dos cosas
que conviene tener claras **antes** de desplegar:

**El primer arranque pide un `SETUP_TOKEN`.** Sin él nadie puede crear el PIN de
administrador, ni siquiera quien dé con la URL antes que tú. Ponlo una vez:

```bash
wrangler secret put SETUP_TOKEN     # inventa un valor y guárdalo donde tus contraseñas
```

Al entrar por primera vez tecleas ese token y tu PIN. No se vuelve a pedir.

**Si olvidas el PIN**, el rescate borra solo el hash del admin y devuelve la app
a la pantalla de primer arranque:

```bash
pnpm pin:reset              # base remota
pnpm pin:reset --local      # base de desarrollo
```

No toca `AUTH_SECRET`, así que **los PIN de los vendedores siguen funcionando**.
Rotar ese secreto sí los invalidaría todos de golpe, y no habría vuelta atrás.

Ojo: el rescate no cierra las sesiones ya abiertas — la cookie de admin vale 30
días por su cuenta. Si lo que quieres es echar a alguien, cambia el PIN desde
Ajustes y borra la cookie.

## Respaldo

**Ajustes → Respaldo** descarga un JSON con todo y permite restaurarlo.

Además, D1 guarda un histórico propio (**Time Travel**) que permite volver a un
punto anterior sin depender de esos respaldos:

```bash
wrangler d1 time-travel info reportes-d1                    # bookmark actual
wrangler d1 time-travel restore reportes-d1 --bookmark=...  # volver a ese punto
```

Restaura la base entera, no una fila suelta, y su ventana es limitada: sirve
para el borrado accidental, no como archivo a largo plazo.

## Base de datos

```bash
pnpm db:migrate:local
pnpm db:migrate:remote
```
