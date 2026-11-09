import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import type { AvisoGeneral } from '../lib/avisos';
import { color, fuente, hace, suave, type Perfil } from '../lib/tema';
import { Pulsable, toque } from './movimiento';

type Props = {
  avisos: AvisoGeneral[];
  perfiles: Record<string, Perfil>;
  nombresHotel?: Record<string, string>;
  hotelNuevo: string | null;
  onCerrar: (id: string) => Promise<string | null>;
};

/** Tablón de avisos generales: «Sofá cama de la 1C roto». Todo el equipo lo ve hasta que alguien lo cierra. */
export function Tablon({ avisos, perfiles, nombresHotel, hotelNuevo, onCerrar }: Props) {
  const router = useRouter();
  const [cerrando, setCerrando] = useState<string | null>(null);

  function preguntarCerrar(a: AvisoGeneral) {
    Alert.alert('¿Ya está resuelto?', `${a.lugar ? a.lugar + ': ' : ''}${a.texto}\n\nDesaparecerá del tablón para todo el equipo.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sí, quitar aviso',
        onPress: async () => {
          setCerrando(a.id);
          const e = await onCerrar(a.id);
          setCerrando(null);
          if (e) Alert.alert('No se ha podido quitar', e);
          else toque('exito');
        },
      },
    ]);
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={s.cabecera}>
        <MaterialCommunityIcons name="pin-outline" size={18} color={color.acento} />
        <Text style={s.titulo}>Avisos del hotel</Text>
        {avisos.length ? <Text style={s.cuenta}>{avisos.length}</Text> : null}
        <View style={{ flex: 1 }} />
        <Pulsable onPress={() => router.push({ pathname: '/aviso', params: { hotel: hotelNuevo ?? '' } })} style={s.nuevo} accessibilityRole="button" accessibilityLabel="Nuevo aviso general">
          <MaterialCommunityIcons name="plus" size={16} color={color.acento} />
          <Text style={s.nuevoTexto}>Aviso</Text>
        </Pulsable>
      </View>

      {avisos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
          {avisos.map((a) => {
            const autor = perfiles[a.autor_id];
            const tono = a.importante ? color.pendiente : color.curso;
            return (
              <Animated.View key={a.id} entering={FadeIn.duration(320)} exiting={FadeOutUp.duration(260)} layout={LinearTransition.springify().damping(20)}>
                <Pulsable onLongPress={() => preguntarCerrar(a)} onPress={() => preguntarCerrar(a)} style={[s.tarjeta, { borderColor: suave(tono, 0.45) }, cerrando === a.id && { opacity: 0.5 }]} accessibilityRole="button" accessibilityHint="Toca para darlo por resuelto">
                  <View style={s.fila}>
                    <View style={[s.punto, { backgroundColor: tono }]} />
                    {a.lugar ? <Text style={[s.lugar, { color: tono }]} numberOfLines={1}>{a.lugar}</Text> : <Text style={[s.lugar, { color: tono }]}>{a.importante ? 'Importante' : 'Aviso'}</Text>}
                  </View>
                  <Text style={s.texto} numberOfLines={3} selectable>
                    {a.texto}
                  </Text>
                  <Text style={s.pie} numberOfLines={1}>
                    {nombresHotel && nombresHotel[a.hotel_id] ? `${nombresHotel[a.hotel_id]} · ` : ''}
                    {autor?.nombre ?? 'Equipo'} · {hace(a.creado_en)}
                  </Text>
                </Pulsable>
              </Animated.View>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={s.vacio}>Sin avisos. Usa «Aviso» para dejar algo a la vista de todos, como «Sofá cama de la 1C roto».</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titulo: { fontFamily: fuente.textoFuerte, fontSize: 16, color: color.tinta },
  cuenta: { fontFamily: fuente.numero, fontSize: 12, color: color.fondo, backgroundColor: color.acento, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1, overflow: 'hidden' },
  nuevo: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: suave(color.acento, 0.14) },
  nuevoTexto: { fontFamily: fuente.textoFuerte, fontSize: 13.5, color: color.acento },
  tarjeta: { width: 230, gap: 6, padding: 14, borderRadius: 18, borderCurve: 'continuous', backgroundColor: color.superficie, borderWidth: 1 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  punto: { width: 7, height: 7, borderRadius: 4 },
  lugar: { fontFamily: fuente.textoFuerte, fontSize: 12.5, letterSpacing: 0.4, textTransform: 'uppercase', flexShrink: 1 },
  texto: { fontFamily: fuente.textoMedio, fontSize: 15.5, lineHeight: 20, color: color.tinta },
  pie: { fontFamily: fuente.texto, fontSize: 12, color: color.apagado },
  vacio: { fontFamily: fuente.texto, fontSize: 13.5, color: color.apagado, lineHeight: 19 },
});
