import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';
import type { Estado, Parte, Perfil } from './tema';

export const CAMPOS =
  'id, hotel_id, habitacion, categoria, descripcion, prioridad, bloquea, estado, tecnico_id, creado_por, foto_path, nota_resolucion, creado_en, actualizado_en, cambio_estado_en, resuelto_en';

export type CambioParte = { tipo: 'nuevo' | 'estado'; parte: Parte; antes?: Estado };

/**
 * Partes del hotel en tiempo real: abiertos + resueltos de los últimos 7 días.
 * `alCambiar` se llama con los cambios que hace OTRA persona (para mostrar avisos).
 */
export function usePartes(hotelId: string | undefined, alCambiar: (c: CambioParte) => void) {
  const [partes, setPartes] = useState<Parte[]>([]);
  const [perfiles, setPerfiles] = useState<Record<string, Perfil>>({});
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const misCambios = useRef(new Set<string>());
  const avisar = useRef(alCambiar);
  const conocidos = useRef(new Map<string, Estado>());
  const perfilesRef = useRef(perfiles);
  useEffect(() => {
    avisar.current = alCambiar;
    perfilesRef.current = perfiles;
  });

  const cargarPerfiles = useCallback(async () => {
    if (!hotelId) return;
    const { data } = await supabase.from('perfiles').select('id, hotel_id, nombre, rol, activo').eq('hotel_id', hotelId);
    if (data) setPerfiles(Object.fromEntries((data as Perfil[]).map((p) => [p.id, p])));
  }, [hotelId]);

  const cargar = useCallback(async () => {
    if (!hotelId) return;
    const desde = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data, error: e } = await supabase
      .from('partes')
      .select(CAMPOS)
      .eq('hotel_id', hotelId)
      .or(`estado.neq.resuelto,resuelto_en.gte.${desde}`)
      .order('creado_en', { ascending: false })
      .limit(300);
    if (e) {
      setError('No se han podido cargar los partes. Desliza hacia abajo para reintentar.');
    } else {
      setError(null);
      const lista = (data ?? []) as Parte[];
      // Avisos de lo que haya cambiado mientras la app estaba en segundo plano
      if (conocidos.current.size) {
        for (const p of lista) {
          const antes = conocidos.current.get(p.id);
          if (antes === undefined) avisar.current({ tipo: 'nuevo', parte: p });
          else if (antes !== p.estado) avisar.current({ tipo: 'estado', parte: p, antes });
        }
      }
      conocidos.current = new Map(lista.map((p) => [p.id, p.estado]));
      setPartes(lista);
    }
    setCargando(false);
  }, [hotelId]);

  // Carga inicial + tiempo real
  useEffect(() => {
    if (!hotelId) return;
    conocidos.current = new Map();
    // Carga desde la red: los setState ocurren tras el await, no de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarPerfiles();
    cargar();
    const canal = supabase
      .channel(`partes-${hotelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partes', filter: `hotel_id=eq.${hotelId}` }, (pl) => {
        if (pl.eventType === 'DELETE') {
          const id = (pl.old as { id?: string }).id;
          if (id) setPartes((l) => l.filter((p) => p.id !== id));
          return;
        }
        const p = pl.new as Parte;
        const antes = conocidos.current.get(p.id);
        conocidos.current.set(p.id, p.estado);
        const clave = `${p.id}:${p.estado}`;
        const mio = misCambios.current.has(clave);
        misCambios.current.delete(clave);
        if (!mio) {
          if (antes === undefined) avisar.current({ tipo: 'nuevo', parte: p });
          else if (antes !== p.estado) avisar.current({ tipo: 'estado', parte: p, antes });
        }
        setPartes((l) => [p, ...l.filter((x) => x.id !== p.id)]);
        const pf = perfilesRef.current;
        if ((p.tecnico_id && !pf[p.tecnico_id]) || (p.creado_por && !pf[p.creado_por])) cargarPerfiles();
      })
      .subscribe();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') cargar();
    });
    return () => {
      supabase.removeChannel(canal);
      sub.remove();
    };
  }, [hotelId, cargar, cargarPerfiles]);

  // Enlaces temporales para ver las fotos (el almacén es privado)
  useEffect(() => {
    const faltan = partes.map((p) => p.foto_path).filter((f): f is string => !!f && !fotos[f]);
    if (!faltan.length) return;
    supabase.storage
      .from('fotos')
      .createSignedUrls(faltan, 60 * 60 * 6)
      .then(({ data }) => {
        if (!data) return;
        setFotos((f) => {
          const n = { ...f };
          for (const d of data) if (d.path && d.signedUrl) n[d.path] = d.signedUrl;
          return n;
        });
      });
  }, [partes, fotos]);

  /** Cambia un parte. Devuelve un mensaje de error o null. */
  const actualizar = useCallback(async (id: string, cambios: Partial<Parte>): Promise<string | null> => {
    if (cambios.estado) misCambios.current.add(`${id}:${cambios.estado}`);
    const { data, error: e } = await supabase.from('partes').update(cambios).eq('id', id).select(CAMPOS).maybeSingle();
    if (e || !data) return 'No se ha guardado el cambio. Revisa la conexión.';
    const p = data as Parte;
    conocidos.current.set(p.id, p.estado);
    setPartes((l) => l.map((x) => (x.id === p.id ? p : x)));
    return null;
  }, []);

  return { partes, perfiles, fotos, cargando, error, recargar: cargar, actualizar };
}

/** Sube una foto (ya reducida) y devuelve su ruta en el almacén. */
export async function subirFoto(hotelId: string, uri: string): Promise<string> {
  const nombre = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const ruta = `${hotelId}/${nombre}`;
  const datos = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from('fotos').upload(ruta, datos, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return ruta;
}
