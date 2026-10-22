-- Quitar patentes chilenas del texto público guardado en Supabase.
-- NO se ejecuta solo. No está en supabase/migrations.
-- Revisar el resultado antes de hacer COMMIT.
--
-- Formatos: LLLLNN (RWYR12) y LLNNNN (AB1234), con o sin la palabra "Patente".

BEGIN;

UPDATE public.vehicles
SET
  description = NULLIF(
    btrim(
      regexp_replace(
        regexp_replace(
          coalesce(description, ''),
          'patente[[:space:]]*[:#-]?[[:space:]]*[A-Za-z0-9][A-Za-z0-9.[:space:]-]{3,12}',
          ' ',
          'gi'
        ),
        '\m([A-Za-z]{4}[0-9]{2}|[A-Za-z]{2}[0-9]{4})\M',
        ' ',
        'gi'
      )
    ),
    ''
  ),
  updated_at = now()
WHERE description ~* 'patente|[A-Za-z]{4}[0-9]{2}|[A-Za-z]{2}[0-9]{4}';

-- El slug público lo calcula la aplicación (marca-modelo-versión-año-id).
-- No reescribir slugs aquí: un UPDATE masivo rompería las redirecciones 301.

ROLLBACK;
-- Cuando el SELECT de revisión se vea bien, cambia ROLLBACK por COMMIT.
