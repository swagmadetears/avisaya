import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ChatVista } from '../../../components/ChatVista';
import type { Conv, TipoConv } from '../../../lib/chat';
import { CAMPOS } from '../../../lib/partes';
import { useSesion } from '../../../lib/sesion';
import { supabase } from '../../../lib/supabase';
import { esHabitacion, ESTADOS, type Parte } from '../../../lib/tema';

/** Una conversación: el chat general de un hotel, el de una avería o el global con los técnicos. */
export default function Conversacion() {
  const router = useRouter();
  const { tipo, id, titulo: tituloParam, sub } = useLocalSearchParams<{ tipo: TipoConv; id: string; titulo?: string; sub?: string }>();
  const { perfil, hoteles } = useSesion();
  const [parte, setParte] = useState<Parte | null>(null);

  useEffect(() => {
    if (tipo !== 'p') return;
    let vivo = true;
    supabase
      .from('partes')
      .select(CAMPOS)
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (vivo && data) setParte(data as Parte);
      });
    return () => {
      vivo = false;
    };
  }, [tipo, id]);

  const hotel = hoteles.find((h) => h.id === (tipo === 'h' ? id : parte?.hotel_id));
  const conv: Conv | null = tipo === 'p' ? (parte ? { tipo, id, hotelId: parte.hotel_id } : null) : tipo === 'h' || tipo === 'g' ? { tipo, id, hotelId: tipo === 'h' ? id : null } : null;

  let titulo = tituloParam ?? '';
  let subtitulo = sub ?? '';
  if (tipo === 'h') {
    titulo = hotel?.nombre ?? titulo;
    subtitulo = 'Chat general del hotel';
  } else if (tipo === 'g') {
    titulo = id === perfil?.id ? 'Todos los técnicos' : titulo || 'Técnicos';
    subtitulo = 'Chat global con los técnicos de tus hoteles';
  } else if (parte) {
    titulo = `${esHabitacion(parte.habitacion) ? 'Hab. ' : ''}${parte.habitacion} · ${parte.categoria}`;
    subtitulo = `${hotel ? hotel.nombre + ' · ' : ''}${ESTADOS[parte.estado].texto}`;
  }

  return (
    <ChatVista
      conv={conv}
      titulo={titulo || 'Chat'}
      subtitulo={subtitulo}
      onVolver={() => (router.canGoBack() ? router.back() : router.replace('/chat'))}
      vacio={tipo === 'p' ? 'Pregunta cómo va o avisa de algo de esta avería. Le llegará al técnico y a recepción.' : tipo === 'g' ? 'Escribe a todos los técnicos de tus hoteles a la vez.' : undefined}
    />
  );
}
