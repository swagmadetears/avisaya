import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Entra, Esqueleto, Pulsable } from '../../components/movimiento';
import { Aviso } from '../../components/ui';
import { CAMPOS_REGISTRO, estabaResuelto, fechaRegistro, type Entrada } from '../../lib/registro';
import { useSesion } from '../../lib/sesion';
import { supabase } from '../../lib/supabase';
import { color, fuente, suave } from '../../lib/tema';

type Vista = 'pendientes' | 'resueltos';

/** Registro de lo eliminado (solo administración), separado en pendientes y resueltos. */
export default function Registro() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hoteles } = useSesion();
  const [lista, setLista] = useState<Entrada[] | null>(null);
  const [error, setError] = useState('');
  const [vista, setVista] = useState<Vista>('pendientes');
  const [vuelta, setVuelta] = useState(0);
  const nombreHotel = (id: string | null) => hoteles.find((h) => h.id === id)?.nombre ?? '';

  useEffect(() => {
    let vivo = true;
    supabase
      .from('archivo')
      .select(CAMPOS_REGISTRO)
      .order('borrado_en', { ascending: false })
      .limit(300)
      .then(({ data, error: e }) => {
        if (!vivo) return;
        if (e) setError('No se ha podido cargar el registro.');
        else setLista((data ?? []) as Entrada[]);
      });
    return () => {
      vivo = false;
    };
  }, [vuelta]);

  const pendientes = useMemo(() => (lista ?? []).filter((e) => !estabaResuelto(e)), [lista]);
  const resueltos = useMemo(() => (lista ?? []).filter(estabaResuelto), [lista]);
  const datos = vista === 'pendientes' ? pendientes : resueltos;

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <View style={[s.cabecera, { paddingTop: insets.top + 6 }]}>
        <Pulsable onPress={() => router.back()} style={s.volver} accessibilityRole="button" accessibilityLabel="Volver">
          <MaterialCommunityIcons name="chevron-left" size={26} color={color.tinta} />
        </Pulsable>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Registro de eliminados</Text>
          <Text style={s.sub}>Partes y avisos borrados, con su chat completo</Text>
        </View>
      </View>
      <FlatList
        data={datos}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setVuelta((v) => v + 1)} tintColor={color.apagado} />}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingBottom: 4 }}>
            <View style={s.segmento}>
              {(['pendientes', 'resueltos'] as Vista[]).map((v) => (
                <Pulsable key={v} vibra="seleccion" encoge={0.98} onPress={() => setVista(v)} style={[s.segmentoOpcion, vista === v && s.segmentoActivo]} accessibilityRole="tab" accessibilityState={{ selected: vista === v }}>
                  <Text style={[s.segmentoTexto, vista === v && { color: color.tinta }]}>
                    {v === 'pendientes' ? `Pendientes ${pendientes.length}` : `Resueltos ${resueltos.length}`}
                  </Text>
                </Pulsable>
              ))}
            </View>
            <Text style={s.ayuda}>
              {vista === 'pendientes'
                ? 'Eliminados cuando aún no estaban arreglados (o el aviso seguía abierto).'
                : 'Eliminados cuando ya estaban resueltos (o el aviso ya se había cerrado).'}
            </Text>
            <Aviso texto={error} />
          </View>
        }
        ListEmptyComponent={
          lista === null ? (
            <View style={{ gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <Esqueleto key={i} alto={68} radio={16} />
              ))}
            </View>
          ) : (
            <Text style={s.vacio}>{vista === 'pendientes' ? 'No se ha eliminado nada pendiente.' : 'No se ha eliminado nada resuelto.'}</Text>
          )
        }
        renderItem={({ item, index }) => {
          const parte = item.tipo === 'parte';
          const tono = parte ? color.acento : color.curso;
          return (
            <Entra orden={index}>
              <Pulsable encoge={0.985} onPress={() => router.push(`/registro/${item.id}`)} style={s.fila} accessibilityRole="button" accessibilityLabel={`${parte ? 'Parte' : 'Aviso'} ${item.resumen}`}>
                <View style={[s.icono, { backgroundColor: suave(tono, 0.16) }]}>
                  <MaterialCommunityIcons name={parte ? 'wrench-outline' : 'pin-outline'} size={20} color={tono} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={s.resumen} numberOfLines={1}>
                    {parte ? 'Parte · ' : 'Aviso · '}
                    {item.resumen}
                  </Text>
                  <Text style={s.quien} numberOfLines={1}>
                    {item.borrado_por_nombre ?? '—'} · {fechaRegistro(item.borrado_en)}
                    {nombreHotel(item.hotel_id) ? ` · ${nombreHotel(item.hotel_id)}` : ''}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={color.apagado} />
              </Pulsable>
            </Entra>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.linea },
  volver: { width: 38, height: 38, borderRadius: 19, backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fuente.textoFuerte, fontSize: 17, color: color.tinta },
  sub: { fontFamily: fuente.texto, fontSize: 13, color: color.apagado },
  segmento: { flexDirection: 'row', backgroundColor: color.superficie, borderRadius: 12, borderCurve: 'continuous', padding: 3 },
  segmentoOpcion: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  segmentoActivo: { backgroundColor: color.elevado, boxShadow: '0 2px 6px rgba(0,0,0,0.35)' },
  segmentoTexto: { fontFamily: fuente.textoFuerte, fontSize: 13.5, color: color.apagado },
  ayuda: { fontFamily: fuente.texto, fontSize: 13, color: color.apagado, lineHeight: 18 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: color.superficie, borderRadius: 16, borderCurve: 'continuous' },
  icono: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resumen: { fontFamily: fuente.textoFuerte, fontSize: 15.5, color: color.tinta },
  quien: { fontFamily: fuente.texto, fontSize: 12.5, color: color.apagado },
  vacio: { fontFamily: fuente.texto, fontSize: 15, color: color.apagado, textAlign: 'center', padding: 28 },
});
