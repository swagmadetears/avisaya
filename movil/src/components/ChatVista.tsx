import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMensajes, type Conv, type Mensaje } from '../lib/chat';
import { exportarConversacion } from '../lib/informe';
import { useSesion } from '../lib/sesion';
import { supabase } from '../lib/supabase';
import { color, fuente, ROLES, suave, type Perfil, type Rol } from '../lib/tema';
import { Esqueleto, Pulsable, toque } from './movimiento';
import { Aviso } from './ui';

const TONO: Record<Rol, string> = { admin: color.espera, recepcion: color.camino, limpieza: color.marca2, tecnico: color.curso };
const AJENO = '#232C35'; // burbuja de los demás: gris azulado, distinta de la mía
const LEIDO = '#3DD68C';

const DIA = 864e5;
const hora = (d: Date) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
/** Hora; si el mensaje tiene más de 24 h, también la fecha (para poder revisar el chat). */
function cuando(iso: string) {
  const d = new Date(iso);
  if (Date.now() - d.getTime() < DIA) return hora(d);
  return `${d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: d.getFullYear() === new Date().getFullYear() ? undefined : '2-digit' })} · ${hora(d)}`;
}
function dia(iso: string) {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return 'Hoy';
  if (d.toDateString() === new Date(Date.now() - DIA).toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Tres puntitos que suben y bajan, como en Mensajes. */
function Puntos() {
  const reducido = useReducedMotion();
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', height: 10 }}>
      {[0, 1, 2].map((i) => (
        <Punto key={i} retraso={i * 160} quieto={reducido} />
      ))}
    </View>
  );
}
function Punto({ retraso, quieto }: { retraso: number; quieto: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (quieto) return;
    v.set(withDelay(retraso, withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0, { duration: 320 }), withTiming(0, { duration: 320 })), -1)));
  }, [v, retraso, quieto]);
  const anim = useAnimatedStyle(() => ({ opacity: 0.35 + v.get() * 0.65, transform: [{ translateY: -v.get() * 3 }] }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: color.tinta }, anim]} />;
}

type Props = {
  conv: Conv | null;
  titulo: string;
  subtitulo: string;
  onVolver: () => void;
  vacio?: string;
};

/** Una conversación: burbujas, quién escribe, hora (o fecha y hora) y doble tic de leído. */
export function ChatVista({ conv, titulo, subtitulo, onVolver, vacio }: Props) {
  const insets = useSafeAreaInsets();
  const { perfil, hoteles } = useSesion();
  const { mensajes, cargando, error, enviar, leidoOtros, escribiendo, estoyEscribiendo } = useMensajes(conv, perfil?.id ?? null, perfil?.nombre ?? '');
  const [texto, setTexto] = useState('');
  const [errorEnvio, setErrorEnvio] = useState('');
  const [perfiles, setPerfiles] = useState<Record<string, Perfil>>({});
  const [teclado, setTeclado] = useState(false);
  const nombresHotel = useMemo(() => Object.fromEntries(hoteles.map((h) => [h.id, h.nombre])) as Record<string, string>, [hoteles]);
  const esGlobal = conv?.tipo === 'g';
  const [exportando, setExportando] = useState(false);

  async function exportar() {
    setExportando(true);
    try {
      await exportarConversacion(titulo, subtitulo, mensajes.filter((m) => !m.enviando), perfiles);
    } catch {
      setErrorEnvio('No se ha podido crear el PDF de la conversación.');
    } finally {
      setExportando(false);
    }
  }

  useEffect(() => {
    let vivo = true;
    supabase
      .from('perfiles')
      .select('id, hotel_id, nombre, rol, activo')
      .then(({ data }) => {
        if (vivo && data) setPerfiles(Object.fromEntries((data as Perfil[]).map((p) => [p.id, p])));
      });
    return () => {
      vivo = false;
    };
  }, [conv?.id]);

  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setTeclado(true));
    const b = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setTeclado(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  async function mandar() {
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    setErrorEnvio('');
    toque('ligero');
    const e = await enviar(t);
    if (e) {
      setErrorEnvio(e);
      setTexto(t);
      toque('aviso');
    }
  }

  if (!perfil) return null;
  const leidoMs = leidoOtros ? new Date(leidoOtros).getTime() : 0;

  const quienEscribe = escribiendo.length ? (
    <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOut.duration(160)} style={{ flexDirection: 'row', marginTop: 8 }}>
      <View style={{ gap: 3 }}>
        <Text style={[s.autor, { color: color.apagado }]}>{escribiendo.length === 1 ? `${escribiendo[0]} está escribiendo` : 'Varios están escribiendo'}</Text>
        <View style={[s.burbuja, s.burbujaOtra, { paddingVertical: 13, borderBottomLeftRadius: 6, alignSelf: 'flex-start' }]}>
          <Puntos />
        </View>
      </View>
    </Animated.View>
  ) : undefined;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.fondo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.cabecera, { paddingTop: insets.top + 6 }]}>
        <Pulsable onPress={onVolver} style={s.volver} accessibilityRole="button" accessibilityLabel="Volver a los chats">
          <MaterialCommunityIcons name="chevron-left" size={26} color={color.tinta} />
        </Pulsable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.titulo} numberOfLines={1}>
            {titulo}
          </Text>
          <Text style={s.sub} numberOfLines={1}>
            {subtitulo}
          </Text>
        </View>
        <Pulsable onPress={exportar} disabled={exportando || !mensajes.length} style={[s.volver, (exportando || !mensajes.length) && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Guardar la conversación en PDF">
          <MaterialCommunityIcons name="file-download-outline" size={21} color={color.tinta} />
        </Pulsable>
      </View>

      <Animated.FlatList
        inverted
        data={mensajes}
        keyExtractor={(m) => m.id}
        itemLayoutAnimation={LinearTransition.duration(220)}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 2, flexGrow: 1 }}
        ListHeaderComponent={quienEscribe}
        ListEmptyComponent={
          cargando ? (
            <View style={{ gap: 10, padding: 8, transform: [{ scaleY: -1 }] }}>
              <Esqueleto alto={40} ancho="60%" radio={18} />
              <Esqueleto alto={40} ancho="45%" radio={18} style={{ alignSelf: 'flex-end' }} />
              <Esqueleto alto={58} ancho="70%" radio={18} />
            </View>
          ) : (
            <View style={s.vacio}>
              <View style={s.vacioIcono}>
                <MaterialCommunityIcons name="chat-processing-outline" size={30} color={color.acento} />
              </View>
              <Text style={s.vacioTitulo}>Aún no hay mensajes</Text>
              <Text style={s.vacioTexto}>{vacio ?? 'Escribe al equipo. Les llegará un aviso al móvil.'}</Text>
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const mio = item.autor_id === perfil.id;
          const anterior: Mensaje | undefined = mensajes[index + 1];
          const nuevoDia = !anterior || new Date(anterior.creado_en).toDateString() !== new Date(item.creado_en).toDateString();
          const mismoAutorAntes = !nuevoDia && anterior?.autor_id === item.autor_id;
          const autor = perfiles[item.autor_id];
          const leido = mio && !item.enviando && leidoMs >= new Date(item.creado_en).getTime();
          const hotelAutor = autor && esGlobal ? nombresHotel[autor.hotel_id] : undefined;
          return (
            <Animated.View entering={index === 0 ? FadeIn.duration(240) : undefined}>
              {nuevoDia ? <Text style={s.dia}>{dia(item.creado_en)}</Text> : null}
              <View style={[s.filaMsg, mio ? { justifyContent: 'flex-end' } : null, !mismoAutorAntes && { marginTop: 10 }]}>
                <View style={{ maxWidth: '82%', gap: 3, alignItems: mio ? 'flex-end' : 'flex-start' }}>
                  {!mio && !mismoAutorAntes ? (
                    <Text style={[s.autor, { color: autor ? TONO[autor.rol] : color.apagado }]} numberOfLines={1}>
                      {autor ? `${autor.nombre} · ${ROLES[autor.rol]}${hotelAutor ? ` · ${hotelAutor}` : ''}` : 'Técnico'}
                    </Text>
                  ) : null}
                  <View style={[s.burbuja, mio ? s.burbujaMia : s.burbujaOtra, item.enviando && { opacity: 0.65 }]}>
                    <Text selectable style={[s.msg, mio && { color: '#fff' }]}>
                      {item.texto}
                    </Text>
                  </View>
                  <View style={s.pie}>
                    <Text style={s.hora}>{item.enviando ? 'Enviando…' : cuando(item.creado_en)}</Text>
                    {mio && !item.enviando ? (
                      <MaterialCommunityIcons name="check-all" size={15} color={leido ? LEIDO : color.apagado} accessibilityLabel={leido ? 'Leído' : 'Enviado'} />
                    ) : null}
                  </View>
                </View>
              </View>
            </Animated.View>
          );
        }}
      />

      <Aviso texto={error || errorEnvio} />
      <View style={[s.barra, { paddingBottom: teclado ? 8 : insets.bottom + 8 }]}>
        <TextInput
          selectionColor={color.acento}
          cursorColor={color.acento}
          value={texto}
          onChangeText={(t) => {
            setTexto(t);
            if (t) estoyEscribiendo();
          }}
          placeholder="Mensaje"
          placeholderTextColor={color.apagado}
          style={s.input}
          multiline
          maxLength={1000}
          accessibilityLabel="Escribe un mensaje"
        />
        <Pulsable onPress={mandar} disabled={!texto.trim()} vibra={false} encoge={0.9} style={[s.enviar, !texto.trim() && { backgroundColor: color.elevado }]} accessibilityRole="button" accessibilityLabel="Enviar">
          <MaterialCommunityIcons name="arrow-up" size={22} color={texto.trim() ? '#fff' : color.apagado} />
        </Pulsable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.linea, backgroundColor: color.fondo },
  volver: { width: 38, height: 38, borderRadius: 19, backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fuente.textoFuerte, fontSize: 17, color: color.tinta },
  sub: { fontFamily: fuente.texto, fontSize: 13, color: color.apagado },
  dia: { alignSelf: 'center', fontFamily: fuente.textoMedio, fontSize: 12, color: color.apagado, marginVertical: 12, textTransform: 'capitalize', backgroundColor: color.superficie, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  filaMsg: { flexDirection: 'row' },
  autor: { fontFamily: fuente.textoFuerte, fontSize: 12, marginLeft: 12 },
  burbuja: { borderRadius: 20, borderCurve: 'continuous', paddingHorizontal: 14, paddingVertical: 9 },
  burbujaMia: { backgroundColor: color.acento, borderBottomRightRadius: 6 },
  burbujaOtra: { backgroundColor: AJENO, borderBottomLeftRadius: 6 },
  msg: { fontFamily: fuente.texto, fontSize: 16, lineHeight: 21, color: color.tinta },
  pie: { flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: 8 },
  hora: { fontFamily: fuente.texto, fontSize: 11, color: color.apagado, fontVariant: ['tabular-nums'] },
  barra: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.linea, backgroundColor: color.fondo },
  input: { flex: 1, minHeight: 40, maxHeight: 120, fontFamily: fuente.texto, fontSize: 16, color: color.tinta, backgroundColor: color.superficie, borderRadius: 20, borderCurve: 'continuous', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },
  enviar: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.acento, alignItems: 'center', justifyContent: 'center' },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, transform: [{ scaleY: -1 }] },
  vacioIcono: { width: 64, height: 64, borderRadius: 20, backgroundColor: suave(color.acento, 0.15), alignItems: 'center', justifyContent: 'center' },
  vacioTitulo: { fontFamily: fuente.titulo, fontSize: 18, color: color.tinta },
  vacioTexto: { fontFamily: fuente.texto, fontSize: 14.5, color: color.apagado, textAlign: 'center' },
});
