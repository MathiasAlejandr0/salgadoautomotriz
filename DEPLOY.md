# Deploy checklist — Salgado Automotriz

El proyecto está en la raíz del repositorio. No hace falta `cd salgado-web`.

## 1. Supabase
- [ ] Crear proyecto en Supabase (o usar el existente)
- [ ] Ejecutar, en este orden, en el SQL Editor:
  - `supabase/migrations/20260928180000_init.sql`
  - `supabase/migrations/20260928181000_advisor_fixes.sql`
  - `supabase/migrations/20260928182000_public_read.sql`
  - `supabase/migrations/20260929140000_production_hardening.sql`
- [ ] (Opcional) Ejecutar `supabase/seed.sql` solo en un entorno de prueba. No cargues datos ficticios en producción.
- [ ] El bucket `vehicle-photos` y sus políticas se crean en las migraciones. Confirmar que el bucket quedó público.
- [ ] Auth → crear usuario admin (email/password)
- [ ] En ese usuario, `app_metadata` debe incluir `"is_admin": true` (el panel también acepta `"role": "admin"`). Sin eso el login responde 403 y RLS bloquea el CRUD.
- [ ] Copiar URL + anon key + service_role a las variables de Vercel. La service role solo vive en el servidor; no existe ningún `NEXT_PUBLIC_` con esa clave y el código de cliente no la lee.

Anon puede insertar leads y leer vehículos/reseñas publicados. No puede leer leads ni escribir vehículos.

## 2. Variables de entorno (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=https://salgadoautomotriz.cl
NEXT_PUBLIC_WHATSAPP_E164=
NEXT_PUBLIC_PHONE_DISPLAY=
NEXT_PUBLIC_GOOGLE_RATING=
NEXT_PUBLIC_GOOGLE_RATING_COUNT=
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
GOOGLE_SHEET_ID=
SALGADO_SHEET_TAB=SALGADO AUTOMOTRIZ
DRIVE_PHOTOS_FOLDER_ID=
RESEND_API_KEY=
CONSIGNA_TO=
CONSIGNA_FROM=
ALLOW_DEMO_MODE=false
```

`ALLOW_DEMO_MODE` se ignora en producción. No lo uses para abrir el admin.

`NEXT_PUBLIC_WHATSAPP_E164` es obligatorio antes del go-live. Sin valor, los botones de WhatsApp apuntan al placeholder `56912345678`.

La nota de Google (badge y JSON-LD) solo aparece si defines rating y cantidad de reseñas reales. No dejes un 4.9 inventado.

La planilla y la carpeta de Drive deben estar compartidas como lectura pública. El catálogo se revalida cada 10 minutos.

## 3. Vercel
- [ ] Importar este repositorio (raíz, no una subcarpeta)
- [ ] Framework: Next.js
- [ ] Configurar las env vars de arriba en Production y Preview
- [ ] Deploy preview → probar
- [ ] Dominio: salgadoautomotriz.cl

## 4. Cloudflare
- [ ] DNS: apuntar el dominio a Vercel (CNAME / A según la documentación de Vercel)
- [ ] Proxy naranja ON
- [ ] SSL/TLS: Full (strict)
- [ ] No cachear HTML. Cache agresivo solo para `/_next/static/*` y archivos de `/public` con hash
- [ ] Rate limit / WAF en `POST /api/contact-lead`, `POST /api/financing-lead`, `POST /api/consigna` y `POST /api/auth/signin`. El límite del código es por instancia serverless; Cloudflare es el que cubre todo el tráfico
- [ ] No desactivar los security headers que ya manda Next (CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`)

## 5. Post-deploy QA
- [ ] Home, logo y buscador
- [ ] Catálogo y ficha con WhatsApp del vehículo
- [ ] Contacto guarda un lead y aparece en `/admin/leads` (no datos de ejemplo)
- [ ] Consigna guarda en `contact_leads` sin correo inventado, o falla con 503 si no hay Supabase ni Resend
- [ ] Admin login rechaza cuentas sin `is_admin`
- [ ] `/admin` redirige a login si no hay sesión
- [ ] `/sitemap.xml`, `/robots.txt`, JSON-LD
- [ ] WhatsApp abre el número real

## 6. Importar la planilla a Postgres (opcional)
Con el dev server ya habiendo llenado `.cache/salgado-inventory.json`:

```bash
node scripts/build-inventory-sql.mjs > /tmp/vehicles.sql
```

Revisar el SQL antes de ejecutarlo. Si `vehicles` deja de estar vacía, el sitio público deja de usar la planilla y pasa a mostrar Postgres.
