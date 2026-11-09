import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Entra, Esqueleto, Pulsable } from '../../components/movimiento';
import { Aviso, Insignia } from '../../components/ui';
import { CAMPOS_REGISTRO, estabaResuelto, fechaRegistro, type Entrada } from '../../lib/registro';
import { useSesion } from '../../lib/sesion';
import { supabase } from '../../lib/supabase';
import { color, ESTADOS, fuente, ROLES } from '../../lib/tema';

/** Un eliminado del registro, en su propia pantalla: datos, historial y chat completo. */
export default function EliminadoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hoteles } = useSesion();
  const [e, setE] = useState<Entrada | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    supabase
      .from('archivo')
      .select(CAMPOS_REGISTRO)
      .eq('id', Number(id))
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (!vivo) return;
        if (err || !data) setError('No se ha encontrado en el registro.');
        else setE(data as Entrada);
      });
    return () => {
      vivo = false;
    };
  }, [id]);

  const d = e?.datos;
  const parte = e?.tipo === 'parte';
  const resuelto = e ? estabaResuelto(e) : false;
  const hotel = hoteles.find((h) => h.id === e?.hotel_id)?.nombre ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <View style={[s.cabecera, { paddingTop: insets.top + 6 }]}>
        <Pulsable onPress={() => router.back()} style={s.volver} accessibilityRole="button" accessibilityLabel="Volver">
          <MaterialCommunityIcons name="chevron-left" size={26} color={color.tinta} />
        </Pulsable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.titulo} numberOfLines={1}>
            {e ? e.resumen : 'Eliminado'}
          </Text>
          <Text style={s.sub} numberOfLines={1}>
            {e ? `${parte ? 'Parte' : 'Aviso'} eliminado${hotel ? ' · ' + hotel : ''}` : ''}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}>
        <Aviso texto={error} />
        {!e && !error ? (
          <View style={{ gap: 10 }}>
            <Esqueleto alto={90} radio={16} />
            <Esqueleto alto={160} radio={16} />
          </View>
        ) : null}

        {e && d ? (
          <>
            <Entra>
              <View style={[s.tarjeta, { borderColor: color.pendiente, borderWidth: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="delete-clock-outline" size={20} color={color.pendiente} />
                  <Text style={s.fuerte}>Eliminado por {e.borrado_por_nombre ?? '—'}</Text>
                </View>
                <Text style={s.linea}>{fechaRegistro(e.borrado_en)}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Insignia texto={resuelto ? 'Estaba resuelto' : 'Estaba pendiente'} tono={resuelto ? color.ok : color.curso} />
                  {parte && d.parte?.estado ? <Insignia texto={ESTADOS[d.parte.estado].texto} tono={ESTADOS[d.parte.estado].color} /> : null}
                </View>
              </View>
            </Entra>

            {parte ? (
              <>
                <Entra orden={1}>
                  <View style={s.tarjeta}>
                    <Dato k="Avisó" v={`${d.creado_por ?? '—'} · ${fechaRegistro(d.parte?.creado_en)}`} />
                    <Dato k="Técnico" v={d.tecnico ?? '—'} />
                    {d.parte?.resuelto_en ? <Dato k="Resuelto" v={fechaRegistro(d.parte.resuelto_en)} /> : null}
                    {d.parte?.descripcion ? <Dato k="Qué pasaba" v={d.parte.descripcion} /> : null}
                    {d.parte?.nota_resolucion ? <Dato k="Qué se hizo" v={d.parte.nota_resolucion} /> : null}
                  </View>
                </Entra>

                <Entra orden={2}>
                  <Text style={s.seccion}>HISTORIAL</Text>
                  <View style={s.tarjeta}>
                    {(d.eventos ?? []).length ? (
                      d.eventos!.map((ev, i) => (
                        <View key={i} style={s.evento}>
                          <Text style={s.hora}>{fechaRegistro(ev.en)}</Text>
                          <Text style={s.linea}>
                            {ev.quien ?? 'Alguien'} · {ev.tipo === 'creado' ? 'abre el parte' : ev.estado ? ESTADOS[ev.estado].texto : ev.tipo}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={s.linea}>Sin movimientos.</Text>
                    )}
                  </View>
                </Entra>

                <Entra orden={3}>
                  <Text style={s.seccion}>CHAT DE LA AVERÍA · {(d.chat ?? []).length} MENSAJES</Text>
                  <View style={[s.tarjeta, { gap: 12 }]}>
                    {(d.chat ?? []).length ? (
                      d.chat!.map((m, i) => (
                        <View key={i} style={{ gap: 3 }}>
                          <Text style={s.hora}>
                            {fechaRegistro(m.en)} · {m.quien ?? 'Usuario'}
                            {m.rol ? ` (${ROLES[m.rol]})` : ''}
                          </Text>
                          <View style={s.burbuja}>
                            <Text style={s.linea} selectable>
                              {m.texto}
                            </Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={s.linea}>Sin mensajes.</Text>
                    )}
                  </View>
                </Entra>
              </>
            ) : (
              <Entra orden={1}>
                <View style={s.tarjeta}>
                  <Dato k="Escribió" v={`${d.autor ?? '—'} · ${fechaRegistro(d.aviso?.creado_en)}`} />
                  {d.aviso?.lugar ? <Dato k="Dónde" v={d.aviso.lugar} /> : null}
                  <Dato k="Aviso" v={d.aviso?.texto ?? ''} />
                  {d.aviso?.cerrado_en ? <Dato k="Se dio por resuelto" v={fechaRegistro(d.aviso.cerrado_en)} /> : null}
                </View>
              </Entra>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={s.etiqueta}>{k.toUpperCase()}</Text>
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
  tarjeta: { backgroundColor: color.superficie, borderRadius: 18, borderCurve: 'continuous', padding: 14, gap: 10 },
  seccion: { fontFamily: fuente.textoFuerte, fontSize: 12, letterSpacing: 0.8, color: color.apagado, paddingHorizontal: 4, paddingBottom: 8 },
  etiqueta: { fontFamily: fuente.textoFuerte, fontSize: 11.5, letterSpacing: 0.7, color: color.apagado },
  fuerte: { fontFamily: fuente.textoFuerte, fontSize: 16, color: color.tinta },
  linea: { fontFamily: fuente.texto, fontSize: 15, color: color.tinta, lineHeight: 21 },
  hora: { fontFamily: fuente.numero, fontSize: 11.5, color: color.apagado },
  evento: { gap: 2, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.linea },
  burbuja: { alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: color.elevado, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
});
