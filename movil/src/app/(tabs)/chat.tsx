import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated, Esqueleto, FadeInDown, LinearTransition, Pulsable, toque } from '../../components/movimiento';
import { Aviso } from '../../components/ui';
import { useMensajes, type Mensaje } from '../../lib/chat';
import { useHotelElegido } from '../../lib/hotel-elegido';
import { useSesion } from '../../lib/sesion';
import { supabase } from '../../lib/supabase';
import { color, fuente, ROLES, suave, type Perfil, type Rol } from '../../lib/tema';

const TONO: Record<Rol, string> = { admin: color.espera, recepcion: color.camino, limpieza: color.marca2, tecnico: color.curso };

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
function dia(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(Date.now() - 864e5);
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Chat del equipo del hotel: recepción, limpieza y mantenimiento hablan sin salir de la app. */
export default function Chat() {
  const insets = useSafeAreaInsets();
  const { perfil, hotel, hoteles } = useSesion();
  const [elegido, elegir] = useHotelElegido(perfil?.id);
  const varios = hoteles.length > 1;
  // El chat es de un hotel concreto: si arriba están «todos», se usa el principal
  const hotelId = hoteles.some((h) => h.id === elegido) ? elegido : (hotel?.id ?? null);
  const { mensajes, cargando, error, enviar } = useMensajes(hotelId, perfil?.id ?? null);
  const [texto, setTexto] = useState('');
  const [errorEnvio, setErrorEnvio] = useState('');
  const [perfiles, setPerfiles] = useState<Record<string, Perfil>>({});
  const [teclado, setTeclado] = useState(false);

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
  }, [hotelId]);

  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setTeclado(true));
    const b = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setTeclado(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  const nombreHotel = useMemo(() => hoteles.find((h) => h.id === hotelId)?.nombre ?? '', [hoteles, hotelId]);

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

  // Margen de abajo: en iOS la barra de pestañas flota encima del contenido
  const abajo = teclado ? 8 : Platform.OS === 'ios' ? insets.bottom + 58 : 10;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.fondo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.cabecera, { paddingTop: insets.top + 12 }]}>
        <Text style={s.titulo}>Chat</Text>
        <Text style={s.sub} numberOfLines={1}>
          Equipo de {nombreHotel} · recepción, limpieza y mantenimiento
        </Text>
        {varios ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>
            {hoteles.map((h) => {
              const activo = h.id === hotelId;
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
      </View>

      <Animated.FlatList
        inverted
        data={mensajes}
        keyExtractor={(m) => m.id}
        itemLayoutAnimation={LinearTransition.springify().damping(22).stiffness(200)}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 4, flexGrow: 1 }}
        ListEmptyComponent={
          cargando ? (
            <View style={{ gap: 10, padding: 8 }}>
              <Esqueleto alto={38} ancho="60%" radio={18} />
              <Esqueleto alto={38} ancho="45%" radio={18} style={{ alignSelf: 'flex-end' }} />
              <Esqueleto alto={58} ancho="70%" radio={18} />
            </View>
          ) : (
            <View style={s.vacio}>
              <View style={s.vacioIcono}>
                <MaterialCommunityIcons name="chat-processing-outline" size={30} color={color.acento} />
              </View>
              <Text style={s.vacioTitulo}>Aún no hay mensajes</Text>
              <Text style={s.vacioTexto}>Escribe al técnico o al resto del equipo. Les llegará un aviso al móvil.</Text>
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const mio = item.autor_id === perfil.id;
          const anterior: Mensaje | undefined = mensajes[index + 1];
          const siguiente: Mensaje | undefined = mensajes[index - 1];
          const nuevoDia = !anterior || new Date(anterior.creado_en).toDateString() !== new Date(item.creado_en).toDateString();
          const mismoAutorAntes = !nuevoDia && anterior?.autor_id === item.autor_id;
          const ultimoDelGrupo = !siguiente || siguiente.autor_id !== item.autor_id;
          const autor = perfiles[item.autor_id];
          return (
            <Animated.View entering={index < 2 ? FadeInDown.springify().damping(18).stiffness(220) : undefined}>
              {nuevoDia ? <Text style={s.dia}>{dia(item.creado_en)}</Text> : null}
              <View style={[s.filaMsg, mio ? { justifyContent: 'flex-end' } : null, !mismoAutorAntes && { marginTop: 8 }]}>
                <View style={{ maxWidth: '80%', gap: 3, alignItems: mio ? 'flex-end' : 'flex-start' }}>
                  {!mio && !mismoAutorAntes ? (
                    <Text style={[s.autor, { color: autor ? TONO[autor.rol] : color.apagado }]} numberOfLines={1}>
                      {autor ? `${autor.nombre} · ${ROLES[autor.rol]}` : 'Equipo'}
                    </Text>
                  ) : null}
                  <View
                    style={[
                      s.burbuja,
                      mio ? s.burbujaMia : s.burbujaOtra,
                      ultimoDelGrupo && (mio ? { borderBottomRightRadius: 6 } : { borderBottomLeftRadius: 6 }),
                      item.enviando && { opacity: 0.6 },
                    ]}>
                    <Text selectable style={[s.msg, mio && { color: '#fff' }]}>
                      {item.texto}
                    </Text>
                  </View>
                  {ultimoDelGrupo ? <Text style={s.hora}>{item.enviando ? 'Enviando…' : hora(item.creado_en)}</Text> : null}
                </View>
              </View>
            </Animated.View>
          );
        }}
      />

      <Aviso texto={error || errorEnvio} />
      <View style={[s.barra, { paddingBottom: abajo }]}>
        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder={`Mensaje a ${nombreHotel || 'tu equipo'}`}
          placeholderTextColor={color.apagado}
          style={s.input}
          multiline
          maxLength={1000}
          accessibilityLabel="Escribe un mensaje"
        />
        <Pulsable onPress={mandar} disabled={!texto.trim()} vibra={false} encoge={0.88} style={[s.enviar, !texto.trim() && { backgroundColor: color.elevado }]} accessibilityRole="button" accessibilityLabel="Enviar">
          <MaterialCommunityIcons name="arrow-up" size={22} color={texto.trim() ? '#fff' : color.apagado} />
        </Pulsable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  cabecera: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.linea },
  titulo: { fontFamily: fuente.tituloFuerte, fontSize: 34, color: color.tinta, letterSpacing: -0.8 },
  sub: { fontFamily: fuente.texto, fontSize: 14, color: color.apagado },
  pastilla: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: color.superficie, maxWidth: 200 },
  pastillaActiva: { backgroundColor: color.tinta },
  pastillaTexto: { fontFamily: fuente.textoFuerte, fontSize: 14, color: color.tinta },
  dia: { alignSelf: 'center', fontFamily: fuente.textoMedio, fontSize: 12, color: color.apagado, marginVertical: 10, textTransform: 'capitalize' },
  filaMsg: { flexDirection: 'row' },
  autor: { fontFamily: fuente.textoFuerte, fontSize: 12, marginLeft: 12 },
  burbuja: { borderRadius: 20, borderCurve: 'continuous', paddingHorizontal: 14, paddingVertical: 9 },
  burbujaMia: { backgroundColor: color.acento },
  burbujaOtra: { backgroundColor: color.elevado },
  msg: { fontFamily: fuente.texto, fontSize: 16, lineHeight: 21, color: color.tinta },
  hora: { fontFamily: fuente.texto, fontSize: 11, color: color.apagado, marginHorizontal: 8, fontVariant: ['tabular-nums'] },
  barra: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.linea, backgroundColor: color.fondo },
  input: { flex: 1, minHeight: 40, maxHeight: 120, fontFamily: fuente.texto, fontSize: 16, color: color.tinta, backgroundColor: color.superficie, borderRadius: 20, borderCurve: 'continuous', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },
  enviar: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.acento, alignItems: 'center', justifyContent: 'center' },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, transform: [{ scaleY: -1 }] },
  vacioIcono: { width: 64, height: 64, borderRadius: 20, backgroundColor: suave(color.acento, 0.15), alignItems: 'center', justifyContent: 'center' },
  vacioTitulo: { fontFamily: fuente.titulo, fontSize: 18, color: color.tinta },
  vacioTexto: { fontFamily: fuente.texto, fontSize: 14.5, color: color.apagado, textAlign: 'center' },
});
