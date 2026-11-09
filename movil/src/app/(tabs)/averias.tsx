import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated, Entra, LinearTransition, Pulsable, TarjetaEsqueleto, curvaApple } from '../../components/movimiento';
import { Notificacion, type NotificacionRef } from '../../components/Notificacion';
import { ParteTarjeta, type Accion } from '../../components/ParteTarjeta';
import { Aviso, Boton } from '../../components/ui';
import { Tablon } from '../../components/Tablon';
import { useAvisos } from '../../lib/avisos';
import { useHotelElegido } from '../../lib/hotel-elegido';
import { usePartes, type CambioParte } from '../../lib/partes';
import { useSesion } from '../../lib/sesion';
import { supabase } from '../../lib/supabase';
import { Logo } from '../../components/Logo';
import { color, esHabitacion, esHoy, fuente, ROLES, suave, type NombreIcono, type Parte } from '../../lib/tema';

const PRIO = { urgente: 0, normal: 1, baja: 2 } as const;
const ORDEN = { en_camino: 0, en_curso: 1, pendiente: 2, esperando: 3, resuelto: 4 } as const;

export default function Averias() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil, hotel, hoteles } = useSesion();
  const varios = hoteles.length > 1;
  const [selectorHotel, setSelectorHotel] = useState(false);
  const [nSolicitudes, setNSolicitudes] = useState(0);
  const esAdmin = perfil?.rol === 'admin';
  // Administración: cuántas personas esperan aprobación (se mira al volver a esta pantalla)
  useFocusEffect(
    useCallback(() => {
      if (!esAdmin) return;
      let vivo = true;
      supabase.rpc('admin_solicitudes').then(({ data }) => {
        if (vivo) setNSolicitudes((data ?? []).length);
      });
      return () => {
        vivo = false;
      };
    }, [esAdmin]),
  );
  const [verHotel, elegirHotel] = useHotelElegido(perfil?.id);
  const setVerHotel = useCallback(
    (id: string) => {
      elegirHotel(id);
      setSelectorHotel(false);
    },
    [elegirHotel],
  );
  // Sin elección guardada: el técnico ve todos sus hoteles; recepción y limpieza, su hotel principal
  const verEfectivo = verHotel || (perfil?.rol === 'tecnico' ? 'todos' : (hotel?.id ?? 'todos'));
  const hotelSel = varios && hoteles.some((h) => h.id === verEfectivo) ? verEfectivo : null;
  const idsHoteles = hoteles.map((h) => h.id).join(',');
  const nombresHotel = useMemo(() => Object.fromEntries(hoteles.map((h) => [h.id, h.nombre])) as Record<string, string>, [hoteles]);
  const notif = useRef<NotificacionRef>(null);
  const [filtro, setFiltro] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState('');
  const [fotoGrande, setFotoGrande] = useState<string | null>(null);
  const [resolviendo, setResolviendo] = useState<Parte | null>(null);
  const [nota, setNota] = useState('');
  const yoRef = useRef(perfil);
  const hotelesRef = useRef(nombresHotel);
  useEffect(() => {
    yoRef.current = perfil;
    hotelesRef.current = nombresHotel;
  }, [perfil, nombresHotel]);

  // Qué avisos recibe cada persona
  const alCambiar = useCallback((c: CambioParte) => {
    const yo = yoRef.current;
    if (!yo) return;
    const p = c.parte;
    // Con varios hoteles, cada aviso dice de cuál es
    const nh = hotelesRef.current;
    const donde = (Object.keys(nh).length > 1 && nh[p.hotel_id] ? nh[p.hotel_id] + ' · ' : '') + (esHabitacion(p.habitacion) ? 'Hab. ' : '') + p.habitacion;
    if (c.tipo === 'nuevo') {
      if (p.creado_por === yo.id) return;
      if (yo.rol === 'tecnico') notif.current?.mostrar((p.prioridad === 'urgente' ? 'Urgente · ' : 'Nuevo parte · ') + donde, p.categoria + (p.descripcion ? ' — ' + p.descripcion : ''), p.prioridad === 'urgente');
      else if (yo.rol === 'recepcion' || yo.rol === 'admin') notif.current?.mostrar('Nuevo aviso · ' + donde, p.categoria);
      return;
    }
    const meInteresa = p.creado_por === yo.id || yo.rol === 'recepcion' || yo.rol === 'admin';
    if (yo.rol !== 'tecnico' && meInteresa) {
      if (p.estado === 'en_camino') notif.current?.mostrar('Técnico de camino', `${donde} · ${p.categoria}`);
      else if (p.estado === 'en_curso') notif.current?.mostrar('Reparando ' + donde, p.categoria);
      else if (p.estado === 'esperando') notif.current?.mostrar('Falta una pieza · ' + donde, p.categoria);
      else if (p.estado === 'resuelto') notif.current?.mostrar('Resuelto · ' + donde, p.nota_resolucion || p.categoria);
    }
    if (yo.rol === 'tecnico' && p.estado === 'pendiente' && c.antes === 'resuelto') {
      notif.current?.mostrar('Reabierto · ' + donde, p.categoria, true);
    }
  }, []);

  const { partes: todosPartes, perfiles, fotos, cargando, error, recargar, actualizar } = usePartes(idsHoteles, alCambiar);
  // Partes del hotel elegido arriba (o de todos)
  const partes = useMemo(() => (hotelSel ? todosPartes.filter((p) => p.hotel_id === hotelSel) : todosPartes), [todosPartes, hotelSel]);
  const { avisos: todosAvisos, cerrar: cerrarAviso } = useAvisos(idsHoteles);
  const avisos = useMemo(() => (hotelSel ? todosAvisos.filter((x) => x.hotel_id === hotelSel) : todosAvisos), [todosAvisos, hotelSel]);

  const rol = perfil?.rol ?? 'recepcion';
  const esTecnico = rol === 'tecnico';
  const yoId = perfil?.id ?? '';

  const abiertos = useMemo(() => partes.filter((p) => p.estado !== 'resuelto'), [partes]);

  const filtros = useMemo((): [string, string, number | null][] => {
    if (esTecnico)
      return [
        ['cola', 'Por hacer', abiertos.filter((p) => !p.tecnico_id || p.tecnico_id === yoId).length],
        ['mios', 'Míos', abiertos.filter((p) => p.tecnico_id === yoId).length],
        ['abiertos', 'Todos', abiertos.length],
      ];
    if (rol === 'limpieza')
      return [
        ['mios', 'Mis avisos', partes.filter((p) => p.creado_por === yoId && (p.estado !== 'resuelto' || esHoy(p.resuelto_en))).length],
        ['abiertos', 'Todo lo abierto', abiertos.length],
      ];
    return [
      ['abiertos', 'Abiertos', abiertos.length],
      ['urgentes', 'Urgentes', abiertos.filter((p) => p.prioridad === 'urgente').length],
    ];
  }, [esTecnico, rol, abiertos, partes, yoId]);

  const filtroActivo = filtros.some((f) => f[0] === filtro) ? filtro : filtros[0][0];

  const lista = useMemo(() => {
    const l = partes.filter((p) => {
      const o = p.estado !== 'resuelto';
      switch (filtroActivo) {
        case 'cola':
          return o && (!p.tecnico_id || p.tecnico_id === yoId);
        case 'mios':
          return rol === 'limpieza' ? p.creado_por === yoId && (o || esHoy(p.resuelto_en)) : o && p.tecnico_id === yoId;
        case 'abiertos':
          return o;
        case 'urgentes':
          return o && p.prioridad === 'urgente';
        case 'resueltos':
          return !o;
        default:
          return true;
      }
    });
    return l.sort((a, b) => {
      if (filtroActivo === 'resueltos') return (b.resuelto_en ?? '').localeCompare(a.resuelto_en ?? '');
      const ra = a.estado === 'resuelto' ? 1 : 0;
      const rb = b.estado === 'resuelto' ? 1 : 0;
      if (ra !== rb) return ra - rb;
      if (esTecnico) {
        const ma = a.tecnico_id === yoId && (a.estado === 'en_camino' || a.estado === 'en_curso') ? 1 : 0;
        const mb = b.tecnico_id === yoId && (b.estado === 'en_camino' || b.estado === 'en_curso') ? 1 : 0;
        if (ma !== mb) return mb - ma;
      }
      return PRIO[a.prioridad] - PRIO[b.prioridad] || ORDEN[a.estado] - ORDEN[b.estado] || b.creado_en.localeCompare(a.creado_en);
    });
  }, [partes, filtroActivo, rol, esTecnico, yoId]);

  const resumen: { icono: NombreIcono; texto: string; n: number; tono: string; filtro: string }[] = esTecnico
    ? [
        { icono: 'inbox', texto: 'Sin asignar', n: abiertos.filter((p) => !p.tecnico_id).length, tono: color.pendiente, filtro: 'cola' },
        { icono: 'alert-circle-outline', texto: 'Urgentes', n: abiertos.filter((p) => p.prioridad === 'urgente').length, tono: color.pendiente, filtro: 'abiertos' },
        { icono: 'account-hard-hat', texto: 'Míos', n: abiertos.filter((p) => p.tecnico_id === yoId).length, tono: color.camino, filtro: 'mios' },
        { icono: 'check-circle-outline', texto: 'Hechos hoy', n: partes.filter((p) => p.estado === 'resuelto' && esHoy(p.resuelto_en) && p.tecnico_id === yoId).length, tono: color.ok, filtro: 'abiertos' },
      ]
    : [
        { icono: 'inbox', texto: 'Abiertos', n: abiertos.length, tono: color.camino, filtro: 'abiertos' },
        { icono: 'alert-circle-outline', texto: 'Urgentes', n: abiertos.filter((p) => p.prioridad === 'urgente').length, tono: color.pendiente, filtro: rol === 'limpieza' ? 'abiertos' : 'urgentes' },
        { icono: 'bed-empty', texto: 'Sin vender', n: new Set(abiertos.filter((p) => p.bloquea).map((p) => p.habitacion)).size, tono: color.curso, filtro: 'abiertos' },
        { icono: 'check-circle-outline', texto: 'Resueltos hoy', n: partes.filter((p) => p.estado === 'resuelto' && esHoy(p.resuelto_en)).length, tono: color.ok, filtro: rol === 'limpieza' ? 'mios' : 'abiertos' },
      ];

  const hacer = useCallback(
    async (p: Parte, a: Accion) => {
      if (!perfil) return;
      if (a === 'resolver') {
        setNota('');
        setResolviendo(p);
        return;
      }
      const cambios: Partial<Parte> =
        a === 'camino'
          ? { estado: 'en_camino', tecnico_id: perfil.id }
          : a === 'empezar'
            ? { estado: 'en_curso', tecnico_id: perfil.id }
            : a === 'soltar'
              ? { estado: 'pendiente' }
              : a === 'esperar'
                ? { estado: 'esperando' }
                : { estado: 'pendiente', nota_resolucion: '' };
      setOcupado(p.id);
      setErrorAccion('');
      const e = await actualizar(p.id, cambios);
      if (e) setErrorAccion(e);
      setOcupado(null);
    },
    [perfil, actualizar],
  );

  const abrirDetalle = useCallback((p: Parte) => router.push(`/parte/${p.id}`), [router]);

  async function confirmarResuelto() {
    if (!resolviendo || !perfil) return;
    setOcupado(resolviendo.id);
    const e = await actualizar(resolviendo.id, { estado: 'resuelto', tecnico_id: perfil.id, nota_resolucion: nota.trim().slice(0, 400) });
    setOcupado(null);
    if (e) setErrorAccion(e);
    else setResolviendo(null);
  }

  if (!perfil || !hotel) return null;

  const bloqueadas = [...new Set(abiertos.filter((p) => p.bloquea).map((p) => (varios && !hotelSel ? `${nombresHotel[p.hotel_id] ?? ''} ${p.habitacion}` : p.habitacion)))];
  const vacio = !partes.length
    ? esTecnico
      ? 'No hay partes. Cuando recepción o limpieza avisen, te llegará aquí.'
      : 'Aún no hay partes. Pulsa «Avisar de una avería» para crear el primero.'
    : filtroActivo === 'mios' && rol === 'limpieza'
      ? 'No has enviado avisos hoy.'
      : filtroActivo === 'cola' || filtroActivo === 'mios'
        ? 'No tienes nada pendiente.'
        : 'Nada por aquí.';

  const cabeceraLista = (
    <View style={{ gap: 22, paddingBottom: 4 }}>
      {esAdmin && nSolicitudes > 0 ? (
        <Pulsable onPress={() => router.push('/equipo')} style={s.solicitudes} accessibilityRole="button">
          <MaterialCommunityIcons name="account-clock-outline" size={22} color={color.curso} />
          <Text style={s.solicitudesTexto}>
            {nSolicitudes === 1 ? '1 persona espera' : `${nSolicitudes} personas esperan`} tu aprobación
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={color.curso} />
        </Pulsable>
      ) : null}

      {!esTecnico ? (
        <Pulsable vibra="medio" onPress={() => router.push({ pathname: '/nuevo', params: { hotel: hotelSel ?? '' } })} style={s.avisar} accessibilityRole="button" accessibilityLabel="Avisar de una avería">
          <View style={s.avisarIcono}>
            <MaterialCommunityIcons name="plus" size={24} color={color.acento} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.avisarTitulo}>Avisar de una avería</Text>
            <Text style={s.avisarSub}>Habitación, tipo y una foto. Le llega al técnico al momento.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="rgba(255,255,255,0.8)" />
        </Pulsable>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text style={s.seccion}>RESUMEN</Text>
        <View style={s.resumen}>
          {resumen.map((r) => (
            <Pulsable key={r.texto} style={s.dato} vibra="seleccion" onPress={() => setFiltro(r.filtro)} accessibilityRole="button" accessibilityLabel={`${r.n} ${r.texto}`}>
              <MaterialCommunityIcons name={r.icono} size={18} color={r.tono} />
              <Text style={s.datoNum}>{r.n}</Text>
              <Text style={s.datoTexto} numberOfLines={2}>
                {r.texto}
              </Text>
            </Pulsable>
          ))}
        </View>
        {bloqueadas.length && rol !== 'limpieza' ? (
          <View style={s.noVender}>
            <MaterialCommunityIcons name="bed-empty" size={16} color={color.curso} />
            <Text style={s.bloqueadas} numberOfLines={2}>
              No vender: <Text style={s.bloqueadasNums}>{bloqueadas.join(' · ')}</Text>
            </Text>
          </View>
        ) : null}
      </View>

      <Tablon avisos={avisos} perfiles={perfiles} nombresHotel={varios && !hotelSel ? nombresHotel : undefined} hotelNuevo={hotelSel ?? hotel.id} onCerrar={cerrarAviso} />

      <View style={{ gap: 10 }}>
        <Text style={s.seccion}>PARTES</Text>
        <View style={s.segmento}>
          {filtros.map(([k, t, n]) => (
            <Pulsable key={k} vibra="seleccion" encoge={0.98} onPress={() => setFiltro(k)} style={[s.segmentoOpcion, filtroActivo === k && s.segmentoActivo]} accessibilityRole="tab" accessibilityState={{ selected: filtroActivo === k }}>
              <Text style={[s.segmentoTexto, filtroActivo === k && { color: color.tinta }]} numberOfLines={1}>
                {t}
                {n !== null ? ` ${n}` : ''}
              </Text>
            </Pulsable>
          ))}
        </View>
        <Aviso texto={error ?? errorAccion} />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <View style={[s.barra, { paddingTop: insets.top + 8 }]}>
        <Pulsable
          style={s.selector}
          disabled={!varios}
          vibra="seleccion"
          onPress={() => setSelectorHotel(true)}
          accessibilityRole={varios ? 'button' : undefined}
          accessibilityLabel={varios ? 'Cambiar de hotel' : undefined}>
          <Logo tamano={28} />
          <Text style={s.hotel} numberOfLines={1}>
            {!varios ? hotel.nombre : hotelSel ? nombresHotel[hotelSel] : `Tus ${hoteles.length} hoteles`}
          </Text>
          {varios ? <MaterialCommunityIcons name="chevron-down" size={18} color={color.apagado} /> : null}
        </Pulsable>
      </View>
      <View style={s.titular}>
        <Text style={s.titulo}>Averías</Text>
        <Text style={s.usuario} numberOfLines={1}>
          {perfil.nombre} · {ROLES[perfil.rol]}
        </Text>
      </View>

      <Animated.FlatList
        data={lista}
        itemLayoutAnimation={LinearTransition.duration(280).easing(curvaApple)}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, gap: 12, paddingBottom: insets.bottom + 110 }}
        ListHeaderComponent={cabeceraLista}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          cargando ? (
            <View style={{ gap: 12 }}>
              <TarjetaEsqueleto />
              <TarjetaEsqueleto />
              <TarjetaEsqueleto />
            </View>
          ) : (
            <Entra>
              <Text style={s.vacio}>{vacio}</Text>
            </Entra>
          )
        }
        refreshControl={<RefreshControl refreshing={false} onRefresh={recargar} tintColor={color.apagado} />}
        renderItem={({ item, index }) => (
          <Entra orden={index}>
          <ParteTarjeta parte={item} yo={perfil} perfiles={perfiles} foto={item.foto_path ? fotos[item.foto_path] : undefined} ocupado={ocupado === item.id} onAccion={hacer} onFoto={setFotoGrande} onDetalle={abrirDetalle} hotelNombre={varios ? nombresHotel[item.hotel_id] : undefined} />
          </Entra>
        )}
      />

      <Notificacion ref={notif} />

      <Modal visible={selectorHotel} transparent animationType="slide" onRequestClose={() => setSelectorHotel(false)}>
        <Pressable style={s.hojaFondo} onPress={() => setSelectorHotel(false)} accessibilityLabel="Cerrar">
          <Pressable style={[s.hoja, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <Text style={s.hojaTitulo}>¿Qué hotel quieres ver?</Text>
            <Text style={s.hojaSub}>Los avisos nuevos se crearán en el hotel que elijas.</Text>
            {[{ id: 'todos', nombre: 'Todos mis hoteles' }, ...hoteles].map((h) => {
              const activo = (h.id === 'todos' && !hotelSel) || h.id === hotelSel;
              const n = todosPartes.filter((p) => p.estado !== 'resuelto' && (h.id === 'todos' || p.hotel_id === h.id)).length;
              const urg = todosPartes.filter((p) => p.estado !== 'resuelto' && p.prioridad === 'urgente' && (h.id === 'todos' || p.hotel_id === h.id)).length;
              return (
                <Pressable key={h.id} onPress={() => setVerHotel(h.id)} style={[s.opHotel, activo && s.opHotelActivo]} accessibilityRole="radio" accessibilityState={{ checked: activo }}>
                  <MaterialCommunityIcons name={h.id === 'todos' ? 'domain' : 'office-building-outline'} size={22} color={activo ? color.acento : color.marca2} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.opHotelNombre} numberOfLines={1}>
                      {h.nombre}
                    </Text>
                    <Text style={s.opHotelSub}>
                      {n === 1 ? '1 abierto' : `${n} abiertos`}
                      {urg ? ` · ${urg} urgente${urg > 1 ? 's' : ''}` : ''}
                    </Text>
                  </View>
                  {activo ? <MaterialCommunityIcons name="check-circle" size={22} color={color.acento} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!fotoGrande} transparent animationType="fade" onRequestClose={() => setFotoGrande(null)}>
        <Pressable style={s.visor} onPress={() => setFotoGrande(null)} accessibilityLabel="Cerrar foto">
          {fotoGrande ? <Image source={{ uri: fotoGrande }} style={{ width: '100%', height: '80%' }} contentFit="contain" /> : null}
        </Pressable>
      </Modal>

      <Modal visible={!!resolviendo} transparent animationType="slide" onRequestClose={() => setResolviendo(null)}>
        <KeyboardAvoidingView style={s.hojaFondo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.hoja, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={s.hojaTitulo}>Marcar como resuelto</Text>
            <Text style={s.hojaSub}>
              {resolviendo ? `${esHabitacion(resolviendo.habitacion) ? 'Hab. ' : ''}${resolviendo.habitacion} · ${resolviendo.categoria}` : ''}
            </Text>
            <TextInput selectionColor={color.acento} cursorColor={color.acento} selectionHandleColor={color.acento}
              value={nota}
              onChangeText={setNota}
              placeholder="Qué has hecho (opcional). Ej. Cambiado el filtro del split"
              placeholderTextColor={color.apagado}
              multiline
              maxLength={400}
              style={s.hojaInput}
            />
            <Aviso texto={errorAccion} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Boton texto="Cancelar" tipo="normal" onPress={() => setResolviendo(null)} style={{ flex: 1 }} />
              <Boton texto="Confirmar" tipo="ok" icono="check" onPress={confirmarResuelto} cargando={!!resolviendo && ocupado === resolviendo.id} style={{ flex: 2 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  seccion: { fontFamily: fuente.textoFuerte, fontSize: 12.5, letterSpacing: 0.8, color: color.apagado, paddingHorizontal: 2 },
  avisar: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, borderCurve: 'continuous', backgroundColor: color.acento, boxShadow: '0 10px 24px rgba(255,106,43,0.28)' },
  avisarIcono: { width: 44, height: 44, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  avisarTitulo: { fontFamily: fuente.textoFuerte, fontSize: 17, color: '#fff' },
  avisarSub: { fontFamily: fuente.texto, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  noVender: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: suave(color.curso, 0.12) },
  segmento: { flexDirection: 'row', backgroundColor: color.superficie, borderRadius: 12, borderCurve: 'continuous', padding: 3 },
  segmentoOpcion: { flex: 1, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 9 },
  segmentoActivo: { backgroundColor: color.elevado, boxShadow: '0 2px 6px rgba(0,0,0,0.35)' },
  segmentoTexto: { fontFamily: fuente.textoFuerte, fontSize: 13.5, color: color.apagado },
  barra: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 6 },
  selector: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  logo: { width: 28, height: 28, borderRadius: 8, borderCurve: 'continuous', backgroundColor: color.acento, alignItems: 'center', justifyContent: 'center' },
  hotel: { fontFamily: fuente.textoFuerte, fontSize: 16, color: color.tinta, flexShrink: 1 },
  mas: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.acento, alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(255,106,43,0.35)' },
  titular: { paddingHorizontal: 16, paddingBottom: 10, gap: 2 },
  titulo: { fontFamily: fuente.tituloFuerte, fontSize: 34, color: color.tinta, letterSpacing: -0.8 },
  usuario: { fontFamily: fuente.texto, fontSize: 14, color: color.apagado },
  resumen: { flexDirection: 'row', gap: 8 },
  dato: { flex: 1, alignItems: 'flex-start', gap: 4, backgroundColor: color.superficie, borderRadius: 16, borderCurve: 'continuous', paddingHorizontal: 10, paddingVertical: 10 },
  datoIcono: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  datoNum: { fontFamily: fuente.tituloFuerte, fontSize: 22, color: color.tinta, lineHeight: 26, fontVariant: ['tabular-nums'] },
  datoTexto: { fontFamily: fuente.textoMedio, fontSize: 11.5, color: color.apagado, lineHeight: 14 },
  bloqueadas: { flex: 1, fontFamily: fuente.textoMedio, fontSize: 13.5, color: color.tinta },
  bloqueadasNums: { fontFamily: fuente.numero, color: color.pendiente },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hoteles: { gap: 8, paddingRight: 8 },
  solicitudes: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: suave(color.curso, 0.12), borderRadius: 14, padding: 12, borderWidth: 1, borderColor: suave(color.curso, 0.4) },
  solicitudesTexto: { flex: 1, fontFamily: fuente.textoFuerte, fontSize: 14.5, color: color.tinta },
  opHotel: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: color.linea, backgroundColor: color.elevado },
  opHotelActivo: { borderColor: color.acento, backgroundColor: suave(color.acento, 0.08) },
  opHotelNombre: { fontFamily: fuente.textoFuerte, fontSize: 16, color: color.tinta },
  opHotelSub: { fontFamily: fuente.texto, fontSize: 13, color: color.apagado },
  hotelChip: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 220, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: color.superficie, borderWidth: 1.5, borderColor: color.linea },
  hotelChipActivo: { backgroundColor: color.marca, borderColor: color.marca },
  hotelChipTexto: { fontFamily: fuente.textoFuerte, fontSize: 14, color: color.tinta, flexShrink: 1 },
  hotelChipNum: { fontFamily: fuente.numero, fontSize: 13, color: color.apagado },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: color.superficie, borderWidth: 1, borderColor: color.linea },
  chipActivo: { backgroundColor: color.marca, borderColor: color.marca },
  chipTexto: { fontFamily: fuente.textoFuerte, fontSize: 14, color: color.tinta },
  vacio: { fontFamily: fuente.texto, fontSize: 15, color: color.apagado, textAlign: 'center', padding: 28, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.linea, borderRadius: 18 },
  visor: { flex: 1, backgroundColor: 'rgba(6,12,10,0.92)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  hojaFondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(6,12,10,0.4)' },
  hoja: { backgroundColor: color.superficie, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, gap: 12 },
  hojaTitulo: { fontFamily: fuente.titulo, fontSize: 19, color: color.tinta },
  hojaSub: { fontFamily: fuente.textoMedio, fontSize: 14, color: color.apagado },
  hojaInput: { fontFamily: fuente.texto, fontSize: 16, color: color.tinta, minHeight: 90, textAlignVertical: 'top', backgroundColor: color.elevado, borderWidth: 1, borderColor: color.linea, borderRadius: 12, padding: 12 },
});
