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

-- ---------- Funciones de ayuda ----------------------------------------

-- Hotel del usuario que hace la petición
create or replace function public.mi_hotel_id() returns uuid
language sql stable security definer set search_path = public as $$
  select hotel_id from public.perfiles where id = auth.uid() and activo
$$;

create or replace function public.mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;

-- Crear un hotel nuevo: quien lo crea queda como admin
create or replace function public.crear_hotel(p_nombre_hotel text, p_mi_nombre text)
returns public.hoteles
language plpgsql security definer set search_path = public as $$
declare h public.hoteles;
begin
  if auth.uid() is null then raise exception 'Hay que iniciar sesión'; end if;
  if exists (select 1 from public.perfiles where id = auth.uid()) then
    raise exception 'Este usuario ya pertenece a un hotel';
  end if;
  insert into public.hoteles(nombre) values (trim(p_nombre_hotel)) returning * into h;
  insert into public.perfiles(id, hotel_id, nombre, rol) values (auth.uid(), h.id, trim(p_mi_nombre), 'admin');
  return h;
end $$;

-- Unirse a un hotel con el código que da el admin
create or replace function public.unirse_hotel(p_codigo text, p_mi_nombre text, p_rol text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Hay que iniciar sesión'; end if;
  if p_rol not in ('recepcion','limpieza','tecnico') then raise exception 'Rol no válido'; end if;
  select id into hid from public.hoteles where codigo_union = upper(trim(p_codigo));
  if hid is null then raise exception 'Código de hotel incorrecto'; end if;
  insert into public.perfiles(id, hotel_id, nombre, rol) values (auth.uid(), hid, trim(p_mi_nombre), p_rol)
  on conflict (id) do update set hotel_id = excluded.hotel_id, nombre = excluded.nombre, rol = excluded.rol, activo = true;
  return hid;
end $$;

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

-- ---------- Seguridad: cada uno solo ve su hotel (RLS) ----------------

alter table public.hoteles       enable row level security;
alter table public.perfiles      enable row level security;
alter table public.partes        enable row level security;
alter table public.parte_eventos enable row level security;

drop policy if exists "ver mi hotel" on public.hoteles;
create policy "ver mi hotel" on public.hoteles for select
  using (id = public.mi_hotel_id());

drop policy if exists "admin edita hotel" on public.hoteles;
create policy "admin edita hotel" on public.hoteles for update
  using (id = public.mi_hotel_id() and public.mi_rol() = 'admin');

drop policy if exists "ver compañeros" on public.perfiles;
create policy "ver compañeros" on public.perfiles for select
  using (hotel_id = public.mi_hotel_id() or id = auth.uid());

drop policy if exists "editar mi perfil" on public.perfiles;
create policy "editar mi perfil" on public.perfiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and hotel_id = public.mi_hotel_id() and rol = public.mi_rol());

drop policy if exists "admin gestiona perfiles" on public.perfiles;
create policy "admin gestiona perfiles" on public.perfiles for update
  using (hotel_id = public.mi_hotel_id() and public.mi_rol() = 'admin')
  with check (hotel_id = public.mi_hotel_id());

drop policy if exists "ver partes" on public.partes;
create policy "ver partes" on public.partes for select
  using (hotel_id = public.mi_hotel_id());

drop policy if exists "crear partes" on public.partes;
create policy "crear partes" on public.partes for insert
  with check (hotel_id = public.mi_hotel_id());

drop policy if exists "actualizar partes" on public.partes;
create policy "actualizar partes" on public.partes for update
  using (hotel_id = public.mi_hotel_id())
  with check (hotel_id = public.mi_hotel_id()
              and (tecnico_id is null or tecnico_id in (select id from public.perfiles where hotel_id = public.mi_hotel_id())));

drop policy if exists "admin borra partes" on public.partes;
create policy "admin borra partes" on public.partes for delete
  using (hotel_id = public.mi_hotel_id() and public.mi_rol() = 'admin');

drop policy if exists "ver historial" on public.parte_eventos;
create policy "ver historial" on public.parte_eventos for select
  using (hotel_id = public.mi_hotel_id());

grant execute on function public.crear_hotel(text, text)        to authenticated;
grant execute on function public.unirse_hotel(text, text, text) to authenticated;
grant execute on function public.mi_hotel_id()                   to authenticated;
grant execute on function public.mi_rol()                        to authenticated;

-- ---------- Fotos (Storage) -------------------------------------------
-- Carpeta por hotel: fotos/<hotel_id>/<archivo>.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "fotos ver mi hotel" on storage.objects;
create policy "fotos ver mi hotel" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = public.mi_hotel_id()::text);

drop policy if exists "fotos subir mi hotel" on storage.objects;
create policy "fotos subir mi hotel" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = public.mi_hotel_id()::text);

-- ---------- Tiempo real -----------------------------------------------

do $$ begin
  alter publication supabase_realtime add table public.partes;
exception when duplicate_object then null; end $$;

-- Listo.
select 'Avisaya: base de datos preparada' as resultado;
