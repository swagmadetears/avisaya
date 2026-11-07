-- =====================================================================
-- Avisaya · Búsqueda de partes
-- Pegar entero en Supabase → SQL Editor → New query → Run.
-- Requiere 01_esquema.sql. Se puede repetir.
-- =====================================================================

-- Código visible del parte (el mismo que sale en la app y en el PDF): PT-1A2B3C4D
alter table public.partes
  add column if not exists codigo text
  generated always as ('PT-' || upper(left(id::text, 8))) stored;

-- Para encontrar «fontaneria» aunque se guardó «Fontanería»
create extension if not exists unaccent;

-- Busca en los partes del hotel de quien pregunta (los 100 más recientes que coincidan).
-- Texto (opcional, mínimo 2 letras): habitación/zona, tipo, descripción, nota del técnico,
-- código y nombres de quien avisó o del técnico. Fechas (opcionales): fecha del aviso,
-- desde (incluida) hasta (sin incluir). Hace falta texto o al menos una fecha.
drop function if exists public.buscar_partes(text);
create or replace function public.buscar_partes(p_texto text default '', p_desde timestamptz default null, p_hasta timestamptz default null)
returns setof public.partes
language sql stable
set search_path = public, extensions as $$
  with t as (
    select trim(coalesce(p_texto, '')) as texto,
           '%' || replace(replace(replace(trim(coalesce(p_texto, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as patron
  )
  select p.*
    from public.partes p, t
   where p.hotel_id = public.mi_hotel_id()
     and (char_length(t.texto) >= 2 or p_desde is not null or p_hasta is not null)
     and (p_desde is null or p.creado_en >= p_desde)
     and (p_hasta is null or p.creado_en <  p_hasta)
     and (char_length(t.texto) < 2
          or unaccent(p.habitacion || ' ' || p.categoria || ' ' || p.descripcion || ' ' || p.nota_resolucion || ' ' || p.codigo) ilike unaccent(t.patron)
          or exists (select 1 from public.perfiles pf
                      where pf.id in (p.creado_por, p.tecnico_id) and unaccent(pf.nombre) ilike unaccent(t.patron)))
   order by p.creado_en desc
   limit 100
$$;

revoke all on function public.buscar_partes(text, timestamptz, timestamptz) from public, anon;
grant execute on function public.buscar_partes(text, timestamptz, timestamptz) to authenticated;

select 'Avisaya: búsqueda preparada' as resultado;
