import { ScrollView, StyleSheet, Text } from 'react-native';
import { ChatVista } from '../../components/ChatVista';
import { Pulsable } from '../../components/movimiento';
import { useHotelElegido } from '../../lib/hotel-elegido';
import { useSesion } from '../../lib/sesion';
import { color, fuente } from '../../lib/tema';

/** Chat general del hotel: dudas y avisos rápidos entre recepción, limpieza y mantenimiento. */
export default function Chat() {
  const { perfil, hotel, hoteles } = useSesion();
  const [elegido, elegir] = useHotelElegido(perfil?.id);
  // El chat es de un hotel concreto: si arriba están «todos», se usa el principal
  const hotelId = hoteles.some((h) => h.id === elegido) ? elegido : (hotel?.id ?? null);
  const nombre = hoteles.find((h) => h.id === hotelId)?.nombre ?? '';
  return (
    <ChatVista
      enPestanas
      hotelId={hotelId}
      titulo="Chat"
      subtitulo={`Chat general de ${nombre}. Para hablar de una avería concreta, ábrela y pulsa «Chat de la avería».`}
      cabecera={
        hoteles.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>
            {hoteles.map((h) => {
              const activo = h.id === hotelId;
              return (
                <Pulsable key={h.id} vibra="seleccion" onPress={() => elegir(h.id)} style={[s.pastilla, activo && s.pastillaActiva]} accessibilityRole="tab" accessibilityState={{ selected: activo }}>
                  <Text style={[s.pastillaTexto, activo && { color: color.fondo }]} numberOfLines={1}>
                    {h.nombre}
                  </Text>
                </Pulsable>
              );
            })}
          </ScrollView>
        ) : null
      }
    />
  );
}

const s = StyleSheet.create({
  pastilla: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: color.superficie, maxWidth: 200 },
  pastillaActiva: { backgroundColor: color.tinta },
  pastillaTexto: { fontFamily: fuente.textoFuerte, fontSize: 14, color: color.tinta },
});
