import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { curvaApple, Entra, Esqueleto, Pulsable, suavizar } from '../components/movimiento';
import { Aviso } from '../components/ui';
import { useSesion } from '../lib/sesion';
import { supabase } from '../lib/supabase';
import { color, ESTADOS, fuente, ROLES, suave, type Estado, type Rol } from '../lib/tema';

type Entrada = {
  id: number;
  tipo: 'parte' | 'aviso';
  hotel_id: string | null;
  resumen: string;
  borrado_por_nombre: string | null;
  borrado_en: string;
  datos: {
    parte?: { descripcion?: string; estado?: Estado; creado_en?: string; nota_resolucion?: string };
    creado_por?: string | null;
    tecnico?: string | null;
    eventos?: { tipo: string; estado: Estado | null; quien: string | null; en: string }[];
    chat?: { quien: string | null; rol: Rol | null; texto: string; en: string }[];
    aviso?: { texto?: string; lugar?: string; creado_en?: string };
    autor?: string | null;
  };
};

const fecha = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

/** Registro de lo eliminado: solo administración. Nada de lo que se borra se pierde. */
export default function Registro() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hoteles } = useSesion();
  const [lista, setLista] = useState<Entrada[] | null>(null);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState<number | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const nombreHotel = (id: string | null) => hoteles.find((h) => h.id === id)?.nombre ?? '';

  useEffect(() => {
    let vivo = true;
    supabase
      .from('archivo')
      .select('id, tipo, hotel_id, resumen, borrado_por_nombre, borrado_en, datos')
      .order('borrado_en', { ascending: false })
      .limit(200)
      .then(({ data, error: e }) => {
        if (!vivo) return;
        if (e) setError('No se ha podido cargar el registro.');
        else setLista((data ?? []) as Entrada[]);
      });
    return () => {
      vivo = false;
    };
  }, [vuelta]);

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
        data={lista ?? []}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setVuelta((v) => v + 1)} tintColor={color.apagado} />}
        ListHeaderComponent={
          <View style={{ gap: 8, paddingBottom: 4 }}>
            <Text style={s.ayuda}>Cuando alguien elimina un parte o un aviso, se guarda aquí una copia: quién lo borró y cuándo, el historial y todos los mensajes. Los mensajes de los chats nunca se pueden borrar ni cambiar.</Text>
            <Aviso texto={error} />
          </View>
        }
        ListEmptyComponent={
          lista === null ? (
            <View style={{ gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <Esqueleto key={i} alto={72} radio={16} />
              ))}
            </View>
          ) : (
            <Text style={s.vacio}>No se ha eliminado nada.</Text>
          )
        }
        renderItem={({ item, index }) => {
          const abierto = abierta === item.id;
          const d = item.datos;
          return (
            <Entra orden={index}>
              <View style={s.tarjeta}>
                <Pulsable
                  encoge={0.99}
                  onPress={() => {
                    suavizar();
                    setAbierta(abierto ? null : item.id);
                  }}
                  style={s.fila}
                  accessibilityRole="button">
                  <View style={[s.icono, { backgroundColor: suave(item.tipo === 'parte' ? color.acento : color.curso, 0.16) }]}>
                    <MaterialCommunityIcons name={item.tipo === 'parte' ? 'wrench-outline' : 'pin-outline'} size={20} color={item.tipo === 'parte' ? color.acento : color.curso} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.resumen} numberOfLines={abierto ? undefined : 1}>
                      {item.tipo === 'parte' ? 'Parte · ' : 'Aviso · '}
                      {item.resumen}
                    </Text>
                    <Text style={s.quien} numberOfLines={2}>
                      Eliminado por {item.borrado_por_nombre ?? '—'} · {fecha(item.borrado_en)}
                      {nombreHotel(item.hotel_id) ? ` · ${nombreHotel(item.hotel_id)}` : ''}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name={abierto ? 'chevron-up' : 'chevron-down'} size={20} color={color.apagado} />
                </Pulsable>
                {abierto ? (
                  <Animated.View entering={FadeIn.duration(220).easing(curvaApple)} exiting={FadeOut.duration(140)} style={s.detalle}>
                    {item.tipo === 'parte' ? (
                      <>
                        <Dato k="Avisó" v={`${d.creado_por ?? '—'} · ${fecha(d.parte?.creado_en)}`} />
                        <Dato k="Técnico" v={d.tecnico ?? '—'} />
                        <Dato k="Estado al borrar" v={d.parte?.estado ? ESTADOS[d.parte.estado].texto : '—'} />
                        {d.parte?.descripcion ? <Dato k="Qué pasaba" v={d.parte.descripcion} /> : null}
                        {d.parte?.nota_resolucion ? <Dato k="Qué se hizo" v={d.parte.nota_resolucion} /> : null}
                        <Text style={s.apartado}>HISTORIAL</Text>
                        {(d.eventos ?? []).length ? (
                          d.eventos!.map((e, i) => (
                            <Text key={i} style={s.linea}>
                              <Text style={s.hora}>{fecha(e.en)}  </Text>
                              {e.quien ?? 'Alguien'} · {e.tipo === 'creado' ? 'abre el parte' : e.estado ? ESTADOS[e.estado].texto : e.tipo}
                            </Text>
                          ))
                        ) : (
                          <Text style={s.linea}>Sin movimientos.</Text>
                        )}
                        <Text style={s.apartado}>CHAT DE LA AVERÍA</Text>
                        {(d.chat ?? []).length ? (
                          d.chat!.map((m, i) => (
                            <View key={i} style={{ gap: 1 }}>
                              <Text style={s.hora}>
                                {fecha(m.en)} · {m.quien ?? 'Usuario'}
                                {m.rol ? ` (${ROLES[m.rol]})` : ''}
                              </Text>
                              <Text style={s.linea} selectable>
                                {m.texto}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <Text style={s.linea}>Sin mensajes.</Text>
                        )}
                      </>
                    ) : (
                      <>
                        <Dato k="Escribió" v={`${d.autor ?? '—'} · ${fecha(d.aviso?.creado_en)}`} />
                        <Dato k="Aviso" v={`${d.aviso?.lugar ? d.aviso.lugar + ': ' : ''}${d.aviso?.texto ?? ''}`} />
                      </>
                    )}
                  </Animated.View>
                ) : null}
              </View>
            </Entra>
          );
        }}
      />
    </View>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={s.apartado}>{k.toUpperCase()}</Text>
      <Text style={s.linea} selectable>
        {v}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.linea },
  volver: { width: 38, height: 38, borderRadius: 19, backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fuente.textoFuerte, fontSize: 17, color: color.tinta },
  sub: { fontFamily: fuente.texto, fontSize: 13, color: color.apagado },
  ayuda: { fontFamily: fuente.texto, fontSize: 13.5, color: color.apagado, lineHeight: 19 },
  tarjeta: { backgroundColor: color.superficie, borderRadius: 18, borderCurve: 'continuous', overflow: 'hidden' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icono: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resumen: { fontFamily: fuente.textoFuerte, fontSize: 15.5, color: color.tinta },
  quien: { fontFamily: fuente.texto, fontSize: 12.5, color: color.apagado },
  detalle: { gap: 10, padding: 14, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.linea },
  apartado: { fontFamily: fuente.textoFuerte, fontSize: 11.5, letterSpacing: 0.7, color: color.apagado, marginTop: 6 },
  linea: { fontFamily: fuente.texto, fontSize: 14.5, color: color.tinta, lineHeight: 20 },
  hora: { fontFamily: fuente.numero, fontSize: 11.5, color: color.apagado },
  vacio: { fontFamily: fuente.texto, fontSize: 15, color: color.apagado, textAlign: 'center', padding: 28 },
});
