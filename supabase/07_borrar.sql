-- Avisaya · 07 · Administración y recepción pueden eliminar partes y avisos que ya no hacen falta.
-- Se puede ejecutar varias veces sin romper nada. Ejecuta antes 01 a 06.

-- Partes: administración y recepción del hotel
drop policy if exists "admin borra partes" on public.partes;
drop policy if exists "borrar partes" on public.partes;
create policy "borrar partes" on public.partes for delete to authenticated
  using (public.es_miembro(hotel_id) and public.mi_rol() in ('admin', 'recepcion'));
grant delete on public.partes to authenticated;

-- Al borrar un parte, su chat se borra con él (antes quedaba suelto en el chat general)
alter table public.mensajes drop constraint if exists mensajes_parte_id_fkey;
alter table public.mensajes add constraint mensajes_parte_id_fkey
  foreign key (parte_id) references public.partes(id) on delete cascade;
delete from public.lecturas l where l.clave like 'p:%'
  and not exists (select 1 from public.partes x where 'p:' || x.id = l.clave);

-- Su foto también se puede borrar (misma regla: administración y recepción de ese hotel)
drop policy if exists "fotos borrar mis hoteles" on storage.objects;
create policy "fotos borrar mis hoteles" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos'
         and (storage.foldername(name))[1] in (select h::text from public.mis_hoteles() h)
         and public.mi_rol() in ('admin', 'recepcion'));

-- Avisos generales: quien lo escribió, administración y recepción
drop policy if exists "avisos borrar" on public.avisos;
create policy "avisos borrar" on public.avisos for delete to authenticated
  using (public.es_miembro(hotel_id) and (autor_id = auth.uid() or public.mi_rol() in ('admin', 'recepcion')));

select 'Avisaya: borrar partes y avisos preparado' as resultado;
