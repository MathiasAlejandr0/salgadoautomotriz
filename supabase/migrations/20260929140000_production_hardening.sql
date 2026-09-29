-- Producción: email opcional en consultas (consigna sin correo inventado)
-- y admin reconocido también por app_metadata.role = 'admin'.

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

alter table public.contact_leads drop constraint if exists contact_leads_email_chk;
alter table public.contact_leads alter column email drop not null;
alter table public.contact_leads add constraint contact_leads_email_chk
  check (
    email is null
    or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  );
