import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FiltroFecha } from '../../components/FiltroFecha';
import { Animated, Entra, Esqueleto, LinearTransition, Pulsable, curvaApple } from '../../components/movimiento';
import { Aviso } from '../../components/ui';
import { limites, SIN_FECHA, textoRango, type Rango } from '../../lib/fechas';
import { useHotelElegido } from '../../lib/hotel-elegido';
import { codigoParte } from '../../lib/informe';
import { buscarPartes } from '../../lib/partes';
import { useSesion } from '../../lib/sesion';
import { categoria, color, esHabitacion, ESTADOS, fuente, hace, suave, type Parte } from '../../lib/tema';

type Vista = 'resueltos' | 'abiertos';

/** Historial: todos los partes, también los de hace meses, con buscador y filtro por fecha. */
export default function Historial() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil, hoteles } = useSesion();
  const [elegido, elegir] = useHotelElegido(perfil?.id);
  const varios = hoteles.length > 1;
  const hotelSel = varios && hoteles.some((h) => h.id === elegido) ? elegido : null;
  const nombres = useMemo(() => Object.fromEntries(hoteles.map((h) => [h.id, h.nombre])) as Record<string, string>, [hoteles]);

  const [texto, setTexto] = useState('');
  const [rango, setRango] = useState<Rango>(SIN_FECHA);
  const [vista, setVista] = useState<Vista>('resueltos');
  const [partes, setPartes] = useState<Parte[] | null>(null);
  const [error, setError] = useState('');
  const [vuelta, setVuelta] = useState(0);

  const q = texto.trim().length >= 2 ? texto.trim() : '';
  const lim = limites(rango);
  const desde = lim.desde?.getTime() ?? null;
  const hasta = lim.hasta?.getTime() ?? null;

  // Vuelve a buscar al entrar en la pestaña (por si hay partes nuevos)
  useFocusEffect(
    useCallback(() => {
      setVuelta((v) => v + 1);
    }, []),
  );

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const r = await buscarPartes(q, desde === null ? null : new Date(desde), hasta === null ? null : new Date(hasta), hotelSel);
        if (vivo) {
          setPartes(r);
          setError('');
        }
      } catch {
        if (vivo) setError('No se ha podido cargar el historial. Desliza hacia abajo para reintentar.');
      }
    }, q ? 350 : 0);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [q, desde, hasta, hotelSel, vuelta]);

  const lista = useMemo(() => {
    const l = (partes ?? []).filter((p) => (vista === 'resueltos' ? p.estado === 'resuelto' : p.estado !== 'resuelto'));
    return l.sort((a, b) => (b.resuelto_en ?? b.creado_en).localeCompare(a.resuelto_en ?? a.creado_en));
  }, [partes, vista]);

  if (!perfil) return null;

  const cabecera = (
    <View style={{ gap: 12, paddingBottom: 4 }}>
      <View style={s.titular}>
        <Text style={s.titulo}>Historial</Text>
        <Text style={s.sub}>Todo lo que se ha arreglado, para buscarlo cuando haga falta.</Text>
      </View>

      {varios ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[{ id: 'todos', nombre: 'Todos' }, ...hoteles].map((h) => {
            const activo = (h.id === 'todos' && !hotelSel) || h.id === hotelSel;
            return (
              <Pulsable key={h.id} vibra="seleccion" onPress={() => elegir(h.id)} style={[s.pastilla, activo && s.pastillaActiva]} accessibilityRole="tab" accessibilityState={{ selected: activo }}>
                <Text style={[s.pastillaTexto, activo && { color: color.fondo }]} numberOfLines={1}>
                  {h.nombre}
                </Text>
              </Pulsable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={s.buscador}>
        <MaterialCommunityIcons name="magnify" size={20} color={color.apagado} />
        <TextInput selectionColor={color.acento} cursorColor={color.acento} selectionHandleColor={color.acento}
          value={texto}
          onChangeText={setTexto}
          placeholder="Habitación, avería, código o nombre"
          placeholderTextColor={color.apagado}
          style={s.buscadorInput}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Buscar en el historial"
        />
        {texto ? (
          <Pulsable onPress={() => setTexto('')} accessibilityRole="button" accessibilityLabel="Borrar búsqueda" hitSlop={10}>
            <MaterialCommunityIcons name="close-circle" size={20} color={color.apagado} />
          </Pulsable>
        ) : null}
      </View>

      <FiltroFecha valor={rango} onCambio={setRango} />

      <View style={s.segmento}>
        {(['resueltos', 'abiertos'] as Vista[]).map((v) => (
          <Pulsable key={v} vibra="seleccion" onPress={() => setVista(v)} style={[s.segmentoOpcion, vista === v && s.segmentoActivo]} accessibilityRole="tab" accessibilityState={{ selected: vista === v }}>
            <Text style={[s.segmentoTexto, vista === v && { color: color.tinta }]}>{v === 'resueltos' ? `Resueltos${partes ? ` ${(partes ?? []).filter((p) => p.estado === 'resuelto').length}` : ''}` : `Sin resolver${partes ? ` ${(partes ?? []).filter((p) => p.estado !== 'resuelto').length}` : ''}`}</Text>
          </Pulsable>
        ))}
      </View>

      {partes ? (
        <Text style={s.cuenta}>
          {lista.length === 1 ? '1 parte' : `${lista.length} partes`}
          {q ? ` con «${q}»` : ''}
          {rango.tipo !== 'todas' ? ` · ${textoRango(rango)}` : ''}
        </Text>
      ) : null}
      <Aviso texto={error} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <Animated.FlatList
        data={lista}
        keyExtractor={(p) => p.id}
        itemLayoutAnimation={LinearTransition.duration(280).easing(curvaApple)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={cabecera}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110, gap: 8 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setVuelta((v) => v + 1)} tintColor={color.apagado} />}
        ListEmptyComponent={
          partes === null ? (
            <View style={{ gap: 8 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={[s.fila, { gap: 12 }]}>
                  <Esqueleto alto={40} ancho={40} radio={12} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Esqueleto alto={14} ancho="60%" />
                    <Esqueleto alto={11} ancho="40%" />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Entra>
              <Text style={s.vacio}>{q || rango.tipo !== 'todas' ? 'Ningún parte coincide con la búsqueda.' : vista === 'resueltos' ? 'Aún no hay partes resueltos.' : 'No hay partes sin resolver.'}</Text>
            </Entra>
          )
        }
        renderItem={({ item, index }) => {
          const cat = categoria(item.categoria);
          const est = ESTADOS[item.estado];
          return (
            <Entra orden={index}>
              <Pulsable onPress={() => router.push(`/parte/${item.id}`)} style={s.fila} accessibilityRole="button" accessibilityLabel={`${item.habitacion}, ${item.categoria}, ${est.texto}`}>
                <View style={[s.icono, { backgroundColor: suave(cat.color, 0.18) }]}>
                  <MaterialCommunityIcons name={cat.icono} size={20} color={cat.color} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.filaTitulo} numberOfLines={1}>
                    {esHabitacion(item.habitacion) ? 'Hab. ' : ''}
                    {item.habitacion} · {item.categoria}
                  </Text>
                  <Text style={s.filaSub} numberOfLines={1}>
                    {varios && !hotelSel ? `${nombres[item.hotel_id] ?? ''} · ` : ''}
                    {codigoParte(item)} · {hace(item.resuelto_en ?? item.creado_en)}
                  </Text>
                </View>
                <View style={[s.estado, { backgroundColor: suave(est.color, 0.16) }]}>
                  <Text style={[s.estadoTexto, { color: est.color }]}>{est.texto}</Text>
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
  titular: { gap: 4, paddingBottom: 4 },
  titulo: { fontFamily: fuente.tituloFuerte, fontSize: 34, color: color.tinta, letterSpacing: -0.8 },
  sub: { fontFamily: fuente.texto, fontSize: 14.5, color: color.apagado },
  pastilla: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: color.superficie, maxWidth: 200 },
  pastillaActiva: { backgroundColor: color.tinta },
  pastillaTexto: { fontFamily: fuente.textoFuerte, fontSize: 14, color: color.tinta },
  buscador: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.superficie, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 12 },
  buscadorInput: { flex: 1, fontFamily: fuente.texto, fontSize: 16, color: color.tinta, paddingVertical: 11 },
  segmento: { flexDirection: 'row', backgroundColor: color.superficie, borderRadius: 12, borderCurve: 'continuous', padding: 3 },
  segmentoOpcion: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  segmentoActivo: { backgroundColor: color.elevado, boxShadow: '0 2px 6px rgba(0,0,0,0.35)' },
  segmentoTexto: { fontFamily: fuente.textoFuerte, fontSize: 13.5, color: color.apagado },
  cuenta: { fontFamily: fuente.textoMedio, fontSize: 13, color: color.apagado, paddingTop: 2 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: color.superficie, borderRadius: 16, borderCurve: 'continuous', padding: 12 },
  icono: { width: 40, height: 40, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  filaTitulo: { fontFamily: fuente.textoFuerte, fontSize: 15.5, color: color.tinta },
  filaSub: { fontFamily: fuente.texto, fontSize: 12.5, color: color.apagado, fontVariant: ['tabular-nums'] },
  estado: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  estadoTexto: { fontFamily: fuente.textoFuerte, fontSize: 11 },
  vacio: { fontFamily: fuente.texto, fontSize: 15, color: color.apagado, textAlign: 'center', padding: 28 },
});
