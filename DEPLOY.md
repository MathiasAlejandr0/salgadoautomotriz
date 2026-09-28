# Deploy checklist — Salgado Automotriz

## 1. Supabase
- [ ] Crear proyecto en Supabase (o usar el existente)
- [ ] Ejecutar `supabase/migrations/20260321000000_init.sql` en SQL Editor
- [ ] (Opcional) Ejecutar `supabase/seed.sql`
- [ ] Crear bucket Storage `vehicle-photos` (público)
- [ ] Aplicar políticas de Storage del final del migration file
- [ ] Auth → crear usuario admin (email/password)
- [ ] Copiar URL + anon key + service_role a `.env.local`

## 2. Variables de entorno (Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=https://salgadoautomotriz.cl
```

## 3. Vercel
- [ ] Importar repo / conectar carpeta `salgado-web`
- [ ] Framework: Next.js (auto)
- [ ] Configurar env vars
- [ ] Deploy preview → probar
- [ ] Dominio custom: salgadoautomotriz.cl

## 4. Cloudflare
- [ ] DNS: apuntar dominio a Vercel (CNAME / A según docs Vercel)
- [ ] Proxy naranja ON (CDN)
- [ ] SSL/TLS: Full (strict)
- [ ] Cache Rules: cachear `/_next/static/*` agresivo; HTML bypass o short TTL
- [ ] (Opcional) WAF / rate limit en `/api/*` y `/admin/*`

## 5. Post-deploy QA
- [ ] Home hero + logo + buscador
- [ ] Catálogo filtros
- [ ] Ficha WhatsApp con mensaje del vehículo
- [ ] Financiamiento → WhatsApp preaprobación
- [ ] Contacto guarda lead (con Supabase)
- [ ] Admin login + CRUD
- [ ] SEO: `/sitemap.xml`, `/robots.txt`, JSON-LD en view-source
- [ ] Actualizar teléfono real en `lib/site.ts`

## 6. Número WhatsApp
Editar `SITE.phoneRaw` y `SITE.phone` en `lib/site.ts` con el número real del cliente.
