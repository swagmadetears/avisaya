-- =====================================================================
-- Avisaya · Notificaciones push (con el móvil bloqueado)
-- Pegar entero en Supabase → SQL Editor → New query → Run.
-- Requiere haber ejecutado antes 01_esquema.sql. Se puede repetir.
--
-- Cómo funciona: cuando se crea o cambia un parte, la propia base de
-- datos llama al servicio de avisos de Expo (exp.host) con la extensión
-- pg_net, que ya viene en Supabase. No hace falta ningún servidor más.
-- =====================================================================

create extension if not exists pg_net;

-- ---------- Móviles registrados ---------------------------------------
-- Uno por móvil. No se puede leer desde la app: solo con las funciones.

create table if not exists public.dispositivos (
  token          text primary key check (char_length(token) between 10 and 200),
  perfil_id      uuid not null references public.perfiles(id) on delete cascade,
  plataforma     text,
  actualizado_en timestamptz not null default now()
);
create index if not exists dispositivos_perfil_idx on public.dispositivos(perfil_id);
alter table public.dispositivos enable row level security;
-- (sin políticas: nadie lee ni escribe la tabla directamente)

-- La columna antigua de 01_esquema.sql ya no se usa (era visible para los compañeros)
alter table public.perfiles drop column if exists push_token;

create or replace function public.registrar_dispositivo(p_token text, p_plataforma text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Hay que iniciar sesión'; end if;
  if not exists (select 1 from public.perfiles where id = auth.uid()) then
    raise exception 'Primero únete a un hotel';
  end if;
  if p_token !~ '^Expo(nent)?PushToken\[[^\]]+\]$' then raise exception 'Token no válido'; end if;
  -- Si el móvil era de otra cuenta, pasa a esta
  insert into public.dispositivos(token, perfil_id, plataforma, actualizado_en)
  values (p_token, auth.uid(), left(p_plataforma, 20), now())
  on conflict (token) do update
    set perfil_id = excluded.perfil_id, plataforma = excluded.plataforma, actualizado_en = now();
end $$;

create or replace function public.borrar_dispositivo(p_token text)
returns void
language sql security definer set search_path = public as $$
  delete from public.dispositivos where token = p_token and perfil_id = auth.uid();
$$;

revoke all on function public.registrar_dispositivo(text, text) from public, anon;
revoke all on function public.borrar_dispositivo(text) from public, anon;
grant execute on function public.registrar_dispositivo(text, text) to authenticated;
grant execute on function public.borrar_dispositivo(text) to authenticated;

-- ---------- Envío de avisos -------------------------------------------

create or replace function public.avisar_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor    uuid := auth.uid();
  donde    text := case when new.habitacion ~ '^\d{1,5}[a-zA-Z]?$' then 'Hab. ' || new.habitacion else new.habitacion end;
  tecnico  text;
  hotel    text;
  titulo   text;
  cuerpo   text;
  destino  text;            -- 'tecnicos' o 'interesados'
  mensajes jsonb;
begin
  if tg_op = 'INSERT' then
    titulo  := case when new.prioridad = 'urgente' then 'URGENTE · ' else 'Nuevo parte · ' end || donde;
    cuerpo  := new.categoria || case when new.descripcion <> '' then ' — ' || left(new.descripcion, 140) else '' end;
    destino := 'tecnicos';
  elsif new.estado is distinct from old.estado then
    select nombre into tecnico from public.perfiles where id = new.tecnico_id;
    tecnico := coalesce(tecnico, 'El técnico');
    case
      when new.estado = 'pendiente' and old.estado = 'resuelto' then
        titulo := 'Reabierto · ' || donde;          cuerpo := new.categoria;                                 destino := 'tecnicos';
      when new.estado = 'en_camino' then
        titulo := tecnico || ' va de camino';        cuerpo := donde || ' · ' || new.categoria;               destino := 'interesados';
      when new.estado = 'en_curso' then
        titulo := tecnico || ' está reparando';      cuerpo := donde || ' · ' || new.categoria;               destino := 'interesados';
      when new.estado = 'esperando' then
        titulo := 'Falta una pieza · ' || donde;     cuerpo := new.categoria;                                 destino := 'interesados';
      when new.estado = 'resuelto' then
        titulo := 'Resuelto · ' || donde;            cuerpo := coalesce(nullif(new.nota_resolucion, ''), new.categoria); destino := 'interesados';
      else
        return null;
    end case;
  else
    return null;
  end if;

  select jsonb_agg(jsonb_build_object(
           'to', d.token,
           'title', titulo,
           'body', cuerpo,
           'sound', 'default',
           'priority', 'high',
           'channelId', 'partes',
           'data', jsonb_build_object('parte_id', new.id)))
    into mensajes
    from public.dispositivos d
    join public.perfiles p on p.id = d.perfil_id
    join public.perfil_hoteles ph on ph.perfil_id = p.id and ph.hotel_id = new.hotel_id and ph.aprobado
   where p.activo
     and d.perfil_id is distinct from actor           -- a quien hace el cambio no se le avisa
     and ((destino = 'tecnicos'    and p.rol = 'tecnico')
       or (destino = 'interesados' and (p.id = new.creado_por or p.rol in ('recepcion', 'admin'))));

  -- Con varios hoteles, el aviso dice siempre de cuál es
  if mensajes is not null then
    select nombre into hotel from public.hoteles where id = new.hotel_id;
    select jsonb_agg(m || jsonb_build_object('title', coalesce(hotel, 'Avisaya') || ' · ' || (m->>'title'),
                                             'data', (m->'data') || jsonb_build_object('hotel_id', new.hotel_id)))
      into mensajes
      from jsonb_array_elements(mensajes) m;

    begin
      perform net.http_post(
        url     := 'https://exp.host/--/api/v2/push/send',
        body    := mensajes,
        headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
      );
    exception when others then
      -- Un fallo al avisar nunca debe impedir guardar el parte
      raise warning 'Avisaya: no se pudo enviar el aviso: %', sqlerrm;
    end;
  end if;
  return null;
end $$;

drop trigger if exists partes_push on public.partes;
create trigger partes_push after insert or update on public.partes
  for each row execute function public.avisar_push();

-- ---------- Aviso a administración: nueva solicitud de acceso ---------

create or replace function public.avisar_solicitud() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  quien    text;
  dept     text;
  hotel    text;
  mensajes jsonb;
begin
  if new.aprobado then return null; end if;
  select nombre, rol into quien, dept from public.perfiles where id = new.perfil_id;
  select nombre into hotel from public.hoteles where id = new.hotel_id;
  dept := case dept when 'recepcion' then 'Recepción' when 'limpieza' then 'Limpieza'
                    when 'tecnico' then 'Técnico' when 'admin' then 'Administración' else dept end;
  select jsonb_agg(jsonb_build_object(
           'to', d.token,
           'title', coalesce(hotel, 'Avisaya') || ' · Solicitud de acceso',
           'body', coalesce(quien, 'Alguien') || ' (' || coalesce(dept, '') || ') quiere entrar. Revísalo en Ajustes → Equipo.',
           'sound', 'default',
           'priority', 'high',
           'channelId', 'partes',
           'data', jsonb_build_object('tipo', 'solicitud', 'hotel_id', new.hotel_id)))
    into mensajes
    from public.dispositivos d
    join public.perfiles p on p.id = d.perfil_id
    join public.perfil_hoteles ph on ph.perfil_id = p.id and ph.hotel_id = new.hotel_id and ph.aprobado
   where p.activo and p.rol = 'admin';
  if mensajes is not null then
    begin
      perform net.http_post(
        url     := 'https://exp.host/--/api/v2/push/send',
        body    := mensajes,
        headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
      );
    exception when others then
      raise warning 'Avisaya: no se pudo enviar el aviso de solicitud: %', sqlerrm;
    end;
  end if;
  return null;
end $$;

drop trigger if exists solicitud_push on public.perfil_hoteles;
create trigger solicitud_push after insert on public.perfil_hoteles
  for each row execute function public.avisar_solicitud();

select 'Avisaya: notificaciones preparadas' as resultado;
