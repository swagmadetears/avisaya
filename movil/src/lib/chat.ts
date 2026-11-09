import { useCallback, useEffect, useRef, useState } from 'react';
import { mensajeError, supabase } from './supabase';

export type Mensaje = {
  id: string;
  hotel_id: string | null;
  autor_id: string;
  texto: string;
  parte_id: string | null;
  grupo: string | null;
  creado_en: string;
  enviando?: boolean;
};

/** Una conversación: el chat general de un hotel (h), el de una avería (p) o el global con los técnicos (g). */
export type TipoConv = 'h' | 'p' | 'g';
export type Conv = { tipo: TipoConv; id: string; hotelId: string | null };
export const claveDe = (c: { tipo: TipoConv; id: string }) => `${c.tipo}:${c.id}`;

export type Conversacion = {
  clave: string;
  tipo: 'hotel' | 'parte' | 'grupo';
  titulo: string;
  subtitulo: string;
  hotel_id: string | null;
  parte_id: string | null;
  grupo: string | null;
  ultimo_texto: string | null;
  ultimo_autor: string | null;
  ultimo_autor_id: string | null;
  ultimo_en: string | null;
  no_leidos: number;
};

const CAMPOS = 'id, hotel_id, autor_id, texto, parte_id, grupo, creado_en';

const deEsta = (c: Conv, m: Mensaje) =>
  c.tipo === 'g' ? m.grupo === c.id : c.tipo === 'p' ? m.parte_id === c.id : m.hotel_id === c.id && !m.parte_id;

/**
 * Los mensajes de una conversación, en tiempo real (del más nuevo al más viejo), quién está escribiendo
 * y hasta cuándo han leído los demás (para el doble tic).
 */
export function useMensajes(conv: Conv | null, yoId: string | null, yoNombre: string) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [leidoOtros, setLeidoOtros] = useState<string | null>(null);
  const [escribiendo, setEscribiendo] = useState<Record<string, { nombre: string; hasta: number }>>({});
  const canalRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const ultimoAviso = useRef(0);
  const clave = conv ? claveDe(conv) : '';
  const tipo = conv?.tipo ?? null;
  const id = conv?.id ?? null;
  const hotelId = conv?.hotelId ?? null;

  const marcarLeido = useCallback(() => {
    if (clave) supabase.rpc('marcar_leido', { p_clave: clave }).then(() => {});
  }, [clave]);

  const mirarLeido = useCallback(async () => {
    if (!clave) return;
    const { data } = await supabase.rpc('leido_por_otros', { p_clave: clave });
    setLeidoOtros((data as string | null) ?? null);
  }, [clave]);

  const cargar = useCallback(async () => {
    if (!tipo || !id) return;
    let q = supabase.from('mensajes').select(CAMPOS);
    q = tipo === 'g' ? q.eq('grupo', id) : tipo === 'p' ? q.eq('parte_id', id) : q.eq('hotel_id', id).is('parte_id', null);
    const { data, error: e } = await q.order('creado_en', { ascending: false }).limit(200);
    if (e) setError('No se han podido cargar los mensajes.');
    else {
      setError('');
      setMensajes((data ?? []) as Mensaje[]);
    }
    setCargando(false);
  }, [tipo, id]);

  useEffect(() => {
    if (!tipo || !id || !yoId) return;
    const c: Conv = { tipo, id, hotelId };
    // Carga desde la red: los setState ocurren tras el await, no de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    cargar().then(marcarLeido);
    mirarLeido();
    const filtro = tipo === 'g' ? `grupo=eq.${id}` : hotelId ? `hotel_id=eq.${hotelId}` : undefined;
    const canal = supabase
      .channel(`chat-${tipo}-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', ...(filtro ? { filter: filtro } : {}) }, (pl) => {
        const m = pl.new as Mensaje;
        if (!deEsta(c, m)) return;
        // El mío ya está en la lista (enviado al momento): se cambia por el definitivo
        setMensajes((l) => [m, ...l.filter((x) => x.id !== m.id && !(x.enviando && x.autor_id === m.autor_id && x.texto === m.texto))]);
        if (m.autor_id !== yoId) {
          setEscribiendo((e) => {
            const sin = { ...e };
            delete sin[m.autor_id];
            return sin;
          });
          marcarLeido();
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'mensajes' }, (pl) => {
        const borrado = (pl.old as { id?: string }).id;
        if (borrado) setMensajes((l) => l.filter((x) => x.id !== borrado));
      })
      .on('broadcast', { event: 'escribiendo' }, ({ payload }) => {
        const p = payload as { perfil_id: string; nombre: string };
        if (!p?.perfil_id || p.perfil_id === yoId) return;
        setEscribiendo((e) => ({ ...e, [p.perfil_id]: { nombre: p.nombre, hasta: Date.now() + 4500 } }));
      })
      .on('broadcast', { event: 'leido' }, () => {
        mirarLeido();
      })
      .subscribe();
    canalRef.current = canal;
    // Cuando alguien abre la conversación, avisa para que los demás vean el doble tic en verde
    const t = setTimeout(() => canal.send({ type: 'broadcast', event: 'leido', payload: {} }), 1200);
    const vigilar = setInterval(mirarLeido, 15000);
    return () => {
      clearTimeout(t);
      clearInterval(vigilar);
      canalRef.current = null;
      supabase.removeChannel(canal);
    };
  }, [tipo, id, hotelId, yoId, cargar, marcarLeido, mirarLeido]);

  // Los «escribiendo…» caducan solos
  useEffect(() => {
    const t = setInterval(() => {
      setEscribiendo((e) => {
        const ahora = Date.now();
        const vivos = Object.fromEntries(Object.entries(e).filter(([, v]) => v.hasta > ahora));
        return Object.keys(vivos).length === Object.keys(e).length ? e : vivos;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  /** Avisa a los demás de que estoy escribiendo (como mucho cada 2,5 s). */
  const estoyEscribiendo = useCallback(() => {
    const ahora = Date.now();
    if (!yoId || !canalRef.current || ahora - ultimoAviso.current < 2500) return;
    ultimoAviso.current = ahora;
    canalRef.current.send({ type: 'broadcast', event: 'escribiendo', payload: { perfil_id: yoId, nombre: yoNombre } });
  }, [yoId, yoNombre]);

  /** Envía un mensaje; aparece al instante y se confirma cuando llega del servidor. */
  const enviar = useCallback(
    async (texto: string): Promise<string | null> => {
      const t = texto.trim().slice(0, 1000);
      if (!t || !tipo || !id || !yoId) return null;
      const fila = tipo === 'g' ? { grupo: id } : tipo === 'p' ? { hotel_id: hotelId, parte_id: id } : { hotel_id: id };
      const temporal: Mensaje = { id: `tmp-${Date.now()}`, hotel_id: null, parte_id: null, grupo: null, ...fila, autor_id: yoId, texto: t, creado_en: new Date().toISOString(), enviando: true };
      setMensajes((l) => [temporal, ...l]);
      const { data, error: e } = await supabase.from('mensajes').insert({ ...fila, texto: t }).select(CAMPOS).single();
      if (e) {
        setMensajes((l) => l.filter((x) => x.id !== temporal.id));
        return mensajeError(e);
      }
      setMensajes((l) => [data as Mensaje, ...l.filter((x) => x.id !== temporal.id && x.id !== (data as Mensaje).id)]);
      marcarLeido();
      return null;
    },
    [tipo, id, hotelId, yoId, marcarLeido],
  );

  return { mensajes, cargando, error, enviar, leidoOtros, escribiendo: Object.values(escribiendo).map((v) => v.nombre), estoyEscribiendo, recargar: cargar };
}

/** La bandeja: todas las conversaciones de la persona, con el último mensaje y los no leídos. */
export function useConversaciones() {
  const [lista, setLista] = useState<Conversacion[] | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('mis_conversaciones');
    if (e) setError('No se han podido cargar los chats.');
    else {
      setError('');
      setLista((data ?? []) as Conversacion[]);
    }
  }, []);
  useEffect(() => {
    // Carga desde la red: los setState ocurren tras el await, no de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    let t: ReturnType<typeof setTimeout> | null = null;
    const canal = supabase
      .channel('bandeja')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, () => {
        if (t) clearTimeout(t);
        t = setTimeout(cargar, 400);
      })
      .subscribe();
    return () => {
      if (t) clearTimeout(t);
      supabase.removeChannel(canal);
    };
  }, [cargar]);
  return { lista, error, recargar: cargar };
}
