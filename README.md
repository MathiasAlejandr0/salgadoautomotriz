# Salgado Automotriz

Sitio web Next.js + Tailwind + Supabase para Salgado Automotriz (Puerto Montt).

## Stack
- Next.js 16 (App Router). La protección de `/admin` vive en `proxy.ts` (en esta versión `middleware.ts` quedó obsoleto).
- Tailwind CSS v4
- Supabase (Auth, Postgres, Storage)
- Inventario público: pestaña de Google Sheets + fotos de Drive (`lib/inventory/`)
- Deploy: Vercel + Cloudflare

## Desarrollo

El repositorio es la raíz del sitio (no hay subcarpeta `salgado-web`).

```bash
npm ci
cp .env.example .env.local   # completar con keys de Supabase
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

Sin Supabase, y solo en `next dev`, el sitio usa datos demo. En producción (`next build` / Vercel) no hay admin abierto ni leads ficticios.

## Rutas públicas
- `/` Home
- `/catalogo` Inventario
- `/catalogo/detalle/[slug]` Ficha
- `/financiamiento` Simulador
- `/consigna` Consignación
- `/nosotros` · `/contacto`

## Admin
- `/admin/login` — Supabase Auth. El usuario debe tener `app_metadata.is_admin = true` (o `role = "admin"`).
- `/admin` Dashboard
- `/admin/vehiculos` CRUD en Postgres cuando Supabase está configurado
- `/admin/leads` Contacto, consignación y financiamiento
- `/admin/resenas` Testimonios

El catálogo público sigue saliendo de la planilla mientras la tabla `vehicles` esté vacía. En cuanto haya filas en Supabase, el sitio muestra esas filas.

## Supabase
Migraciones en `supabase/migrations/`, en este orden:

1. `20260928180000_init.sql`
2. `20260928181000_advisor_fixes.sql`
3. `20260928182000_public_read.sql`
4. `20260929140000_production_hardening.sql`

Checklist de deploy: `DEPLOY.md`.

## Variables de entorno
Ver `.env.example`. El teléfono de WhatsApp no está fijo en el código: hay que definir `NEXT_PUBLIC_WHATSAPP_E164` antes de salir a producción.

## Logo
`public/logo-salgado-transparent.png` (nav) y `public/logo-salgado.png`.
