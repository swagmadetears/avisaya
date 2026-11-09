-- Avisaya · 08 · Registro: los chats no se pueden borrar ni cambiar, y todo lo que se elimina se guarda.
-- Para que quede constancia de quién dijo qué y de qué se reparó.
-- Se puede ejecutar varias veces sin romper nada. Ejecuta antes 01 a 07.

-- ---------- Mensajes: nadie los borra ni los cambia ----------
drop policy if exists "mensajes borrar los mios" on public.mensajes;
revoke update, delete on public.mensajes from authenticated, anon;

-- ---------- Archivo de lo eliminado ----------
create table if not exists public.archivo (
  id          bigint generated always as identity primary key,
  tipo        text not null check (tipo in ('parte', 'aviso')),
  ref_id      uuid not null,
  hotel_id    uuid,
  resumen     text not null default '',
  datos       jsonb not null,
  borrado_por uuid,
  borrado_por_nombre text,
  borrado_en  timestamptz not null default now()
);
create index if not exists archivo_hotel_fecha on public.archivo (hotel_id, borrado_en desc);

alter table public.archivo enable row level security;
drop policy if exists "archivo solo administracion" on public.archivo;
create policy "archivo solo administracion" on public.archivo for select to authenticated
  using (public.es_miembro(hotel_id) and public.mi_rol() = 'admin');
-- Solo se lee: nadie puede escribir, cambiar ni borrar el archivo desde la app
revoke insert, update, delete on public.archivo from authenticated, anon;
grant select on public.archivo to authenticated;

-- Antes de borrar un parte: copia completa con su historial y su chat
create or replace function public.archivar_parte() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  quien text;
begin
  select nombre into quien from public.perfiles where id = auth.uid();
  insert into public.archivo (tipo, ref_id, hotel_id, resumen, datos, borrado_por, borrado_por_nombre)
  values ('parte', old.id, old.hotel_id,
    case when old.habitacion ~ '^[0-9]{1,5}[a-zA-Z]?$' then 'Hab. ' else '' end || old.habitacion || ' · ' || old.categoria,
    jsonb_build_object(
      'parte', to_jsonb(old),
      'creado_por', (select nombre from public.perfiles where id = old.creado_por),
      'tecnico', (select nombre from public.perfiles where id = old.tecnico_id),
      'eventos', coalesce((select jsonb_agg(jsonb_build_object('tipo', e.tipo, 'estado', e.estado, 'quien', p.nombre, 'en', e.creado_en) order by e.creado_en)
                             from public.parte_eventos e left join public.perfiles p on p.id = e.actor_id where e.parte_id = old.id), '[]'::jsonb),
      'chat', coalesce((select jsonb_agg(jsonb_build_object('quien', p.nombre, 'rol', p.rol, 'texto', m.texto, 'en', m.creado_en) order by m.creado_en)
                          from public.mensajes m left join public.perfiles p on p.id = m.autor_id where m.parte_id = old.id), '[]'::jsonb)),
    auth.uid(), quien);
  return old;
end $$;

drop trigger if exists partes_archivar on public.partes;
create trigger partes_archivar before delete on public.partes
  for each row execute function public.archivar_parte();

-- Antes de borrar un aviso general: copia
create or replace function public.archivar_aviso() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  quien text;
begin
  select nombre into quien from public.perfiles where id = auth.uid();
  insert into public.archivo (tipo, ref_id, hotel_id, resumen, datos, borrado_por, borrado_por_nombre)
  values ('aviso', old.id, old.hotel_id, case when old.lugar <> '' then old.lugar || ': ' else '' end || old.texto,
    jsonb_build_object('aviso', to_jsonb(old), 'autor', (select nombre from public.perfiles where id = old.autor_id)),
    auth.uid(), quien);
  return old;
end $$;

drop trigger if exists avisos_archivar on public.avisos;
create trigger avisos_archivar before delete on public.avisos
  for each row execute function public.archivar_aviso();

select 'Avisaya: registro preparado' as resultado;
