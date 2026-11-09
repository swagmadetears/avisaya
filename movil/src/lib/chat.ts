import { useCallback, useEffect, useState } from 'react';
import { mensajeError, supabase } from './supabase';

export type Mensaje = { id: string; hotel_id: string; autor_id: string; texto: string; parte_id: string | null; creado_en: string; enviando?: boolean };

const CAMPOS = 'id, hotel_id, autor_id, texto, parte_id, creado_en';

/** El chat del equipo de un hotel, en tiempo real. Los mensajes van del más nuevo al más viejo. */
export function useMensajes(hotelId: string | null, yoId: string | null, parteId: string | null = null) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    if (!hotelId) return;
    let q = supabase.from('mensajes').select(CAMPOS).eq('hotel_id', hotelId);
    q = parteId ? q.eq('parte_id', parteId) : q.is('parte_id', null);
    const { data, error: e } = await q.order('creado_en', { ascending: false }).limit(150);
    if (e) setError('No se han podido cargar los mensajes.');
    else {
      setError('');
      setMensajes((data ?? []) as Mensaje[]);
    }
    setCargando(false);
  }, [hotelId, parteId]);

  useEffect(() => {
    if (!hotelId) return;
    // Carga desde la red: los setState ocurren tras el await, no de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    cargar();
    const canal = supabase
      .channel(`mensajes-${hotelId}-${parteId ?? 'general'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `hotel_id=eq.${hotelId}` }, (pl) => {
        const m = pl.new as Mensaje;
        if ((m.parte_id ?? null) !== parteId) return;
        // El mío ya está en la lista (enviado al momento): se cambia por el definitivo
        setMensajes((l) => [m, ...l.filter((x) => x.id !== m.id && !(x.enviando && x.autor_id === m.autor_id && x.texto === m.texto))]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'mensajes', filter: `hotel_id=eq.${hotelId}` }, (pl) => {
        const id = (pl.old as { id?: string }).id;
        if (id) setMensajes((l) => l.filter((x) => x.id !== id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [hotelId, parteId, cargar]);

  /** Envía un mensaje; aparece al instante y se confirma cuando llega del servidor. */
  const enviar = useCallback(
    async (texto: string): Promise<string | null> => {
      const t = texto.trim().slice(0, 1000);
      if (!t || !hotelId || !yoId) return null;
      const temporal: Mensaje = { id: `tmp-${Date.now()}`, hotel_id: hotelId, autor_id: yoId, texto: t, parte_id: parteId, creado_en: new Date().toISOString(), enviando: true };
      setMensajes((l) => [temporal, ...l]);
      const { data, error: e } = await supabase.from('mensajes').insert({ hotel_id: hotelId, texto: t, parte_id: parteId }).select(CAMPOS).single();
      if (e) {
        setMensajes((l) => l.filter((x) => x.id !== temporal.id));
        return mensajeError(e);
      }
      setMensajes((l) => {
        const sin = l.filter((x) => x.id !== temporal.id && x.id !== (data as Mensaje).id);
        return [data as Mensaje, ...sin];
      });
      return null;
    },
    [hotelId, yoId, parteId],
  );

  const borrar = useCallback(async (id: string) => {
    setMensajes((l) => l.filter((x) => x.id !== id));
    await supabase.from('mensajes').delete().eq('id', id);
  }, []);

  return { mensajes, cargando, error, enviar, borrar, recargar: cargar };
}
