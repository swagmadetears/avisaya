import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pulsable } from '../../components/movimiento';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aviso, Boton, Insignia } from '../../components/ui';
import { cargarEventos, codigoParte, compartirInforme, textoEvento, textoMinutos, tiempos, type Evento } from '../../lib/informe';
import { borrarParte, CAMPOS } from '../../lib/partes';
import { useSesion } from '../../lib/sesion';
import { mensajeError, supabase } from '../../lib/supabase';
import { categoria, color, ESTADOS, esHabitacion, fuente, ROLES, sombra, suave, type Parte, type Perfil } from '../../lib/tema';

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export default function DetalleParte() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hoteles, perfil: yo } = useSesion();
  const [borrando, setBorrando] = useState(false);
  const puedeBorrar = yo?.rol === 'admin' || yo?.rol === 'recepcion';
  const [parte, setParte] = useState<Parte | null>(null);
  const [perfiles, setPerfiles] = useState<Record<string, Perfil>>({});
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [foto, setFoto] = useState<string | undefined>();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [generando, setGenerando] = useState(false);

  const cargar = useCallback(async () => {
    if (!id) return;
    const [{ data: p, error: e }, { data: pf }, ev] = await Promise.all([
      supabase.from('partes').select(CAMPOS).eq('id', id).maybeSingle(),
      supabase.from('perfiles').select('id, hotel_id, nombre, rol, activo'),
      cargarEventos(id),
    ]);
    if (e || !p) setError('No se ha encontrado este parte.');
    else {
      const parteCargado = p as Parte;
      setParte(parteCargado);
      setError('');
      if (parteCargado.foto_path) {
        const { data: f } = await supabase.storage.from('fotos').createSignedUrl(parteCargado.foto_path, 60 * 60);
        setFoto(f?.signedUrl);
      }
    }
    if (pf) setPerfiles(Object.fromEntries((pf as Perfil[]).map((x) => [x.id, x])));
    setEventos(ev);
    setCargando(false);
  }, [id]);

  useEffect(() => {
    // Carga desde la red: los setState ocurren tras el await, no de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  async function informe() {
    const hotel = parte ? hoteles.find((h) => h.id === parte.hotel_id) : undefined;
    if (!parte || !hotel) return;
    setGenerando(true);
    setError('');
    try {
      await compartirInforme(parte, hotel, perfiles, eventos, foto);
    } catch (e) {
      setError('No se ha podido crear el PDF: ' + mensajeError(e));
    } finally {
      setGenerando(false);
    }
  }

  function preguntarBorrar() {
    if (!parte) return;
    Alert.alert('¿Eliminar este parte?', 'Se borra del todo para todo el equipo: la avería, su foto, su historial y su chat. Úsalo si se ha resuelto solo o se abrió por error.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setBorrando(true);
          const e = await borrarParte(parte);
          setBorrando(false);
          if (e) return setError(e);
          router.back();
        },
      },
    ]);
  }

  const cabecera = (
    <View style={[s.barra, { paddingTop: Platform.OS === 'ios' ? insets.top + 6 : insets.top + 10 }]}>
      <Pressable onPress={() => router.back()} style={s.volver} accessibilityRole="button" accessibilityLabel="Volver">
        <MaterialCommunityIcons name="chevron-left" size={26} color={color.tinta} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={s.barraTitulo}>Detalle del parte</Text>
        {parte ? <Text style={s.barraSub}>{codigoParte(parte)}</Text> : null}
      </View>
    </View>
  );

  if (cargando || !parte) {
    return (
      <View style={{ flex: 1, backgroundColor: color.fondo }}>
        {cabecera}
        <View style={s.centro}>{cargando ? <ActivityIndicator color={color.apagado} /> : <Aviso texto={error} />}</View>
      </View>
    );
  }

  const cat = categoria(parte.categoria);
  const est = ESTADOS[parte.estado];
  const creador = parte.creado_por ? perfiles[parte.creado_por] : undefined;
  const tecnico = parte.tecnico_id ? perfiles[parte.tecnico_id] : undefined;
  const t = tiempos(parte, eventos);
  const donde = (esHabitacion(parte.habitacion) ? 'Hab. ' : '') + parte.habitacion;

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      {cabecera}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} tintColor={color.apagado} />}>
        <View style={s.tarjeta}>
          <View style={s.fila}>
            <View style={[s.catIcono, { backgroundColor: suave(cat.color, 0.15) }]}>
              <MaterialCommunityIcons name={cat.icono} size={22} color={cat.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.titulo}>{donde}</Text>
              <Text style={s.subtitulo}>{parte.categoria}</Text>
            </View>
          </View>
          <View style={s.insignias}>
            <Insignia texto={est.texto} tono={est.color} />
            {parte.prioridad === 'urgente' ? <Insignia texto="Urgente" tono={color.pendiente} /> : null}
            {parte.bloquea ? <Insignia texto="No vender" tono={color.curso} /> : null}
          </View>
          {parte.descripcion ? <Text style={s.desc}>{parte.descripcion}</Text> : null}
          {foto ? <Image source={{ uri: foto }} style={s.foto} contentFit="cover" /> : null}
          {parte.nota_resolucion ? (
            <View style={s.nota}>
              <Text style={s.notaEtiqueta}>QUÉ SE HIZO</Text>
              <Text style={s.desc}>{parte.nota_resolucion}</Text>
            </View>
          ) : null}
        </View>

        <Pulsable onPress={() => router.push(`/conversacion/p/${parte.id}`)} style={s.chat} accessibilityRole="button" accessibilityLabel="Abrir el chat de esta avería">
          <View style={s.chatIcono}>
            <MaterialCommunityIcons name="chat-processing-outline" size={22} color={color.acento} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.chatTitulo}>Chat de la avería</Text>
            <Text style={s.chatSub}>Pregunta al técnico cómo va o avisa de algo</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={color.apagado} />
        </Pulsable>

        <View style={s.tarjeta}>
          <Dato k="Avisó" v={creador ? `${creador.nombre} (${ROLES[creador.rol]})` : '—'} />
          <Dato k="Fecha del aviso" v={fecha(parte.creado_en)} />
          <Dato k="Técnico" v={tecnico?.nombre ?? '—'} />
          <Dato k="Resuelto" v={parte.estado === 'resuelto' ? fecha(parte.resuelto_en) : 'Todavía no'} />
        </View>

        <View style={s.tiempos}>
          <Tiempo k="Hasta salir el técnico" v={textoMinutos(t.respuesta)} />
          <Tiempo k="Reparación" v={textoMinutos(t.reparacion)} />
          <Tiempo k="Total" v={textoMinutos(t.total)} />
        </View>

        <View style={s.tarjeta}>
          <Text style={s.seccion}>Historial</Text>
          {eventos.length ? (
            eventos.map((e, i) => (
              <View key={e.id} style={s.evento}>
                <View style={s.eventoLinea}>
                  <View style={[s.punto, { backgroundColor: e.estado ? ESTADOS[e.estado].color : color.apagado }]} />
                  {i < eventos.length - 1 ? <View style={s.palo} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: 12 }}>
                  <Text style={s.eventoTexto}>{textoEvento(e, perfiles)}</Text>
                  <Text style={s.eventoFecha}>{fecha(e.creado_en)}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={s.eventoFecha}>Sin movimientos registrados.</Text>
          )}
        </View>

        <Aviso texto={error} />
        <Boton texto="Informe PDF" icono="file-pdf-box" tipo="principal" grande onPress={informe} cargando={generando} />
        <Text style={s.ayuda}>Se crea con los datos de este momento. Puedes guardarlo o enviarlo por WhatsApp o correo.</Text>

        {puedeBorrar ? <Boton texto="Eliminar parte" icono="trash-can-outline" tipo="fantasma" onPress={preguntarBorrar} cargando={borrando} style={{ borderColor: color.pendiente }} /> : null}
      </ScrollView>
    </View>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.dato}>
      <Text style={s.datoK}>{k}</Text>
      <Text style={s.datoV}>{v}</Text>
    </View>
  );
}

function Tiempo({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.tiempo}>
      <Text style={s.tiempoK}>{k}</Text>
      <Text style={s.tiempoV}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  chat: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.superficie, borderRadius: 18, borderCurve: 'continuous', padding: 14, borderWidth: 1, borderColor: suave(color.acento, 0.35) },
  chatIcono: { width: 44, height: 44, borderRadius: 14, borderCurve: 'continuous', backgroundColor: suave(color.acento, 0.15), alignItems: 'center', justifyContent: 'center' },
  chatTitulo: { fontFamily: fuente.textoFuerte, fontSize: 16, color: color.tinta },
  chatSub: { fontFamily: fuente.texto, fontSize: 13.5, color: color.apagado },
  barra: { backgroundColor: color.fondo, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.linea },
  volver: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center' },
  barraTitulo: { fontFamily: fuente.titulo, fontSize: 18, color: color.tinta },
  barraSub: { fontFamily: fuente.numero, fontSize: 12.5, color: color.apagado },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  tarjeta: { backgroundColor: color.superficie, borderRadius: 18, padding: 16, gap: 12, ...sombra },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catIcono: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fuente.tituloFuerte, fontSize: 22, color: color.tinta },
  subtitulo: { fontFamily: fuente.textoMedio, fontSize: 15, color: color.apagado },
  insignias: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  desc: { fontFamily: fuente.texto, fontSize: 15.5, color: color.tinta, lineHeight: 22 },
  foto: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: color.elevado },
  nota: { backgroundColor: suave(color.ok, 0.12), borderRadius: 12, padding: 12, gap: 4 },
  notaEtiqueta: { fontFamily: fuente.textoFuerte, fontSize: 11, letterSpacing: 0.8, color: color.ok },
  dato: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  datoK: { fontFamily: fuente.textoMedio, fontSize: 14, color: color.apagado },
  datoV: { fontFamily: fuente.textoFuerte, fontSize: 14, color: color.tinta, flexShrink: 1, textAlign: 'right' },
  tiempos: { flexDirection: 'row', gap: 8 },
  tiempo: { flex: 1, backgroundColor: color.superficie, borderRadius: 14, padding: 12, gap: 4, ...sombra },
  tiempoK: { fontFamily: fuente.textoMedio, fontSize: 11.5, color: color.apagado },
  tiempoV: { fontFamily: fuente.tituloFuerte, fontSize: 17, color: color.tinta },
  seccion: { fontFamily: fuente.titulo, fontSize: 16, color: color.tinta },
  evento: { flexDirection: 'row', gap: 12 },
  eventoLinea: { alignItems: 'center', width: 12 },
  punto: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  palo: { flex: 1, width: 2, backgroundColor: color.linea, marginTop: 2 },
  eventoTexto: { fontFamily: fuente.textoMedio, fontSize: 15, color: color.tinta },
  eventoFecha: { fontFamily: fuente.texto, fontSize: 13, color: color.apagado },
  ayuda: { fontFamily: fuente.texto, fontSize: 13, color: color.apagado, textAlign: 'center' },
});
