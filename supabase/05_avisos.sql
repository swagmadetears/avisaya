-- Avisaya · 05 · Avisos generales del hotel («Sofá cama de la 1C roto», «Ascensor 2 en revisión»).
-- Un tablón para todo el equipo: cualquiera publica, todos lo ven hasta que alguien lo da por resuelto.
-- Se puede ejecutar varias veces sin romper nada. Ejecuta antes 01 a 04.

create table if not exists public.avisos (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references public.hoteles(id) on delete cascade,
  autor_id    uuid not null references public.perfiles(id) on delete cascade default auth.uid(),
  texto       text not null check (char_length(btrim(texto)) between 2 and 280),
  lugar       text not null default '' check (char_length(lugar) <= 40),
  importante  boolean not null default false,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now(),
  cerrado_en  timestamptz,
  cerrado_por uuid references public.perfiles(id) on delete set null
);
create index if not exists avisos_hotel_activos on public.avisos (hotel_id, activo, creado_en desc);

alter table public.avisos enable row level security;

drop policy if exists "avisos ver mis hoteles" on public.avisos;
create policy "avisos ver mis hoteles" on public.avisos for select to authenticated
  using (public.es_miembro(hotel_id));

drop policy if exists "avisos publicar" on public.avisos;
create policy "avisos publicar" on public.avisos for insert to authenticated
  with check (
    public.es_miembro(hotel_id)
    and autor_id = auth.uid()
    and activo
    and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo)
  );

-- Cualquiera del hotel puede darlo por resuelto (o reabrirlo); el texto solo lo cambia quien lo escribió
drop policy if exists "avisos cerrar" on public.avisos;
create policy "avisos cerrar" on public.avisos for update to authenticated
  using (public.es_miembro(hotel_id))
  with check (public.es_miembro(hotel_id));

drop policy if exists "avisos borrar" on public.avisos;
create policy "avisos borrar" on public.avisos for delete to authenticated
  using (autor_id = auth.uid() or (public.es_miembro(hotel_id) and public.mi_rol() = 'admin'));

grant select, insert, update, delete on public.avisos to authenticated;

-- Al cerrar se guarda quién y cuándo; nadie cambia el hotel, el autor ni (salvo el autor) el texto
create or replace function public.avisos_al_cambiar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.hotel_id <> old.hotel_id or new.autor_id <> old.autor_id or new.creado_en <> old.creado_en then
    raise exception 'No se puede cambiar el hotel, el autor ni la fecha de un aviso';
  end if;
  if (new.texto <> old.texto or new.lugar <> old.lugar or new.importante <> old.importante) and old.autor_id <> auth.uid() then
    raise exception 'Solo quien escribió el aviso puede cambiar su texto';
  end if;
  if old.activo and not new.activo then
    new.cerrado_en := now();
    new.cerrado_por := auth.uid();
  elsif not old.activo and new.activo then
    new.cerrado_en := null;
    new.cerrado_por := null;
  else
    new.cerrado_en := old.cerrado_en;
    new.cerrado_por := old.cerrado_por;
  end if;
  return new;
end $$;

drop trigger if exists avisos_cambio on public.avisos;
create trigger avisos_cambio before update on public.avisos
  for each row execute function public.avisos_al_cambiar();

-- Aviso al móvil del resto del equipo
create or replace function public.avisar_aviso() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  quien  text;
  hotel  text;
  envios jsonb;
begin
  select nombre into quien from public.perfiles where id = new.autor_id;
  select nombre into hotel from public.hoteles where id = new.hotel_id;
  select jsonb_agg(jsonb_build_object(
           'to', d.token,
           'title', case when new.importante then '⚠️ ' else '📌 ' end || coalesce(hotel, 'Avisaya') || ' · Aviso',
           'body', case when new.lugar <> '' then new.lugar || ': ' else '' end || left(new.texto, 160) || ' — ' || coalesce(quien, ''),
           'sound', 'default',
           'priority', 'high',
           'channelId', 'partes',
           'data', jsonb_build_object('tipo', 'aviso', 'hotel_id', new.hotel_id)))
    into envios
    from public.dispositivos d
    join public.perfiles p on p.id = d.perfil_id
    join public.perfil_hoteles ph on ph.perfil_id = p.id and ph.hotel_id = new.hotel_id and ph.aprobado
   where p.activo and p.id <> new.autor_id;
  if envios is not null then
    begin
      perform net.http_post(
        url     := 'https://exp.host/--/api/v2/push/send',
        body    := envios,
        headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
      );
    exception when others then
      raise warning 'Avisaya: no se pudo enviar el aviso general: %', sqlerrm;
    end;
  end if;
  return null;
end $$;

drop trigger if exists avisos_push on public.avisos;
create trigger avisos_push after insert on public.avisos
  for each row execute function public.avisar_aviso();

do $$ begin
  alter publication supabase_realtime add table public.avisos;
exception when duplicate_object then null; end $$;

select 'Avisaya: avisos generales preparados' as resultado;
