-- Salgado Automotriz
-- Inventario normalizado: unidad, fotos, consultas y reseñas.
-- Postgres 17. La planilla sigue siendo la fuente; esta base es la vitrina.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ── Unidades ──────────────────────────────────────────
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  stock_id text,
  plate text,
  slug text not null,
  brand text not null,
  model text not null,
  year integer not null,
  version text,
  category text not null,
  fuel text,
  transmission text,
  mileage integer,
  color text,
  doors integer,
  engine text,
  price bigint not null,
  description text,
  location text,
  origin text,
  status text not null default 'Disponible',
  published boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_stock_id_uidx unique (stock_id),
  constraint vehicles_plate_uidx unique (plate),
  constraint vehicles_slug_uidx unique (slug),
  constraint vehicles_year_chk check (year between 1980 and 2100),
  constraint vehicles_price_chk check (price >= 0),
  constraint vehicles_mileage_chk check (mileage is null or mileage >= 0),
  constraint vehicles_doors_chk check (doors is null or doors between 1 and 7),
  constraint vehicles_fuel_chk check (
    fuel is null or fuel in ('Bencina', 'Diésel', 'Híbrido', 'Eléctrico')
  ),
  constraint vehicles_transmission_chk check (
    transmission is null or transmission in ('Manual', 'Automática')
  ),
  constraint vehicles_status_chk check (
    status in ('Disponible', 'En reserva', 'Vendido', 'Borrador')
  ),
  constraint vehicles_brand_chk check (char_length(btrim(brand)) > 0),
  constraint vehicles_model_chk check (char_length(btrim(model)) > 0),
  constraint vehicles_slug_chk check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index vehicles_catalog_idx
  on public.vehicles (published, category, brand, price);

create index vehicles_featured_idx
  on public.vehicles (featured, price desc)
  where published = true and featured = true;

create index vehicles_published_year_idx
  on public.vehicles (published, year desc);

create index vehicles_location_idx
  on public.vehicles (location)
  where location is not null;

create trigger vehicles_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

-- ── Fotos (1 unidad → N archivos, orden único) ────────
create table public.vehicle_images (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint vehicle_images_order_uidx unique (vehicle_id, sort_order),
  constraint vehicle_images_path_chk check (char_length(storage_path) > 0),
  constraint vehicle_images_order_chk check (sort_order >= 0)
);

create index vehicle_images_vehicle_idx
  on public.vehicle_images (vehicle_id, sort_order);

-- ── Consultas ─────────────────────────────────────────
create table public.contact_leads (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null,
  telefono text,
  mensaje text,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  vehicle_slug text,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint contact_leads_nombre_chk check (char_length(btrim(nombre)) between 2 and 120),
  constraint contact_leads_email_chk check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint contact_leads_mensaje_chk check (mensaje is null or char_length(mensaje) <= 4000)
);

create index contact_leads_created_idx on public.contact_leads (created_at desc);
create index contact_leads_unread_idx on public.contact_leads (created_at desc) where read = false;
create index contact_leads_vehicle_idx on public.contact_leads (vehicle_id);

create table public.financing_leads (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null,
  telefono text not null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  vehicle_slug text,
  pie bigint,
  plazo integer,
  renta bigint,
  mensaje text,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint financing_leads_nombre_chk check (char_length(btrim(nombre)) between 2 and 120),
  constraint financing_leads_email_chk check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint financing_leads_telefono_chk check (char_length(btrim(telefono)) between 8 and 20),
  constraint financing_leads_pie_chk check (pie is null or pie >= 0),
  constraint financing_leads_plazo_chk check (plazo is null or plazo between 6 and 84),
  constraint financing_leads_renta_chk check (renta is null or renta >= 0),
  constraint financing_leads_mensaje_chk check (mensaje is null or char_length(mensaje) <= 4000)
);

create index financing_leads_created_idx on public.financing_leads (created_at desc);
create index financing_leads_unread_idx on public.financing_leads (created_at desc) where read = false;
create index financing_leads_vehicle_idx on public.financing_leads (vehicle_id);

-- ── Reseñas ───────────────────────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  ciudad text,
  rating integer not null,
  texto text not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint reviews_nombre_chk check (char_length(btrim(nombre)) between 2 and 80),
  constraint reviews_rating_chk check (rating between 1 and 5),
  constraint reviews_texto_chk check (char_length(btrim(texto)) between 4 and 2000)
);

create index reviews_published_idx
  on public.reviews (created_at desc)
  where published = true;

-- ── Privilegios ───────────────────────────────────────
grant select on public.vehicles, public.vehicle_images, public.reviews to anon, authenticated;
grant insert on public.contact_leads, public.financing_leads to anon, authenticated;
grant select, update, delete on public.contact_leads, public.financing_leads to authenticated;
grant insert, update, delete on public.vehicles, public.vehicle_images, public.reviews to authenticated;
grant all on public.vehicles, public.vehicle_images, public.contact_leads, public.financing_leads, public.reviews to service_role;

-- ── RLS ───────────────────────────────────────────────
alter table public.vehicles enable row level security;
alter table public.vehicle_images enable row level security;
alter table public.contact_leads enable row level security;
alter table public.financing_leads enable row level security;
alter table public.reviews enable row level security;

create policy "Public read published vehicles"
  on public.vehicles for select
  using (published = true);

create policy "Public read vehicle images"
  on public.vehicle_images for select
  using (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id and v.published = true
    )
  );

create policy "Public read published reviews"
  on public.reviews for select
  using (published = true);

create policy "Anyone insert contact leads"
  on public.contact_leads for insert
  to anon, authenticated
  with check (true);

create policy "Anyone insert financing leads"
  on public.financing_leads for insert
  to anon, authenticated
  with check (true);

create policy "Admin full vehicles"
  on public.vehicles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin full vehicle_images"
  on public.vehicle_images for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin full contact_leads"
  on public.contact_leads for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin full financing_leads"
  on public.financing_leads for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin full reviews"
  on public.reviews for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── Fotos en Storage ──────────────────────────────────
insert into storage.buckets (id, name, public)
values ('vehicle-photos', 'vehicle-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read vehicle photos" on storage.objects;
drop policy if exists "Admin write vehicle photos" on storage.objects;

create policy "Public read vehicle photos"
  on storage.objects for select
  using (bucket_id = 'vehicle-photos');

create policy "Admin write vehicle photos"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'vehicle-photos' and public.is_admin())
  with check (bucket_id = 'vehicle-photos' and public.is_admin());
