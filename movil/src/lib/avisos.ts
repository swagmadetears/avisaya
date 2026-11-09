import { useCallback, useEffect, useState } from 'react';
import { mensajeError, supabase } from './supabase';

export type AvisoGeneral = {
  id: string;
  hotel_id: string;
  autor_id: string;
  texto: string;
  lugar: string;
  importante: boolean;
  activo: boolean;
  creado_en: string;
  cerrado_en: string | null;
  cerrado_por: string | null;
};

const CAMPOS = 'id, hotel_id, autor_id, texto, lugar, importante, activo, creado_en, cerrado_en, cerrado_por';

/** Avisos generales abiertos de los hoteles de la persona (ids separados por comas), en tiempo real. */
export function useAvisos(hotelIds: string) {
  const [avisos, setAvisos] = useState<AvisoGeneral[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    if (!hotelIds) return;
    const { data } = await supabase.from('avisos').select(CAMPOS).in('hotel_id', hotelIds.split(',')).eq('activo', true).order('creado_en', { ascending: false }).limit(50);
    setAvisos((data ?? []) as AvisoGeneral[]);
    setCargando(false);
  }, [hotelIds]);

  useEffect(() => {
    if (!hotelIds) return;
    // Carga desde la red: los setState ocurren tras el await, no de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    const canal = supabase
      .channel(`avisos-${hotelIds}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos', filter: `hotel_id=in.(${hotelIds})` }, (pl) => {
        if (pl.eventType === 'DELETE') {
          const id = (pl.old as { id?: string }).id;
          if (id) setAvisos((l) => l.filter((a) => a.id !== id));
          return;
        }
        const a = pl.new as AvisoGeneral;
        setAvisos((l) => {
          const sin = l.filter((x) => x.id !== a.id);
          return a.activo ? [a, ...sin].sort((x, y) => y.creado_en.localeCompare(x.creado_en)) : sin;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [hotelIds, cargar]);

  /** Lo da por resuelto: desaparece del tablón para todo el equipo. */
  const cerrar = useCallback(async (id: string): Promise<string | null> => {
    const antes = avisos;
    setAvisos((l) => l.filter((a) => a.id !== id));
    const { error } = await supabase.from('avisos').update({ activo: false }).eq('id', id);
    if (error) {
      setAvisos(antes);
      return mensajeError(error);
    }
    return null;
  }, [avisos]);

  return { avisos, cargando, cerrar, recargar: cargar };
}

export async function publicarAviso(hotelId: string, texto: string, lugar: string, importante: boolean): Promise<string | null> {
  const { error } = await supabase.from('avisos').insert({ hotel_id: hotelId, texto: texto.trim().slice(0, 280), lugar: lugar.trim().slice(0, 40), importante });
  return error ? mensajeError(error) : null;
}
