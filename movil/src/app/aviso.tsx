import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Entra, Pulsable, toque } from '../components/movimiento';
import { Aviso, Boton, Campo } from '../components/ui';
import { publicarAviso } from '../lib/avisos';
import { useSesion } from '../lib/sesion';
import { color, fuente, suave } from '../lib/tema';

const EJEMPLOS = ['Sofá cama roto', 'Ascensor en revisión', 'Falta el mando de la tele', 'Piscina cerrada por limpieza'];

/** Nuevo aviso general: queda en el tablón de Averías y avisa al móvil del resto del equipo. */
export default function NuevoAviso() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hotel: hotelParam } = useLocalSearchParams<{ hotel?: string }>();
  const { hotel, hoteles } = useSesion();
  const [hotelId, setHotelId] = useState(hoteles.some((h) => h.id === hotelParam) ? hotelParam! : (hotel?.id ?? ''));
  const [lugar, setLugar] = useState('');
  const [texto, setTexto] = useState('');
  const [importante, setImportante] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function publicar() {
    setError('');
    if (texto.trim().length < 2) return setError('Escribe qué pasa.');
    setEnviando(true);
    const e = await publicarAviso(hotelId, texto, lugar, importante);
    setEnviando(false);
    if (e) {
      toque('aviso');
      return setError(e);
    }
    toque('exito');
    router.back();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.fondo }} contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
      <Entra>
        <View style={s.cabecera}>
          <View style={s.icono}>
            <MaterialCommunityIcons name="pin" size={22} color={color.acento} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.titulo}>Nuevo aviso</Text>
            <Text style={s.sub}>Lo verá todo el equipo hasta que alguien lo dé por resuelto.</Text>
          </View>
        </View>
      </Entra>

      {hoteles.length > 1 ? (
        <Entra orden={1}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {hoteles.map((h) => (
              <Pulsable key={h.id} vibra="seleccion" onPress={() => setHotelId(h.id)} style={[s.pastilla, h.id === hotelId && s.pastillaActiva]} accessibilityRole="radio" accessibilityState={{ checked: h.id === hotelId }}>
                <Text style={[s.pastillaTexto, h.id === hotelId && { color: color.fondo }]}>{h.nombre}</Text>
              </Pulsable>
            ))}
          </View>
        </Entra>
      ) : null}

      <Entra orden={2}>
        <Campo etiqueta="Dónde (opcional)" value={lugar} onChangeText={setLugar} placeholder="Ej. 1C, recepción, piscina" maxLength={40} autoCapitalize="characters" />
      </Entra>
      <Entra orden={3}>
        <Campo etiqueta="Qué pasa" value={texto} onChangeText={setTexto} placeholder="Ej. Sofá cama roto, no se abre" maxLength={280} multiline style={{ minHeight: 96, textAlignVertical: 'top' }} />
      </Entra>
      <Entra orden={4}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {EJEMPLOS.map((e) => (
            <Pulsable key={e} vibra="seleccion" onPress={() => setTexto(e)} style={s.ejemplo}>
              <Text style={s.ejemploTexto}>{e}</Text>
            </Pulsable>
          ))}
        </View>
      </Entra>
      <Entra orden={5}>
        <View style={s.fila}>
          <View style={{ flex: 1 }}>
            <Text style={s.filaTitulo}>Importante</Text>
            <Text style={s.sub}>Se marca en rojo en el tablón.</Text>
          </View>
          <Switch value={importante} onValueChange={setImportante} trackColor={{ true: color.pendiente }} />
        </View>
      </Entra>
      <Aviso texto={error} />
      <Boton texto="Publicar aviso" icono="pin" tipo="principal" grande onPress={publicar} cargando={enviando} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icono: { width: 48, height: 48, borderRadius: 16, borderCurve: 'continuous', backgroundColor: suave(color.acento, 0.16), alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fuente.tituloFuerte, fontSize: 26, color: color.tinta },
  sub: { fontFamily: fuente.texto, fontSize: 14, color: color.apagado },
  pastilla: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: color.superficie },
  pastillaActiva: { backgroundColor: color.tinta },
  pastillaTexto: { fontFamily: fuente.textoFuerte, fontSize: 14, color: color.tinta },
  ejemplo: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: color.superficie, borderWidth: 1, borderColor: color.linea },
  ejemploTexto: { fontFamily: fuente.textoMedio, fontSize: 13, color: color.apagado },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.superficie, borderRadius: 16, borderCurve: 'continuous', padding: 14 },
  filaTitulo: { fontFamily: fuente.textoFuerte, fontSize: 16, color: color.tinta },
});
