-- Cierra avisos del linter: search_path fijo, is_admin fuera de la API
-- y una sola política permisiva por rol y acción.

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false);
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "Public read published vehicles" on public.vehicles;
drop policy if exists "Admin full vehicles" on public.vehicles;
drop policy if exists "Public read vehicle images" on public.vehicle_images;
drop policy if exists "Admin full vehicle_images" on public.vehicle_images;
drop policy if exists "Anyone insert contact leads" on public.contact_leads;
drop policy if exists "Admin full contact_leads" on public.contact_leads;
drop policy if exists "Anyone insert financing leads" on public.financing_leads;
drop policy if exists "Admin full financing_leads" on public.financing_leads;
drop policy if exists "Public read published reviews" on public.reviews;
drop policy if exists "Admin full reviews" on public.reviews;

create policy "Read vehicles"
  on public.vehicles for select
  to anon, authenticated
  using (published = true or private.is_admin());

create policy "Admin insert vehicles"
  on public.vehicles for insert
  to authenticated
  with check (private.is_admin());

create policy "Admin update vehicles"
  on public.vehicles for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "Admin delete vehicles"
  on public.vehicles for delete
  to authenticated
  using (private.is_admin());

create policy "Read vehicle images"
  on public.vehicle_images for select
  to anon, authenticated
  using (
    private.is_admin()
    or exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.published = true
    )
  );

create policy "Admin insert vehicle images"
  on public.vehicle_images for insert
  to authenticated
  with check (private.is_admin());

create policy "Admin update vehicle images"
  on public.vehicle_images for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "Admin delete vehicle images"
  on public.vehicle_images for delete
  to authenticated
  using (private.is_admin());

create policy "Insert contact leads"
  on public.contact_leads for insert
  to anon, authenticated
  with check (true);

create policy "Admin read contact leads"
  on public.contact_leads for select
  to authenticated
  using (private.is_admin());

create policy "Admin update contact leads"
  on public.contact_leads for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "Admin delete contact leads"
  on public.contact_leads for delete
  to authenticated
  using (private.is_admin());

create policy "Insert financing leads"
  on public.financing_leads for insert
  to anon, authenticated
  with check (true);

create policy "Admin read financing leads"
  on public.financing_leads for select
  to authenticated
  using (private.is_admin());

create policy "Admin update financing leads"
  on public.financing_leads for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "Admin delete financing leads"
  on public.financing_leads for delete
  to authenticated
  using (private.is_admin());

create policy "Read reviews"
  on public.reviews for select
  to anon, authenticated
  using (published = true or private.is_admin());

create policy "Admin insert reviews"
  on public.reviews for insert
  to authenticated
  with check (private.is_admin());

create policy "Admin update reviews"
  on public.reviews for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "Admin delete reviews"
  on public.reviews for delete
  to authenticated
  using (private.is_admin());

drop policy if exists "Public read vehicle photos" on storage.objects;
drop policy if exists "Admin write vehicle photos" on storage.objects;

create policy "Public read vehicle photos"
  on storage.objects for select
  using (bucket_id = 'vehicle-photos');

create policy "Admin insert vehicle photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'vehicle-photos' and private.is_admin());

create policy "Admin update vehicle photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'vehicle-photos' and private.is_admin())
  with check (bucket_id = 'vehicle-photos' and private.is_admin());

create policy "Admin delete vehicle photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'vehicle-photos' and private.is_admin());

drop function if exists public.is_admin();
