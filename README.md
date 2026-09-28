# Salgado Automotriz

Sitio web Next.js + Tailwind + Supabase para Salgado Automotriz (Puerto Montt).

## Stack
- Next.js 16 (App Router)
- Tailwind CSS v4
- Supabase (Auth, Postgres, Storage)
- Deploy: Vercel + Cloudflare

## Desarrollo

```bash
cd salgado-web
npm install
cp .env.example .env.local   # completar con keys de Supabase
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

Sin Supabase configurado el sitio usa **datos demo** (inventario mock).

## Rutas públicas
- `/` Home (mockup v2)
- `/catalogo` Inventario
- `/catalogo/detalle/[slug]` Ficha
- `/financiamiento` Simulador
- `/nosotros` · `/contacto`

## Admin
- `/admin/login` — Supabase Auth (o demo sin env)
- `/admin` Dashboard
- `/admin/vehiculos` CRUD
- `/admin/leads` Contacto + financiamiento
- `/admin/resenas` Testimonios

## Supabase
Ver `supabase/migrations/` y `DEPLOY.md`.

## Logo
`public/logo-salgado.png`
