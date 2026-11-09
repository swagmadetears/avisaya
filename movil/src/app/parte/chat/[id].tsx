import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ChatVista } from '../../../components/ChatVista';
import { Pulsable } from '../../../components/movimiento';
import { CAMPOS } from '../../../lib/partes';
import { supabase } from '../../../lib/supabase';
import { color, esHabitacion, ESTADOS, type Parte } from '../../../lib/tema';

/** Chat de una avería: quien avisó y el técnico hablan de cómo va. */
export default function ChatDeParte() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [parte, setParte] = useState<Parte | null>(null);

  useEffect(() => {
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
  }, [id]);

  const donde = parte ? `${esHabitacion(parte.habitacion) ? 'Hab. ' : ''}${parte.habitacion}` : 'Avería';
  return (
    <ChatVista
      hotelId={parte?.hotel_id ?? null}
      parteId={id}
      titulo={`${donde} · ${parte?.categoria ?? ''}`}
      subtitulo={parte ? `${ESTADOS[parte.estado].texto}${parte.descripcion ? ' · ' + parte.descripcion : ''}` : 'Cargando…'}
      vacio="Pregunta cómo va o avisa de algo de esta avería. Le llegará al técnico y a recepción."
      antesDelTitulo={
        <Pulsable onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="Volver">
          <MaterialCommunityIcons name="chevron-left" size={24} color={color.tinta} />
        </Pulsable>
      }
    />
  );
}
