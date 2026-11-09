-- Avisaya · 04 · Chat del equipo de cada hotel (recepción, limpieza, mantenimiento y administración).
-- Se puede ejecutar varias veces sin romper nada. Ejecuta antes 01, 02 y 03.

create table if not exists public.mensajes (
  id        uuid primary key default gen_random_uuid(),
  hotel_id  uuid not null references public.hoteles(id) on delete cascade,
  autor_id  uuid not null references public.perfiles(id) on delete cascade default auth.uid(),
  texto     text not null check (char_length(btrim(texto)) between 1 and 1000),
  parte_id  uuid references public.partes(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index if not exists mensajes_hotel_fecha on public.mensajes (hotel_id, creado_en desc);

alter table public.mensajes enable row level security;

-- Solo lo ven y escriben quienes están aprobados en ese hotel; cada uno escribe con su nombre
drop policy if exists "mensajes ver mis hoteles" on public.mensajes;
create policy "mensajes ver mis hoteles" on public.mensajes for select to authenticated
  using (public.es_miembro(hotel_id));

drop policy if exists "mensajes escribir" on public.mensajes;
create policy "mensajes escribir" on public.mensajes for insert to authenticated
  with check (
    public.es_miembro(hotel_id)
    and autor_id = auth.uid()
    and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo)
    and (parte_id is null or exists (select 1 from public.partes x where x.id = parte_id and x.hotel_id = mensajes.hotel_id))
  );

drop policy if exists "mensajes borrar los mios" on public.mensajes;
create policy "mensajes borrar los mios" on public.mensajes for delete to authenticated
  using (autor_id = auth.uid());

grant select, insert, delete on public.mensajes to authenticated;

-- Aviso al móvil del resto del equipo del hotel
create or replace function public.avisar_mensaje() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  quien    text;
  hotel    text;
  envios   jsonb;
begin
  select nombre into quien from public.perfiles where id = new.autor_id;
  select nombre into hotel from public.hoteles where id = new.hotel_id;
  select jsonb_agg(jsonb_build_object(
           'to', d.token,
           'title', coalesce(hotel, 'Avisaya') || ' · ' || coalesce(quien, 'Equipo'),
           'body', left(new.texto, 180),
           'sound', 'default',
           'priority', 'high',
           'channelId', 'partes',
           'data', jsonb_build_object('tipo', 'mensaje', 'hotel_id', new.hotel_id)))
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
      raise warning 'Avisaya: no se pudo enviar el aviso del chat: %', sqlerrm;
    end;
  end if;
  return null;
end $$;

drop trigger if exists mensajes_push on public.mensajes;
create trigger mensajes_push after insert on public.mensajes
  for each row execute function public.avisar_mensaje();

do $$ begin
  alter publication supabase_realtime add table public.mensajes;
exception when duplicate_object then null; end $$;

select 'Avisaya: chat preparado' as resultado;
