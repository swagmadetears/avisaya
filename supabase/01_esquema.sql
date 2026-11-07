-- =====================================================================
-- Avisaya · Esquema de base de datos (Supabase / PostgreSQL)
-- Pegar entero en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- ---------- Tablas ----------------------------------------------------

create table if not exists public.hoteles (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (char_length(nombre) between 2 and 80),
  codigo_union  text not null unique default upper(substr(md5(random()::text), 1, 6)),
  creado_en     timestamptz not null default now()
);

create table if not exists public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  hotel_id    uuid not null references public.hoteles(id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 1 and 40),
  rol         text not null check (rol in ('admin','recepcion','limpieza','tecnico')),
  push_token  text,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);
create index if not exists perfiles_hotel_idx on public.perfiles(hotel_id);

create table if not exists public.partes (
  id                 uuid primary key default gen_random_uuid(),
  hotel_id           uuid not null references public.hoteles(id) on delete cascade,
  habitacion         text not null check (char_length(habitacion) between 1 and 30),
  categoria          text not null check (categoria in ('Fontanería','Electricidad','Climatización','TV / WiFi','Cerraduras','Mobiliario','Otro')),
  descripcion        text not null default '' check (char_length(descripcion) <= 600),
  prioridad          text not null default 'normal' check (prioridad in ('urgente','normal','baja')),
  bloquea            boolean not null default false,
  estado             text not null default 'pendiente' check (estado in ('pendiente','en_camino','en_curso','esperando','resuelto')),
  tecnico_id         uuid references public.perfiles(id) on delete set null,
  creado_por         uuid references public.perfiles(id) on delete set null,
  foto_path          text,
  nota_resolucion    text not null default '' check (char_length(nota_resolucion) <= 400),
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  cambio_estado_en   timestamptz not null default now(),
  resuelto_en        timestamptz
);
create index if not exists partes_hotel_estado_idx on public.partes(hotel_id, estado);

create table if not exists public.parte_eventos (
  id         bigint generated always as identity primary key,
  parte_id   uuid not null references public.partes(id) on delete cascade,
  hotel_id   uuid not null references public.hoteles(id) on delete cascade,
  actor_id   uuid references public.perfiles(id) on delete set null,
  tipo       text not null,            -- 'creado', 'estado', 'reasignado'
  estado     text,
  creado_en  timestamptz not null default now()
);
create index if not exists eventos_parte_idx on public.parte_eventos(parte_id);

-- ---------- Varios hoteles por persona ---------------------------------
-- Una persona (sobre todo de mantenimiento) puede trabajar en varios hoteles.
-- perfiles.hotel_id queda como su hotel principal (el primero al que se unió).

create table if not exists public.perfil_hoteles (
  perfil_id  uuid not null references public.perfiles(id) on delete cascade,
  hotel_id   uuid not null references public.hoteles(id) on delete cascade,
  creado_en  timestamptz not null default now(),
  primary key (perfil_id, hotel_id)
);
create index if not exists perfil_hoteles_hotel_idx on public.perfil_hoteles(hotel_id);

-- Quien ya estaba en un hotel antes de este cambio sigue en él
insert into public.perfil_hoteles(perfil_id, hotel_id)
select id, hotel_id from public.perfiles
on conflict do nothing;

-- Solicitudes de acceso: quien entra con un código queda pendiente hasta que
-- administración lo aprueba. Quien ya estaba dentro antes de este cambio queda aprobado.
alter table public.perfil_hoteles add column if not exists aprobado boolean;
update public.perfil_hoteles set aprobado = true where aprobado is null;
alter table public.perfil_hoteles alter column aprobado set default false;
alter table public.perfil_hoteles alter column aprobado set not null;

-- ---------- Funciones de ayuda ----------------------------------------

-- Hotel principal de quien hace la petición
create or replace function public.mi_hotel_id() returns uuid
language sql stable security definer set search_path = public as $$
  select hotel_id from public.perfiles where id = auth.uid() and activo
$$;

create or replace function public.mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;

-- Todos los hoteles de quien hace la petición
create or replace function public.mis_hoteles() returns setof uuid
language sql stable security definer set search_path = public as $$
  select ph.hotel_id
    from public.perfil_hoteles ph
    join public.perfiles p on p.id = ph.perfil_id
   where ph.perfil_id = auth.uid() and p.activo and ph.aprobado
$$;

-- ¿Quien hace la petición trabaja en este hotel?
create or replace function public.es_miembro(p_hotel uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mis_hoteles() h where h = p_hotel)
$$;

-- ¿Esta persona coincide en algún hotel con quien hace la petición?
create or replace function public.comparte_hotel(p_perfil uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfil_hoteles ph
                  where ph.perfil_id = p_perfil and ph.aprobado and ph.hotel_id in (select public.mis_hoteles()))
$$;

-- ¿Esta persona trabaja en este hotel?
create or replace function public.perfil_en_hotel(p_perfil uuid, p_hotel uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfil_hoteles where perfil_id = p_perfil and hotel_id = p_hotel and aprobado)
$$;

-- Crear un hotel nuevo. Una persona nueva queda como administración.
-- Si ya tiene cuenta, solo administración puede crear más hoteles.
create or replace function public.crear_hotel(p_nombre_hotel text, p_mi_nombre text)
returns public.hoteles
language plpgsql security definer set search_path = public as $$
declare h public.hoteles; ya_existe boolean;
begin
  if auth.uid() is null then raise exception 'Hay que iniciar sesión'; end if;
  select exists (select 1 from public.perfiles where id = auth.uid()) into ya_existe;
  if ya_existe and coalesce(public.mi_rol(), '') <> 'admin' then
    raise exception 'Solo administración puede crear hoteles nuevos. Para unirte a otro hotel usa su código.';
  end if;
  insert into public.hoteles(nombre) values (trim(p_nombre_hotel)) returning * into h;
  if not ya_existe then
    insert into public.perfiles(id, hotel_id, nombre, rol) values (auth.uid(), h.id, trim(p_mi_nombre), 'admin');
  end if;
  insert into public.perfil_hoteles(perfil_id, hotel_id, aprobado) values (auth.uid(), h.id, true)
  on conflict (perfil_id, hotel_id) do update set aprobado = true;
  return h;
end $$;

-- Pedir acceso a un hotel con su código. La solicitud queda pendiente hasta que
-- administración de ese hotel la apruebe. Si la persona ya tiene cuenta, mantiene
-- su nombre y su departamento.
create or replace function public.unirse_hotel(p_codigo text, p_mi_nombre text, p_rol text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Hay que iniciar sesión'; end if;
  select id into hid from public.hoteles where codigo_union = upper(trim(p_codigo));
  if hid is null then raise exception 'Código de hotel incorrecto'; end if;
  if exists (select 1 from public.perfiles where id = auth.uid()) then
    -- Una cuenta desactivada por administración no se reactiva sola con un código
    if exists (select 1 from public.perfiles where id = auth.uid() and not activo) then
      raise exception 'Tu cuenta está desactivada. Habla con administración de tu hotel.';
    end if;
  else
    if p_rol not in ('recepcion','limpieza','tecnico') then raise exception 'Rol no válido'; end if;
    insert into public.perfiles(id, hotel_id, nombre, rol) values (auth.uid(), hid, trim(p_mi_nombre), p_rol);
  end if;
  insert into public.perfil_hoteles(perfil_id, hotel_id, aprobado) values (auth.uid(), hid, false) on conflict do nothing;
  return hid;
end $$;

-- Mis solicitudes pendientes (para mostrar «esperando aprobación»)
create or replace function public.mis_solicitudes()
returns table (hotel_id uuid, hotel text, creado_en timestamptz)
language sql stable security definer set search_path = public as $$
  select h.id, h.nombre, ph.creado_en
    from public.perfil_hoteles ph
    join public.hoteles h on h.id = ph.hotel_id
   where ph.perfil_id = auth.uid() and not ph.aprobado
   order by ph.creado_en
$$;

-- Retirar mi solicitud (por ejemplo, si me equivoqué de código)
create or replace function public.cancelar_solicitud(p_hotel uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.perfil_hoteles where perfil_id = auth.uid() and hotel_id = p_hotel and not aprobado;
  -- Si no le queda ningún hotel, se borra su perfil para que pueda empezar de nuevo
  delete from public.perfiles p where p.id = auth.uid()
     and not exists (select 1 from public.perfil_hoteles ph where ph.perfil_id = p.id);
end $$;

-- ---------- Equipo: lo que puede hacer administración --------------------
-- Solo sobre personas que comparten algún hotel con quien administra,
-- y solo con los hoteles en los que quien administra también está.

-- Lista del equipo con su correo y sus hoteles (los que ve quien administra)
create or replace function public.admin_equipo()
returns table (id uuid, nombre text, rol text, activo boolean, correo text, hoteles uuid[])
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.mi_rol(), '') <> 'admin' then raise exception 'Solo administración puede ver el equipo'; end if;
  return query
    select p.id, p.nombre, p.rol, p.activo, u.email::text,
           array(select ph.hotel_id from public.perfil_hoteles ph
                  where ph.perfil_id = p.id and ph.aprobado and ph.hotel_id in (select public.mis_hoteles()) order by ph.hotel_id)
      from public.perfiles p
      left join auth.users u on u.id = p.id
     where public.comparte_hotel(p.id)
     order by p.activo desc, p.nombre;
end $$;

-- Cambiar nombre, departamento y si la cuenta está activa
create or replace function public.admin_editar_persona(p_perfil uuid, p_nombre text, p_rol text, p_activo boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.mi_rol(), '') <> 'admin' then raise exception 'Solo administración puede cambiar el equipo'; end if;
  if not public.comparte_hotel(p_perfil) then raise exception 'Esa persona no está en tus hoteles'; end if;
  if p_rol not in ('admin','recepcion','limpieza','tecnico') then raise exception 'Departamento no válido'; end if;
  if char_length(trim(coalesce(p_nombre, ''))) not between 1 and 40 then raise exception 'El nombre debe tener entre 1 y 40 letras'; end if;
  if p_perfil = auth.uid() and (p_rol <> 'admin' or not p_activo) then
    raise exception 'No puedes quitarte tu propio acceso de administración. Pídeselo a otra persona de administración.';
  end if;
  update public.perfiles set nombre = trim(p_nombre), rol = p_rol, activo = p_activo where id = p_perfil;
end $$;

-- Dar o quitar un hotel a una persona
create or replace function public.admin_hotel_persona(p_perfil uuid, p_hotel uuid, p_dentro boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare otro uuid;
begin
  if coalesce(public.mi_rol(), '') <> 'admin' then raise exception 'Solo administración puede cambiar el equipo'; end if;
  if not public.es_miembro(p_hotel) then raise exception 'Solo puedes gestionar hoteles en los que estás'; end if;
  if not public.comparte_hotel(p_perfil) then raise exception 'Esa persona no está en tus hoteles'; end if;
  if p_dentro then
    insert into public.perfil_hoteles(perfil_id, hotel_id, aprobado) values (p_perfil, p_hotel, true)
    on conflict (perfil_id, hotel_id) do update set aprobado = true;
  else
    select hotel_id into otro from public.perfil_hoteles where perfil_id = p_perfil and hotel_id <> p_hotel and aprobado limit 1;
    if otro is null then
      raise exception 'Tiene que quedarse en al menos un hotel. Para quitarle el acceso, desactiva su cuenta.';
    end if;
    delete from public.perfil_hoteles where perfil_id = p_perfil and hotel_id = p_hotel;
    -- Si era su hotel principal, pasa a otro de los suyos
    update public.perfiles set hotel_id = otro where id = p_perfil and hotel_id = p_hotel;
  end if;
end $$;

-- Solicitudes de acceso pendientes en los hoteles de quien administra
create or replace function public.admin_solicitudes()
returns table (perfil_id uuid, nombre text, rol text, correo text, hotel_id uuid, hotel text, creado_en timestamptz, ya_es_miembro boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.mi_rol(), '') <> 'admin' then raise exception 'Solo administración puede ver las solicitudes'; end if;
  return query
    select p.id, p.nombre, p.rol, u.email::text, h.id, h.nombre, ph.creado_en,
           exists (select 1 from public.perfil_hoteles o where o.perfil_id = p.id and o.aprobado)
      from public.perfil_hoteles ph
      join public.perfiles p on p.id = ph.perfil_id
      join public.hoteles h on h.id = ph.hotel_id
      left join auth.users u on u.id = p.id
     where not ph.aprobado and ph.hotel_id in (select public.mis_hoteles())
     order by ph.creado_en;
end $$;

-- Aprobar (con el departamento que decida administración) o rechazar una solicitud
create or replace function public.admin_resolver_solicitud(p_perfil uuid, p_hotel uuid, p_aprobar boolean, p_rol text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.mi_rol(), '') <> 'admin' then raise exception 'Solo administración puede resolver solicitudes'; end if;
  if not public.es_miembro(p_hotel) then raise exception 'Solo puedes resolver solicitudes de tus hoteles'; end if;
  if not exists (select 1 from public.perfil_hoteles where perfil_id = p_perfil and hotel_id = p_hotel and not aprobado) then
    raise exception 'Esa solicitud ya no está pendiente';
  end if;
  if p_aprobar then
    update public.perfil_hoteles set aprobado = true where perfil_id = p_perfil and hotel_id = p_hotel;
    -- El departamento solo se cambia si la persona aún no estaba aprobada en ningún otro hotel
    if p_rol is not null and not exists (select 1 from public.perfil_hoteles where perfil_id = p_perfil and aprobado and hotel_id <> p_hotel) then
      if p_rol not in ('admin','recepcion','limpieza','tecnico') then raise exception 'Departamento no válido'; end if;
      update public.perfiles set rol = p_rol where id = p_perfil;
    end if;
  else
    delete from public.perfil_hoteles where perfil_id = p_perfil and hotel_id = p_hotel and not aprobado;
    delete from public.perfiles p where p.id = p_perfil
       and not exists (select 1 from public.perfil_hoteles ph where ph.perfil_id = p.id);
  end if;
end $$;

revoke all on function public.admin_solicitudes() from public, anon;
revoke all on function public.admin_resolver_solicitud(uuid, uuid, boolean, text) from public, anon;
revoke all on function public.mis_solicitudes() from public, anon;
revoke all on function public.cancelar_solicitud(uuid) from public, anon;
grant execute on function public.admin_solicitudes() to authenticated;
grant execute on function public.admin_resolver_solicitud(uuid, uuid, boolean, text) to authenticated;
grant execute on function public.mis_solicitudes() to authenticated;
grant execute on function public.cancelar_solicitud(uuid) to authenticated;

revoke all on function public.admin_equipo() from public, anon;
revoke all on function public.admin_editar_persona(uuid, text, text, boolean) from public, anon;
revoke all on function public.admin_hotel_persona(uuid, uuid, boolean) from public, anon;
grant execute on function public.admin_equipo() to authenticated;
grant execute on function public.admin_editar_persona(uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_hotel_persona(uuid, uuid, boolean) to authenticated;

-- ---------- Disparadores (fechas e historial automáticos) -------------

create or replace function public.partes_antes() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
    new.estado := 'pendiente';
    new.tecnico_id := null;
    new.creado_en := now(); new.actualizado_en := now(); new.cambio_estado_en := now();
    return new;
  end if;
  -- No se puede mover un parte a otro hotel ni cambiar quién lo creó
  new.hotel_id := old.hotel_id;
  new.creado_por := old.creado_por;
  new.creado_en := old.creado_en;
  new.actualizado_en := now();
  if new.estado is distinct from old.estado then
    new.cambio_estado_en := now();
    new.resuelto_en := case when new.estado = 'resuelto' then now() else null end;
    if new.estado = 'pendiente' then new.tecnico_id := null; end if;
  end if;
  return new;
end $$;

create or replace function public.partes_despues() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.parte_eventos(parte_id, hotel_id, actor_id, tipo, estado)
    values (new.id, new.hotel_id, auth.uid(), 'creado', new.estado);
  elsif new.estado is distinct from old.estado then
    insert into public.parte_eventos(parte_id, hotel_id, actor_id, tipo, estado)
    values (new.id, new.hotel_id, auth.uid(), 'estado', new.estado);
  elsif new.tecnico_id is distinct from old.tecnico_id then
    insert into public.parte_eventos(parte_id, hotel_id, actor_id, tipo, estado)
    values (new.id, new.hotel_id, auth.uid(), 'reasignado', new.estado);
  end if;
  return null;
end $$;

drop trigger if exists partes_antes on public.partes;
create trigger partes_antes before insert or update on public.partes
  for each row execute function public.partes_antes();

drop trigger if exists partes_despues on public.partes;
create trigger partes_despues after insert or update on public.partes
  for each row execute function public.partes_despues();

-- ---------- Seguridad: cada uno solo ve sus hoteles (RLS) -------------

alter table public.hoteles        enable row level security;
alter table public.perfiles       enable row level security;
alter table public.perfil_hoteles enable row level security;
alter table public.partes         enable row level security;
alter table public.parte_eventos  enable row level security;

drop policy if exists "ver mi hotel" on public.hoteles;
drop policy if exists "ver mis hoteles" on public.hoteles;
create policy "ver mis hoteles" on public.hoteles for select
  using (public.es_miembro(id));

drop policy if exists "admin edita hotel" on public.hoteles;
create policy "admin edita hotel" on public.hoteles for update
  using (public.es_miembro(id) and public.mi_rol() = 'admin');

drop policy if exists "ver compañeros" on public.perfiles;
create policy "ver compañeros" on public.perfiles for select
  using (id = auth.uid() or public.comparte_hotel(id));

drop policy if exists "editar mi perfil" on public.perfiles;
create policy "editar mi perfil" on public.perfiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and hotel_id = public.mi_hotel_id() and rol = public.mi_rol());

-- La administración cambia a otras personas con las funciones de «Equipo» (más abajo)
drop policy if exists "admin gestiona perfiles" on public.perfiles;

drop policy if exists "ver miembros" on public.perfil_hoteles;
create policy "ver miembros" on public.perfil_hoteles for select
  using (perfil_id = auth.uid() or public.es_miembro(hotel_id));

drop policy if exists "ver partes" on public.partes;
create policy "ver partes" on public.partes for select
  using (public.es_miembro(hotel_id));

drop policy if exists "crear partes" on public.partes;
create policy "crear partes" on public.partes for insert
  with check (public.es_miembro(hotel_id));

drop policy if exists "actualizar partes" on public.partes;
create policy "actualizar partes" on public.partes for update
  using (public.es_miembro(hotel_id))
  with check (public.es_miembro(hotel_id)
              and (tecnico_id is null or public.perfil_en_hotel(tecnico_id, hotel_id)));

drop policy if exists "admin borra partes" on public.partes;
create policy "admin borra partes" on public.partes for delete
  using (public.es_miembro(hotel_id) and public.mi_rol() = 'admin');

drop policy if exists "ver historial" on public.parte_eventos;
create policy "ver historial" on public.parte_eventos for select
  using (public.es_miembro(hotel_id));

grant execute on function public.crear_hotel(text, text)        to authenticated;
grant execute on function public.unirse_hotel(text, text, text) to authenticated;
grant execute on function public.mi_hotel_id()                   to authenticated;
grant execute on function public.mi_rol()                        to authenticated;
grant execute on function public.mis_hoteles()                   to authenticated;
grant execute on function public.es_miembro(uuid)                to authenticated;
grant execute on function public.comparte_hotel(uuid)            to authenticated;
grant execute on function public.perfil_en_hotel(uuid, uuid)     to authenticated;

-- ---------- Fotos (Storage) -------------------------------------------
-- Carpeta por hotel: fotos/<hotel_id>/<archivo>.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "fotos ver mi hotel" on storage.objects;
drop policy if exists "fotos ver mis hoteles" on storage.objects;
create policy "fotos ver mis hoteles" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] in (select h::text from public.mis_hoteles() h));

drop policy if exists "fotos subir mi hotel" on storage.objects;
drop policy if exists "fotos subir mis hoteles" on storage.objects;
create policy "fotos subir mis hoteles" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] in (select h::text from public.mis_hoteles() h));

-- ---------- Tiempo real -----------------------------------------------

do $$ begin
  alter publication supabase_realtime add table public.partes;
exception when duplicate_object then null; end $$;

-- Listo.
select 'Avisaya: base de datos preparada' as resultado;
