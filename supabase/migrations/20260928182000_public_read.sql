-- La lectura pública no puede llamar a private.is_admin (anon no tiene EXECUTE).
-- Políticas separadas por rol: anon solo ve publicado; authenticated también si es admin.

drop policy if exists "Read vehicles" on public.vehicles;
drop policy if exists "Read vehicle images" on public.vehicle_images;
drop policy if exists "Read reviews" on public.reviews;

create policy "Anon read published vehicles"
  on public.vehicles for select
  to anon
  using (published = true);

create policy "Auth read vehicles"
  on public.vehicles for select
  to authenticated
  using (published = true or private.is_admin());

create policy "Anon read published images"
  on public.vehicle_images for select
  to anon
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.published = true
    )
  );

create policy "Auth read vehicle images"
  on public.vehicle_images for select
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.published = true
    )
  );

create policy "Anon read published reviews"
  on public.reviews for select
  to anon
  using (published = true);

create policy "Auth read reviews"
  on public.reviews for select
  to authenticated
  using (published = true or private.is_admin());
