import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FiltroFecha } from '../components/FiltroFecha';
import { Notificacion, type NotificacionRef } from '../components/Notificacion';
import { ParteTarjeta, type Accion } from '../components/ParteTarjeta';
import { Aviso, Boton } from '../components/ui';
import { dentroDe, limites, SIN_FECHA, textoRango, type Rango } from '../lib/fechas';
import { codigoParte } from '../lib/informe';
import { buscarPartes, usePartes, type CambioParte } from '../lib/partes';
import { useSesion } from '../lib/sesion';
import { color, esHabitacion, esHoy, fuente, normalizar, ROLES, sombra, suave, type NombreIcono, type Parte } from '../lib/tema';

const PRIO = { urgente: 0, normal: 1, baja: 2 } as const;
const ORDEN = { en_camino: 0, en_curso: 1, pendiente: 2, esperando: 3, resuelto: 4 } as const;

export default function Inicio() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil, hotel } = useSesion();
  const notif = useRef<NotificacionRef>(null);
  const [filtro, setFiltro] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState('');
  const [fotoGrande, setFotoGrande] = useState<string | null>(null);
  const [resolviendo, setResolviendo] = useState<Parte | null>(null);
  const [nota, setNota] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [rango, setRango] = useState<Rango>(SIN_FECHA);
  const [remotos, setRemotos] = useState<{ clave: string; partes: Parte[] } | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const textoBusqueda = busqueda.trim();
  const hayTexto = textoBusqueda.length >= 2;
  const hayFecha = rango.tipo !== 'todas';
  const buscandoActivo = hayTexto || hayFecha;
  const lim = limites(rango);
  const desdeMs = lim.desde?.getTime() ?? null;
  const hastaMs = lim.hasta?.getTime() ?? null;
  const claveBusqueda = `${hayTexto ? textoBusqueda : ''}|${desdeMs ?? ''}|${hastaMs ?? ''}`;

  // Busca también en partes antiguos (en la base de datos), medio segundo después de dejar de escribir
  useEffect(() => {
    if (!buscandoActivo) return;
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const r = await buscarPartes(hayTexto ? textoBusqueda : '', desdeMs === null ? null : new Date(desdeMs), hastaMs === null ? null : new Date(hastaMs));
        if (vivo) {
          setRemotos({ clave: claveBusqueda, partes: r });
          setErrorBusqueda('');
        }
      } catch {
        if (vivo) setErrorBusqueda('No se ha podido buscar en los partes antiguos. Se muestran solo los recientes.');
      }
    }, 450);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [buscandoActivo, hayTexto, textoBusqueda, desdeMs, hastaMs, claveBusqueda]);

  const yoRef = useRef(perfil);
  useEffect(() => {
    yoRef.current = perfil;
  }, [perfil]);

  // Qué avisos recibe cada persona
  const alCambiar = useCallback((c: CambioParte) => {
    const yo = yoRef.current;
    if (!yo) return;
    const p = c.parte;
    const donde = (esHabitacion(p.habitacion) ? 'Hab. ' : '') + p.habitacion;
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

  const { partes, perfiles, fotos, cargando, error, recargar, actualizar } = usePartes(hotel?.id, alCambiar);

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
        ['resueltos', 'Resueltos', null],
      ];
    if (rol === 'limpieza')
      return [
        ['mios', 'Mis avisos', partes.filter((p) => p.creado_por === yoId && (p.estado !== 'resuelto' || esHoy(p.resuelto_en))).length],
        ['abiertos', 'Todo lo abierto', abiertos.length],
      ];
    return [
      ['abiertos', 'Abiertos', abiertos.length],
      ['urgentes', 'Urgentes', abiertos.filter((p) => p.prioridad === 'urgente').length],
      ['resueltos', 'Resueltos', null],
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

  // Resultados de búsqueda: los recientes al instante + los antiguos de la base de datos
  const resultados = useMemo(() => {
    if (!buscandoActivo) return [];
    const q = normalizar(textoBusqueda);
    const nombre = (id: string | null) => (id ? perfiles[id]?.nombre ?? '' : '');
    const coincide = (p: Parte) =>
      (!hayTexto || normalizar([p.habitacion, p.categoria, p.descripcion, p.nota_resolucion, codigoParte(p), nombre(p.creado_por), nombre(p.tecnico_id)].join(' ')).includes(q)) &&
      dentroDe(p.creado_en, rango);
    const mapa = new Map<string, Parte>();
    if (remotos && remotos.clave === claveBusqueda) for (const p of remotos.partes) mapa.set(p.id, p);
    for (const p of partes) if (coincide(p)) mapa.set(p.id, p);
    return [...mapa.values()].sort((a, b) => b.creado_en.localeCompare(a.creado_en));
  }, [buscandoActivo, hayTexto, textoBusqueda, rango, remotos, claveBusqueda, partes, perfiles]);

  const resumen: { icono: NombreIcono; texto: string; n: number; tono: string; filtro: string }[] = esTecnico
    ? [
        { icono: 'inbox', texto: 'Sin asignar', n: abiertos.filter((p) => !p.tecnico_id).length, tono: color.pendiente, filtro: 'cola' },
        { icono: 'alert-circle-outline', texto: 'Urgentes', n: abiertos.filter((p) => p.prioridad === 'urgente').length, tono: color.pendiente, filtro: 'abiertos' },
        { icono: 'account-hard-hat', texto: 'Míos', n: abiertos.filter((p) => p.tecnico_id === yoId).length, tono: color.camino, filtro: 'mios' },
        { icono: 'check-circle-outline', texto: 'Hechos hoy', n: partes.filter((p) => p.estado === 'resuelto' && esHoy(p.resuelto_en) && p.tecnico_id === yoId).length, tono: color.ok, filtro: 'resueltos' },
      ]
    : [
        { icono: 'inbox', texto: 'Abiertos', n: abiertos.length, tono: color.camino, filtro: 'abiertos' },
        { icono: 'alert-circle-outline', texto: 'Urgentes', n: abiertos.filter((p) => p.prioridad === 'urgente').length, tono: color.pendiente, filtro: rol === 'limpieza' ? 'abiertos' : 'urgentes' },
        { icono: 'bed-empty', texto: 'Sin vender', n: new Set(abiertos.filter((p) => p.bloquea).map((p) => p.habitacion)).size, tono: color.curso, filtro: 'abiertos' },
        { icono: 'check-circle-outline', texto: 'Resueltos hoy', n: partes.filter((p) => p.estado === 'resuelto' && esHoy(p.resuelto_en)).length, tono: color.ok, filtro: rol === 'limpieza' ? 'mios' : 'resueltos' },
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

  const bloqueadas = [...new Set(abiertos.filter((p) => p.bloquea).map((p) => p.habitacion))];
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
    <View style={{ gap: 14 }}>
      <View style={s.resumen}>
        {resumen.map((r) => (
          <Pressable key={r.texto} style={s.dato} onPress={() => setFiltro(r.filtro)} accessibilityRole="button" accessibilityLabel={`${r.n} ${r.texto}`}>
            <View style={[s.datoIcono, { backgroundColor: suave(r.tono, 0.14) }]}>
              <MaterialCommunityIcons name={r.icono} size={19} color={r.tono} />
            </View>
            <View>
              <Text style={s.datoNum}>{r.n}</Text>
              <Text style={s.datoTexto}>{r.texto}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {!esTecnico ? (
        <Boton texto="Avisar de una avería" icono="plus-circle" tipo="principal" grande onPress={() => router.push('/nuevo')} />
      ) : null}

      {bloqueadas.length && rol !== 'limpieza' ? (
        <Text style={s.bloqueadas}>
          No vender: <Text style={s.bloqueadasNums}>{bloqueadas.join('  ·  ')}</Text>
        </Text>
      ) : null}

      <View style={s.buscador}>
        <MaterialCommunityIcons name="magnify" size={20} color={color.apagado} />
        <TextInput
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar: habitación, avería, código, nombre…"
          placeholderTextColor={color.apagado}
          style={s.buscadorInput}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Buscar partes"
        />
        {busqueda ? (
          <Pressable onPress={() => setBusqueda('')} accessibilityRole="button" accessibilityLabel="Borrar búsqueda" hitSlop={10}>
            <MaterialCommunityIcons name="close-circle" size={20} color={color.apagado} />
          </Pressable>
        ) : null}
      </View>

      <FiltroFecha valor={rango} onCambio={setRango} />

      {buscandoActivo ? (
        <Text style={s.resultadosTexto}>
          {resultados.length === 1 ? '1 parte' : `${resultados.length} partes`}
          {hayTexto ? ` con «${textoBusqueda}»` : ''}
          {hayFecha ? ` · ${textoRango(rango)}` : ''}
          {remotos?.clave !== claveBusqueda && !errorBusqueda ? ' · buscando en los antiguos…' : ''}
        </Text>
      ) : null}
      <Aviso texto={buscandoActivo ? errorBusqueda : ''} />

      {!buscandoActivo ? <View style={s.chips}>
        {filtros.map(([k, t, n]) => (
          <Pressable key={k} onPress={() => setFiltro(k)} style={[s.chip, filtroActivo === k && s.chipActivo]} accessibilityRole="tab" accessibilityState={{ selected: filtroActivo === k }}>
            <Text style={[s.chipTexto, filtroActivo === k && { color: '#fff' }]}>
              {t}
              {n !== null ? <Text style={{ opacity: 0.7 }}> {n}</Text> : null}
            </Text>
          </Pressable>
        ))}
      </View> : null}
      <Aviso texto={error ?? errorAccion} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <View style={[s.barra, { paddingTop: insets.top + 10 }]}>
        <View style={s.logo}>
          <MaterialCommunityIcons name="wrench" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.hotel} numberOfLines={1}>
            {hotel.nombre}
          </Text>
          <Text style={s.usuario} numberOfLines={1}>
            {perfil.nombre} · {ROLES[perfil.rol]}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/ajustes')} style={s.botonBarra} accessibilityRole="button" accessibilityLabel="Ajustes">
          <MaterialCommunityIcons name="cog-outline" size={22} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={buscandoActivo ? resultados : lista}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32 }}
        ListHeaderComponent={cabeceraLista}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={cargando ? undefined : <Text style={s.vacio}>{buscandoActivo ? 'No hay partes que coincidan con la búsqueda.' : vacio}</Text>}
        refreshControl={<RefreshControl refreshing={false} onRefresh={recargar} tintColor={color.marca} />}
        renderItem={({ item }) => (
          <ParteTarjeta parte={item} yo={perfil} perfiles={perfiles} foto={item.foto_path ? fotos[item.foto_path] : undefined} ocupado={ocupado === item.id} onAccion={hacer} onFoto={setFotoGrande} onDetalle={abrirDetalle} />
        )}
      />

      <Notificacion ref={notif} />

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
            <TextInput
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
  barra: { backgroundColor: color.marca, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14 },
  logo: { width: 38, height: 38, borderRadius: 11, backgroundColor: color.acento, alignItems: 'center', justifyContent: 'center' },
  hotel: { fontFamily: fuente.titulo, fontSize: 17, color: '#fff' },
  usuario: { fontFamily: fuente.texto, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  botonBarra: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  resumen: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dato: { flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: color.superficie, borderRadius: 14, padding: 12, ...sombra },
  datoIcono: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  datoNum: { fontFamily: fuente.tituloFuerte, fontSize: 22, color: color.tinta, lineHeight: 26 },
  datoTexto: { fontFamily: fuente.textoMedio, fontSize: 12, color: color.apagado },
  bloqueadas: { fontFamily: fuente.textoMedio, fontSize: 13.5, color: color.apagado },
  bloqueadasNums: { fontFamily: fuente.numero, color: color.pendiente },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  buscador: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.superficie, borderWidth: 1, borderColor: color.linea, borderRadius: 14, paddingHorizontal: 12 },
  buscadorInput: { flex: 1, fontFamily: fuente.texto, fontSize: 15.5, color: color.tinta, paddingVertical: 11 },
  resultadosTexto: { fontFamily: fuente.textoMedio, fontSize: 13.5, color: color.apagado },
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
