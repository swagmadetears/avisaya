import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import Constants from 'expo-constants';
import { Alert, Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { curvaApple, Entra, Pulsable, suavizar, toque } from '../../components/movimiento';
import { Aviso, Boton, Campo } from '../../components/ui';
import { useSesion } from '../../lib/sesion';
import { mensajeError, supabase } from '../../lib/supabase';
import { useHotelElegido } from '../../lib/hotel-elegido';
import { color, fuente, ROLES, suave, type Hotel, type NombreIcono } from '../../lib/tema';

export default function PerfilPestana() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil, hotel, hoteles, solicitudes, session, estadoPush, recargar, salir } = useSesion();
  const [nombre, setNombre] = useState(perfil?.nombre ?? '');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [modoNuevo, setModoNuevo] = useState<'codigo' | 'crear' | null>(null);
  const [codigo, setCodigo] = useState('');
  const [nombreHotel, setNombreHotel] = useState('');
  const [errorHotel, setErrorHotel] = useState('');
  const [msgHotel, setMsgHotel] = useState('');
  const [anadiendo, setAnadiendo] = useState(false);
  const [abierto, setAbierto] = useState<'nombre' | 'clave' | 'privacidad' | null>(null);
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');
  const [errorClave, setErrorClave] = useState('');
  const [msgClave, setMsgClave] = useState('');
  const [cambiandoClave, setCambiandoClave] = useState(false);
  const [hotelInicio, elegirHotelInicio] = useHotelElegido(perfil?.id);

  if (!perfil || !hotel) return null;

  async function guardar() {
    setMsg('');
    setError('');
    if (!nombre.trim()) return setError('El nombre no puede estar vacío.');
    setGuardando(true);
    const { error: e } = await supabase.from('perfiles').update({ nombre: nombre.trim().slice(0, 40) }).eq('id', perfil!.id);
    setGuardando(false);
    if (e) return setError(mensajeError(e));
    await recargar();
    setMsg('Guardado.');
  }

  async function compartirCodigo(h: Hotel) {
    await Share.share({
      message: `Únete a ${h.nombre} en Avisaya.\n1. Descarga la app y crea tu cuenta.\n2. Elige «Tengo un código» y escribe: ${h.codigo_union}\n(Si ya usas Avisaya: Ajustes → Añadir otro hotel.)`,
    }).catch(() => {});
  }

  async function anadirHotel() {
    setErrorHotel('');
    setMsgHotel('');
    setAnadiendo(true);
    try {
      if (modoNuevo === 'codigo') {
        if (codigo.trim().length < 4) throw new Error('Escribe el código del hotel.');
        const { error: e } = await supabase.rpc('unirse_hotel', { p_codigo: codigo.trim(), p_mi_nombre: perfil!.nombre, p_rol: perfil!.rol === 'admin' ? 'recepcion' : perfil!.rol });
        if (e) throw e;
      } else {
        if (nombreHotel.trim().length < 2) throw new Error('Escribe el nombre del hotel.');
        const { error: e } = await supabase.rpc('crear_hotel', { p_nombre_hotel: nombreHotel.trim(), p_mi_nombre: perfil!.nombre });
        if (e) throw e;
      }
      await recargar();
      setMsgHotel(modoNuevo === 'codigo' ? 'Solicitud enviada. Verás ese hotel cuando administración la apruebe.' : 'Hotel creado. Comparte su código con el equipo.');
      setCodigo('');
      setNombreHotel('');
      setModoNuevo(null);
    } catch (e) {
      setErrorHotel(mensajeError(e));
    } finally {
      setAnadiendo(false);
    }
  }

  async function cambiarClave() {
    setErrorClave('');
    setMsgClave('');
    if (clave.length < 8) return setErrorClave('La contraseña nueva debe tener al menos 8 caracteres.');
    if (clave !== clave2) return setErrorClave('Las dos contraseñas no coinciden.');
    setCambiandoClave(true);
    const { error: e } = await supabase.auth.updateUser({ password: clave });
    setCambiandoClave(false);
    if (e) return setErrorClave(mensajeError(e));
    setClave('');
    setClave2('');
    setMsgClave('Contraseña cambiada.');
    toque('exito');
  }

  function preguntarSalir(todos: boolean) {
    Alert.alert(todos ? '¿Cerrar sesión en todos tus móviles?' : '¿Cerrar sesión en este móvil?', todos ? 'Tendrás que volver a entrar con tu correo y contraseña en cada uno.' : undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          if (todos) await supabase.auth.signOut({ scope: 'global' }).catch(() => {});
          salir();
        },
      },
    ]);
  }

  const abrirCerrar = (v: typeof abierto) => {
    suavizar();
    setAbierto(v);
  };

  const soporte = (asunto: string) => Linking.openURL(`mailto:hola@avisaya.example?subject=${encodeURIComponent(asunto)}`).catch(() => {});
  const inicioActual = hotelInicio === 'todos' ? 'Todos' : (hoteles.find((h) => h.id === hotelInicio)?.nombre ?? (perfil.rol === 'tecnico' ? 'Todos' : hotel.nombre));

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, gap: 22, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
        <Entra>
          <View style={s.cabecera}>
            <View style={s.avatar}>
              <Text style={s.avatarTexto}>{perfil.nombre.trim().slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.nombre} numberOfLines={1}>
                {perfil.nombre}
              </Text>
              <Text style={s.ayuda} numberOfLines={1}>
                {ROLES[perfil.rol]} · {session?.user.email ?? ''}
              </Text>
            </View>
          </View>
        </Entra>

        <Seccion titulo="Personalizar perfil" orden={1}>
          <Fila icono="account-edit-outline" tono={color.camino} titulo="Tu nombre" valor={perfil.nombre} onPress={() => abrirCerrar(abierto === 'nombre' ? null : 'nombre')} abierto={abierto === 'nombre'} />
          {abierto === 'nombre' ? (
            <Animated.View entering={FadeIn.duration(220).easing(curvaApple)} exiting={FadeOut.duration(140)} style={s.desplegado}>
              <Campo etiqueta="Cómo te ve el equipo" value={nombre} onChangeText={setNombre} maxLength={40} />
              <Aviso texto={error} />
              <Aviso texto={msg} tono={color.ok} />
              <Boton texto="Guardar nombre" tipo="principal" onPress={guardar} cargando={guardando} />
            </Animated.View>
          ) : null}
          <Fila icono="badge-account-horizontal-outline" tono={color.espera} titulo="Departamento" valor={ROLES[perfil.rol]} />
          {hoteles.length > 1 ? (
            <Fila
              icono="home-city-outline"
              tono={color.marca2}
              titulo="Hotel al abrir la app"
              valor={inicioActual}
              onPress={() =>
                Alert.alert('¿Qué hotel quieres ver al abrir?', undefined, [
                  { text: 'Todos mis hoteles', onPress: () => elegirHotelInicio('todos') },
                  ...hoteles.map((h) => ({ text: h.nombre, onPress: () => elegirHotelInicio(h.id) })),
                  { text: 'Cancelar', style: 'cancel' as const },
                ])
              }
            />
          ) : null}
        </Seccion>

        <Seccion titulo={hoteles.length > 1 ? `Tus hoteles (${hoteles.length})` : 'Tu hotel'} orden={2} pie="Cada persona crea su cuenta, elige «Tengo un código» y escribe el código de su hotel.">
          {hoteles.map((h) => (
            <View key={h.id} style={s.hotel}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.hotelNombre} numberOfLines={1}>
                  {h.nombre}
                </Text>
                <Text style={s.codigo} selectable>
                  {h.codigo_union}
                </Text>
              </View>
              <Pulsable onPress={() => compartirCodigo(h)} style={s.compartir} accessibilityRole="button" accessibilityLabel={`Compartir el código de ${h.nombre}`}>
                <MaterialCommunityIcons name="share-variant" size={18} color={color.acento} />
                <Text style={s.compartirTexto}>Compartir</Text>
              </Pulsable>
            </View>
          ))}
          {solicitudes.map((sol) => (
            <Fila key={sol.hotel_id} icono="clock-outline" tono={color.curso} titulo={sol.hotel} valor="Esperando aprobación" />
          ))}
          {modoNuevo === null ? (
            <>
              <Fila icono="plus-circle-outline" tono={color.acento} titulo="Pedir acceso a otro hotel" onPress={() => { suavizar(); setModoNuevo('codigo'); }} />
              {perfil.rol === 'admin' ? <Fila icono="office-building-cog-outline" tono={color.acento} titulo="Crear un hotel nuevo" onPress={() => { suavizar(); setModoNuevo('crear'); }} /> : null}
            </>
          ) : (
            <Animated.View entering={FadeIn.duration(220).easing(curvaApple)} exiting={FadeOut.duration(140)} style={s.desplegado}>
              {modoNuevo === 'codigo' ? (
                <Campo etiqueta="Código del otro hotel" value={codigo} onChangeText={(t) => setCodigo(t.toUpperCase())} placeholder="A7F3K2" autoCapitalize="characters" autoCorrect={false} grande maxLength={10} />
              ) : (
                <Campo etiqueta="Nombre del hotel nuevo" value={nombreHotel} onChangeText={setNombreHotel} placeholder="Hotel Sol Playa" maxLength={80} />
              )}
              <Text style={s.ayuda}>
                {modoNuevo === 'codigo'
                  ? `Administración de ese hotel tendrá que aprobarlo. Seguirás como ${ROLES[perfil.rol]} y verás los partes de todos tus hoteles juntos.`
                  : 'Tendrá su propio código para invitar a su equipo.'}
              </Text>
              <Aviso texto={errorHotel} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Boton texto="Cancelar" onPress={() => { setModoNuevo(null); setErrorHotel(''); }} style={{ flex: 1 }} />
                <Boton texto={modoNuevo === 'codigo' ? 'Enviar solicitud' : 'Crear'} tipo="principal" onPress={anadirHotel} cargando={anadiendo} style={{ flex: 2 }} />
              </View>
            </Animated.View>
          )}
          {msgHotel ? <Aviso texto={msgHotel} tono={color.ok} /> : null}
        </Seccion>

        {perfil.rol === 'admin' ? (
          <Seccion titulo="Administración" orden={3}>
            <Fila icono="account-group-outline" tono={color.acento} titulo="Equipo" valor="Personas y accesos" onPress={() => router.push('/equipo')} />
          </Seccion>
        ) : null}

        <Seccion titulo="Notificaciones" orden={4}>
          <Fila icono="bell-ring-outline" tono={color.pendiente} titulo="Avisos con la app cerrada" valor={TEXTO_PUSH[estadoPush ?? 'no-disponible']} />
          <Fila icono="cog-outline" tono={color.apagado} titulo="Ajustes de notificaciones del móvil" onPress={() => Linking.openSettings().catch(() => {})} />
        </Seccion>

        <Seccion titulo="Seguridad" orden={5}>
          <Fila icono="lock-reset" tono={color.camino} titulo="Cambiar contraseña" onPress={() => abrirCerrar(abierto === 'clave' ? null : 'clave')} abierto={abierto === 'clave'} />
          {abierto === 'clave' ? (
            <Animated.View entering={FadeIn.duration(220).easing(curvaApple)} exiting={FadeOut.duration(140)} style={s.desplegado}>
              <Campo etiqueta="Contraseña nueva" value={clave} onChangeText={setClave} secureTextEntry autoCapitalize="none" placeholder="Al menos 8 caracteres" />
              <Campo etiqueta="Repítela" value={clave2} onChangeText={setClave2} secureTextEntry autoCapitalize="none" />
              <Aviso texto={errorClave} />
              <Aviso texto={msgClave} tono={color.ok} />
              <Boton texto="Guardar contraseña" tipo="principal" onPress={cambiarClave} cargando={cambiandoClave} />
            </Animated.View>
          ) : null}
          <Fila icono="logout" tono={color.curso} titulo="Cerrar sesión" onPress={() => preguntarSalir(false)} />
          <Fila icono="cellphone-remove" tono={color.pendiente} titulo="Cerrar sesión en todos mis móviles" onPress={() => preguntarSalir(true)} />
        </Seccion>

        <Seccion titulo="Privacidad" orden={6}>
          <Fila icono="shield-account-outline" tono={color.ok} titulo="Quién ve tus datos" onPress={() => abrirCerrar(abierto === 'privacidad' ? null : 'privacidad')} abierto={abierto === 'privacidad'} />
          {abierto === 'privacidad' ? (
            <Animated.View entering={FadeIn.duration(220).easing(curvaApple)} exiting={FadeOut.duration(140)} style={s.desplegado}>
              <Text style={s.texto}>Solo las personas aprobadas en tus hoteles ven tu nombre, tus partes, sus fotos y tus mensajes. Ningún otro hotel puede verlos.</Text>
              <Text style={s.texto}>Tu correo solo lo ve administración, para gestionar el acceso.</Text>
            </Animated.View>
          ) : null}
          <Fila icono="account-remove-outline" tono={color.pendiente} titulo="Pedir que borren mi cuenta" onPress={() => soporte('Borrar mi cuenta de Avisaya')} />
        </Seccion>

        <Seccion titulo="Ayuda y soporte" orden={7} pie={`Avisaya ${Constants.expoConfig?.version ?? ''}`}>
          <Fila icono="email-outline" tono={color.camino} titulo="Escribir a soporte" onPress={() => soporte('Ayuda con Avisaya')} />
          <Fila icono="bug-outline" tono={color.curso} titulo="Avisar de un fallo de la app" onPress={() => soporte('Fallo en la app Avisaya')} />
          <Fila icono="lightbulb-on-outline" tono={color.espera} titulo="Proponer una mejora" onPress={() => soporte('Idea para Avisaya')} />
        </Seccion>
      </ScrollView>
    </View>
  );
}

const TEXTO_PUSH: Record<NonNullable<ReturnType<typeof useSesion>['estadoPush']>, string> = {
  activo: 'Activados',
  'sin-permiso': 'Sin permiso',
  'expo-go': 'No en Expo Go',
  'no-disponible': 'No disponibles',
  error: 'Error',
};

/** Un grupo de ajustes, como en los Ajustes del iPhone. */
function Seccion({ titulo, children, pie, orden = 0 }: { titulo: string; children: React.ReactNode; pie?: string; orden?: number }) {
  return (
    <Entra orden={orden} style={{ gap: 8 }}>
      <Text style={s.seccion}>{titulo.toUpperCase()}</Text>
      <View style={s.grupo}>{children}</View>
      {pie ? <Text style={[s.ayuda, { paddingHorizontal: 4 }]}>{pie}</Text> : null}
    </Entra>
  );
}

function Fila({ icono, tono, titulo, valor, onPress, abierto }: { icono: NombreIcono; tono: string; titulo: string; valor?: string; onPress?: () => void; abierto?: boolean }) {
  const contenido = (
    <>
      <View style={[s.icono, { backgroundColor: suave(tono, 0.18) }]}>
        <MaterialCommunityIcons name={icono} size={19} color={tono} />
      </View>
      <Text style={s.filaTitulo} numberOfLines={1}>
        {titulo}
      </Text>
      {valor ? (
        <Text style={s.filaValor} numberOfLines={1}>
          {valor}
        </Text>
      ) : null}
      {onPress ? <MaterialCommunityIcons name={abierto ? 'chevron-down' : 'chevron-right'} size={20} color={color.apagado} /> : null}
    </>
  );
  return onPress ? (
    <Pulsable onPress={onPress} encoge={0.985} style={s.fila} accessibilityRole="button">
      {contenido}
    </Pulsable>
  ) : (
    <View style={s.fila}>{contenido}</View>
  );
}

const s = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: color.acento, alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(255,106,43,0.3)' },
  avatarTexto: { fontFamily: fuente.tituloFuerte, fontSize: 28, color: '#fff' },
  nombre: { fontFamily: fuente.tituloFuerte, fontSize: 26, color: color.tinta, letterSpacing: -0.5 },
  seccion: { fontFamily: fuente.textoFuerte, fontSize: 12.5, letterSpacing: 0.8, color: color.apagado, paddingHorizontal: 4 },
  grupo: { backgroundColor: color.superficie, borderRadius: 18, borderCurve: 'continuous', overflow: 'hidden' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.linea },
  icono: { width: 32, height: 32, borderRadius: 9, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  filaTitulo: { flex: 1, fontFamily: fuente.textoMedio, fontSize: 15.5, color: color.tinta },
  filaValor: { fontFamily: fuente.texto, fontSize: 14.5, color: color.apagado, maxWidth: '45%', textAlign: 'right' },
  desplegado: { gap: 12, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.linea, backgroundColor: color.elevado },
  hotel: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.linea },
  hotelNombre: { fontFamily: fuente.textoFuerte, fontSize: 16, color: color.tinta },
  codigo: { fontFamily: fuente.numero, fontSize: 20, letterSpacing: 4, color: color.acento },
  compartir: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: suave(color.acento, 0.14) },
  compartirTexto: { fontFamily: fuente.textoFuerte, fontSize: 13.5, color: color.acento },
  ayuda: { fontFamily: fuente.texto, fontSize: 13, color: color.apagado, lineHeight: 18 },
  texto: { fontFamily: fuente.texto, fontSize: 14.5, color: color.tinta, lineHeight: 20 },
});
