-- Avisaya · 06 · Bandeja de chats: chat global con los técnicos, chats por avería, «leído» (doble tic).
-- Se puede ejecutar varias veces sin romper nada. Ejecuta antes 01 a 05.
--
-- Conversaciones (clave):
--   h:<hotel>  chat general de un hotel
--   p:<parte>  chat de una avería
--   g:<admin>  chat global de un responsable con todos los técnicos de sus hoteles

-- ---------- Mensajes: ahora también del chat global ----------
alter table public.mensajes alter column hotel_id drop not null;
alter table public.mensajes add column if not exists grupo uuid references public.perfiles(id) on delete cascade;
alter table public.mensajes drop constraint if exists mensajes_destino;
alter table public.mensajes add constraint mensajes_destino
  check ((hotel_id is not null and grupo is null) or (hotel_id is null and grupo is not null and parte_id is null));
create index if not exists mensajes_grupo_fecha on public.mensajes (grupo, creado_en desc) where grupo is not null;
create index if not exists mensajes_parte_fecha on public.mensajes (parte_id, creado_en desc) where parte_id is not null;

-- ¿Estoy en el chat global de este responsable? (él mismo, o un técnico de alguno de sus hoteles)
create or replace function public.en_grupo(p_grupo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (auth.uid() = p_grupo and exists (select 1 from public.perfiles where id = p_grupo and rol = 'admin' and activo))
      or exists (
        select 1
          from public.perfil_hoteles a
          join public.perfiles pa on pa.id = a.perfil_id and pa.rol = 'admin' and pa.activo
          join public.perfil_hoteles t on t.hotel_id = a.hotel_id and t.aprobado
          join public.perfiles pt on pt.id = t.perfil_id and pt.rol = 'tecnico' and pt.activo
         where a.perfil_id = p_grupo and a.aprobado and t.perfil_id = auth.uid())
$$;

create or replace function public.puedo_ver_clave(p_clave text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  t text := split_part(p_clave, ':', 1);
  v_id uuid;
begin
  begin v_id := split_part(p_clave, ':', 2)::uuid; exception when others then return false; end;
  if t = 'h' then return public.es_miembro(v_id); end if;
  if t = 'p' then return exists (select 1 from public.partes x where x.id = v_id and public.es_miembro(x.hotel_id)); end if;
  if t = 'g' then return public.en_grupo(v_id); end if;
  return false;
end $$;

drop policy if exists "mensajes ver mis hoteles" on public.mensajes;
create policy "mensajes ver mis hoteles" on public.mensajes for select to authenticated
  using ((hotel_id is not null and public.es_miembro(hotel_id)) or (grupo is not null and public.en_grupo(grupo)));

drop policy if exists "mensajes escribir" on public.mensajes;
create policy "mensajes escribir" on public.mensajes for insert to authenticated
  with check (
    autor_id = auth.uid()
    and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo)
    and (
      (hotel_id is not null and public.es_miembro(hotel_id)
        and (parte_id is null or exists (select 1 from public.partes x where x.id = parte_id and x.hotel_id = mensajes.hotel_id)))
      or (grupo is not null and public.en_grupo(grupo))
    )
  );

-- ---------- Leído ----------
create table if not exists public.lecturas (
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  clave     text not null,
  leido_en  timestamptz not null default now(),
  primary key (perfil_id, clave)
);
alter table public.lecturas enable row level security;
drop policy if exists "lecturas mias" on public.lecturas;
create policy "lecturas mias" on public.lecturas for select to authenticated using (perfil_id = auth.uid());
grant select on public.lecturas to authenticated;

-- Marca la conversación como leída hasta ahora
create or replace function public.marcar_leido(p_clave text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.puedo_ver_clave(p_clave) then raise exception 'No tienes acceso a esta conversación'; end if;
  insert into public.lecturas (perfil_id, clave, leido_en) values (auth.uid(), p_clave, now())
  on conflict (perfil_id, clave) do update set leido_en = excluded.leido_en;
end $$;

-- Hasta cuándo han leído los demás (para el doble tic verde de mis mensajes)
create or replace function public.leido_por_otros(p_clave text) returns timestamptz
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.puedo_ver_clave(p_clave) then return null; end if;
  return (select max(leido_en) from public.lecturas where clave = p_clave and perfil_id <> auth.uid());
end $$;

-- ---------- Bandeja ----------
drop function if exists public.mis_conversaciones();
create or replace function public.mis_conversaciones()
returns table (clave text, tipo text, titulo text, subtitulo text, hotel_id uuid, parte_id uuid, grupo uuid,
               ultimo_texto text, ultimo_autor text, ultimo_autor_id uuid, ultimo_en timestamptz, no_leidos int)
language sql stable security definer set search_path = public as $$
  with yo as (select id, rol from public.perfiles where id = auth.uid() and activo),
  grupos as (
    select y.id as g from yo y where y.rol = 'admin'
    union
    select a.perfil_id
      from yo y
      join public.perfil_hoteles t on t.perfil_id = y.id and t.aprobado
      join public.perfil_hoteles a on a.hotel_id = t.hotel_id and a.aprobado
      join public.perfiles pa on pa.id = a.perfil_id and pa.rol = 'admin' and pa.activo
     where y.rol = 'tecnico'
  ),
  convs as (
    select 'g:' || g as clave, 'grupo'::text as tipo, null::uuid as hotel_id, null::uuid as parte_id, g as grupo from grupos
    union all
    select 'h:' || h, 'hotel', h, null, null from public.mis_hoteles() h
    union all
    select distinct 'p:' || m.parte_id, 'parte', m.hotel_id, m.parte_id, null::uuid
      from public.mensajes m where m.parte_id is not null and m.hotel_id in (select public.mis_hoteles())
  )
  select c.clave, c.tipo,
         case c.tipo
           when 'grupo' then case when c.grupo = auth.uid() then 'Todos los técnicos' else 'Técnicos · ' || coalesce(pg.nombre, '') end
           when 'hotel' then coalesce(h.nombre, 'Hotel')
           else case when x.habitacion ~ '^[0-9]{1,5}[a-zA-Z]?$' then 'Hab. ' else '' end || coalesce(x.habitacion, '') || ' · ' || coalesce(x.categoria, '')
         end,
         case c.tipo
           when 'grupo' then 'Chat global con los técnicos de tus hoteles'
           when 'hotel' then 'Chat general del hotel'
           else coalesce(h.nombre, '') || ' · ' || case x.estado when 'pendiente' then 'Avisado' when 'en_camino' then 'Técnico de camino'
                  when 'en_curso' then 'Reparando' when 'esperando' then 'Falta una pieza' else 'Resuelto' end
         end,
         c.hotel_id, c.parte_id, c.grupo,
         u.texto, ua.nombre, u.autor_id, u.creado_en,
         (select count(*)::int from public.mensajes m2
           where m2.autor_id <> auth.uid()
             and m2.creado_en > coalesce((select l.leido_en from public.lecturas l where l.perfil_id = auth.uid() and l.clave = c.clave), '-infinity')
             and ((c.tipo = 'grupo' and m2.grupo = c.grupo)
               or (c.tipo = 'hotel' and m2.hotel_id = c.hotel_id and m2.parte_id is null)
               or (c.tipo = 'parte' and m2.parte_id = c.parte_id)))
    from convs c
    left join public.hoteles h on h.id = coalesce(c.hotel_id, (select hotel_id from public.partes where id = c.parte_id))
    left join public.partes x on x.id = c.parte_id
    left join public.perfiles pg on pg.id = c.grupo
    left join lateral (
      select m.texto, m.autor_id, m.creado_en from public.mensajes m
       where (c.tipo = 'grupo' and m.grupo = c.grupo)
          or (c.tipo = 'hotel' and m.hotel_id = c.hotel_id and m.parte_id is null)
          or (c.tipo = 'parte' and m.parte_id = c.parte_id)
       order by m.creado_en desc limit 1) u on true
    left join public.perfiles ua on ua.id = u.autor_id
   order by (c.tipo = 'grupo') desc, u.creado_en desc nulls last, 3
$$;

grant execute on function public.en_grupo(uuid) to authenticated;
grant execute on function public.puedo_ver_clave(text) to authenticated;
grant execute on function public.marcar_leido(text) to authenticated;
grant execute on function public.leido_por_otros(text) to authenticated;
grant execute on function public.mis_conversaciones() to authenticated;

-- ---------- Aviso al móvil ----------
create or replace function public.avisar_mensaje() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  quien  text;
  donde  text;
  sitio  text := '';
  envios jsonb;
begin
  select nombre into quien from public.perfiles where id = new.autor_id;
  if new.grupo is not null then
    donde := 'Técnicos';
  else
    select nombre into donde from public.hoteles where id = new.hotel_id;
    if new.parte_id is not null then
      select ' · ' || case when habitacion ~ '^[0-9]{1,5}[a-zA-Z]?$' then 'Hab. ' else '' end || habitacion || ' (' || categoria || ')'
        into sitio from public.partes where id = new.parte_id;
    end if;
  end if;
  select jsonb_agg(jsonb_build_object(
           'to', d.token,
           'title', coalesce(donde, 'Avisaya') || coalesce(sitio, '') || ' · ' || coalesce(quien, 'Equipo'),
           'body', left(new.texto, 180),
           'sound', 'default',
           'priority', 'high',
           'channelId', 'partes',
           'data', jsonb_build_object('tipo', 'mensaje', 'hotel_id', new.hotel_id, 'parte_id', new.parte_id, 'grupo', new.grupo)))
    into envios
    from public.dispositivos d
    join public.perfiles p on p.id = d.perfil_id and p.activo and p.id <> new.autor_id
   where (new.hotel_id is not null and exists (
            select 1 from public.perfil_hoteles ph where ph.perfil_id = p.id and ph.hotel_id = new.hotel_id and ph.aprobado))
      or (new.grupo is not null and (p.id = new.grupo or (p.rol = 'tecnico' and exists (
            select 1 from public.perfil_hoteles a join public.perfil_hoteles t on t.hotel_id = a.hotel_id and t.aprobado
             where a.perfil_id = new.grupo and a.aprobado and t.perfil_id = p.id))));
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

select 'Avisaya: bandeja de chats preparada' as resultado;
