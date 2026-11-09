import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Entra, Esqueleto, Pulsable } from '../../components/movimiento';
import { Aviso } from '../../components/ui';
import { useConversaciones, type Conversacion } from '../../lib/chat';
import { useSesion } from '../../lib/sesion';
import { color, fuente, suave, type NombreIcono } from '../../lib/tema';

const DIA = 864e5;
function cuando(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date(Date.now() - DIA).toDateString()) return 'Ayer';
  if (Date.now() - d.getTime() < 6 * DIA) return d.toLocaleDateString('es-ES', { weekday: 'short' });
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

const ASPECTO: Record<Conversacion['tipo'], { icono: NombreIcono; tono: string }> = {
  grupo: { icono: 'account-hard-hat', tono: color.curso },
  hotel: { icono: 'office-building-outline', tono: color.camino },
  parte: { icono: 'wrench-outline', tono: color.acento },
};

/** Bandeja de chats: el global con los técnicos, el general de cada hotel y los de cada avería. */
export default function Chats() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil } = useSesion();
  const { lista, error, recargar } = useConversaciones();

  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar]),
  );

  const secciones = useMemo(() => {
    const l = lista ?? [];
    return [
      { titulo: 'Equipo', data: l.filter((c) => c.tipo !== 'parte') },
      { titulo: 'Averías', data: l.filter((c) => c.tipo === 'parte') },
    ].filter((x) => x.data.length);
  }, [lista]);

  const total = (lista ?? []).reduce((n, c) => n + c.no_leidos, 0);

  function abrir(c: Conversacion) {
    const [tipo, id] = c.clave.split(':');
    router.push({ pathname: '/conversacion/[tipo]/[id]', params: { tipo, id, titulo: c.titulo, sub: c.subtitulo } });
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <SectionList
        sections={secciones}
        keyExtractor={(c) => c.clave}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={recargar} tintColor={color.apagado} />}
        ListHeaderComponent={
          <View style={{ gap: 4, paddingBottom: 8 }}>
            <Text style={s.titulo}>Chats</Text>
            <Text style={s.sub}>{total ? (total === 1 ? '1 mensaje sin leer' : `${total} mensajes sin leer`) : 'Habla con el equipo y con los técnicos'}</Text>
            <Aviso texto={error} />
          </View>
        }
        renderSectionHeader={({ section }) => <Text style={s.seccion}>{section.titulo.toUpperCase()}</Text>}
        ListEmptyComponent={
          lista === null ? (
            <View style={{ gap: 10 }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[s.fila, { borderRadius: 16 }]}>
                  <Esqueleto alto={46} ancho={46} radio={23} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Esqueleto alto={14} ancho="55%" />
                    <Esqueleto alto={12} ancho="80%" />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.vacio}>Aún no hay conversaciones.</Text>
          )
        }
        renderItem={({ item, index, section }) => {
          const a = ASPECTO[item.tipo];
          const primero = index === 0;
          const ultimo = index === section.data.length - 1;
          const deMi = !!perfil && item.ultimo_autor_id === perfil.id;
          return (
            <Entra orden={index}>
              <Pulsable
                onPress={() => abrir(item)}
                encoge={0.985}
                style={[s.fila, primero && s.filaPrimera, ultimo && s.filaUltima, !ultimo && s.filaSeparada]}
                accessibilityRole="button"
                accessibilityLabel={`${item.titulo}${item.no_leidos ? `, ${item.no_leidos} sin leer` : ''}`}>
                <View style={[s.avatar, { backgroundColor: suave(a.tono, 0.18) }]}>
                  <MaterialCommunityIcons name={a.icono} size={22} color={a.tono} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <View style={s.linea}>
                    <Text style={s.nombre} numberOfLines={1}>
                      {item.titulo}
                    </Text>
                    <Text style={[s.fecha, item.no_leidos ? { color: color.acento } : null]}>{cuando(item.ultimo_en)}</Text>
                  </View>
                  <View style={s.linea}>
                    <Text style={[s.ultimo, item.no_leidos ? { color: color.tinta } : null]} numberOfLines={1}>
                      {item.ultimo_texto ? `${deMi ? 'Tú' : item.ultimo_autor}: ${item.ultimo_texto}` : item.subtitulo}
                    </Text>
                    {item.no_leidos ? (
                      <View style={s.badge}>
                        <Text style={s.badgeTexto}>{item.no_leidos > 99 ? '99+' : item.no_leidos}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pulsable>
            </Entra>
          );
        }}
        SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  titulo: { fontFamily: fuente.tituloFuerte, fontSize: 34, color: color.tinta, letterSpacing: -0.8 },
  sub: { fontFamily: fuente.texto, fontSize: 14.5, color: color.apagado },
  seccion: { fontFamily: fuente.textoFuerte, fontSize: 12.5, letterSpacing: 0.8, color: color.apagado, paddingHorizontal: 4, paddingTop: 10 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: color.superficie },
  filaPrimera: { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  filaUltima: { borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  filaSeparada: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.linea },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  linea: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nombre: { flex: 1, fontFamily: fuente.textoFuerte, fontSize: 16, color: color.tinta },
  fecha: { fontFamily: fuente.texto, fontSize: 12.5, color: color.apagado, fontVariant: ['tabular-nums'] },
  ultimo: { flex: 1, fontFamily: fuente.texto, fontSize: 14, color: color.apagado },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: color.acento, alignItems: 'center', justifyContent: 'center' },
  badgeTexto: { fontFamily: fuente.textoFuerte, fontSize: 12, color: '#fff', fontVariant: ['tabular-nums'] },
  vacio: { fontFamily: fuente.texto, fontSize: 15, color: color.apagado, textAlign: 'center', padding: 28 },
});
