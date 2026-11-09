import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Entra } from '../../components/movimiento';
import { Aviso, Boton, Campo } from '../../components/ui';
import { useSesion } from '../../lib/sesion';
import { mensajeError, supabase } from '../../lib/supabase';
import { color, fuente, ROLES, sombra, type Hotel } from '../../lib/tema';

export default function PerfilPestana() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil, hotel, hoteles, solicitudes, session, estadoPush, recargar, salir } = useSesion();
  const [nombre, setNombre] = useState(perfil?.nombre ?? '');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmarSalir, setConfirmarSalir] = useState(false);
  const [modoNuevo, setModoNuevo] = useState<'codigo' | 'crear' | null>(null);
  const [codigo, setCodigo] = useState('');
  const [nombreHotel, setNombreHotel] = useState('');
  const [errorHotel, setErrorHotel] = useState('');
  const [msgHotel, setMsgHotel] = useState('');
  const [anadiendo, setAnadiendo] = useState(false);

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

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, gap: 14, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
        <Entra>
          <View style={s.cabecera}>
            <View style={s.avatar}>
              <Text style={s.avatarTexto}>{perfil.nombre.trim().slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.titulo}>Perfil</Text>
              <Text style={s.ayuda} numberOfLines={1}>
                {perfil.nombre} · {ROLES[perfil.rol]}
              </Text>
            </View>
          </View>
        </Entra>
        {perfil.rol === 'admin' ? (
          <Pressable onPress={() => router.push('/equipo')} style={s.equipo} accessibilityRole="button">
            <MaterialCommunityIcons name="account-group-outline" size={26} color={color.acento} />
            <View style={{ flex: 1 }}>
              <Text style={s.equipoTitulo}>Equipo</Text>
              <Text style={s.ayuda}>Departamentos, hoteles y acceso de cada persona</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={color.apagado} />
          </Pressable>
        ) : null}

        <Text style={s.seccion}>{hoteles.length > 1 ? `Tus hoteles (${hoteles.length})` : 'Tu hotel'}</Text>
        {hoteles.map((h) => (
          <View key={h.id} style={s.codigoCaja}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="office-building-outline" size={20} color="#fff" />
              <Text style={s.hotelNombre} numberOfLines={2}>
                {h.nombre}
              </Text>
            </View>
            <Text style={s.codigoEtiqueta}>CÓDIGO PARA EL EQUIPO</Text>
            <Text style={s.codigo} selectable>
              {h.codigo_union}
            </Text>
            <Boton texto="Compartir código" icono="share-variant" tipo="principal" onPress={() => compartirCodigo(h)} />
          </View>
        ))}
        <Text style={s.ayuda}>Cada persona crea su cuenta, elige «Tengo un código» y escribe el código. Quien ya usa Avisaya lo añade aquí abajo.</Text>

        <View style={s.tarjeta}>
          {modoNuevo === null ? (
            <View style={{ gap: 8 }}>
              <Boton texto="Pedir acceso a otro hotel (tengo su código)" icono="plus" onPress={() => setModoNuevo('codigo')} />
              {perfil.rol === 'admin' ? <Boton texto="Crear un hotel nuevo" icono="office-building-cog-outline" tipo="fantasma" onPress={() => setModoNuevo('crear')} /> : null}
            </View>
          ) : (
            <>
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
            </>
          )}
          <Aviso texto={msgHotel} tono={color.ok} />
          {solicitudes.map((sol) => (
            <Text key={sol.hotel_id} style={s.ayuda}>
              Pendiente: {sol.hotel} (esperando aprobación de administración)
            </Text>
          ))}
        </View>

        <View style={s.tarjeta}>
          <Fila etiqueta="Departamento" valor={ROLES[perfil.rol]} />
          <Fila etiqueta="Correo" valor={session?.user.email ?? ''} />
          <Fila etiqueta="Avisos con la app cerrada" valor={TEXTO_PUSH[estadoPush ?? 'no-disponible']} />
        </View>

        <View style={s.tarjeta}>
          <Campo etiqueta="Tu nombre" value={nombre} onChangeText={setNombre} maxLength={40} />
          <Aviso texto={error} />
          <Aviso texto={msg} tono={color.ok} />
          <Boton texto="Guardar nombre" onPress={guardar} cargando={guardando} />
        </View>

        {confirmarSalir ? (
          <View style={s.tarjeta}>
            <Text style={s.pregunta}>¿Cerrar sesión en este móvil?</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Boton texto="No" onPress={() => setConfirmarSalir(false)} style={{ flex: 1 }} />
              <Boton texto="Cerrar sesión" tipo="principal" onPress={salir} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <Boton texto="Cerrar sesión" icono="logout" tipo="fantasma" onPress={() => setConfirmarSalir(true)} />
        )}
      </ScrollView>
    </View>
  );
}

const TEXTO_PUSH: Record<NonNullable<ReturnType<typeof useSesion>['estadoPush']>, string> = {
  activo: 'Activados',
  'sin-permiso': 'Sin permiso (actívalo en los ajustes del móvil)',
  'expo-go': 'No disponibles en Expo Go',
  'no-disponible': 'No disponibles',
  error: 'Error al activarlos',
};

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={s.fila}>
      <Text style={s.filaEtiqueta}>{etiqueta}</Text>
      <Text style={s.filaValor} numberOfLines={1}>
        {valor}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 6 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.acento, alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(255,106,43,0.3)' },
  avatarTexto: { fontFamily: fuente.tituloFuerte, fontSize: 24, color: '#fff' },
  titulo: { fontFamily: fuente.tituloFuerte, fontSize: 34, color: color.tinta, letterSpacing: -0.8 },
  tarjeta: { backgroundColor: color.superficie, borderRadius: 18, padding: 16, gap: 12, ...sombra },
  codigoCaja: { backgroundColor: color.marca, borderRadius: 18, padding: 16, gap: 8 },
  equipo: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.superficie, borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: color.acento, ...sombra },
  equipoTitulo: { fontFamily: fuente.titulo, fontSize: 17, color: color.tinta },
  seccion: { fontFamily: fuente.titulo, fontSize: 16, color: color.tinta, marginBottom: -4 },
  hotelNombre: { flex: 1, fontFamily: fuente.titulo, fontSize: 17, color: '#fff' },
  ayuda: { fontFamily: fuente.texto, fontSize: 13.5, color: color.apagado, lineHeight: 19 },
  codigoEtiqueta: { fontFamily: fuente.textoFuerte, fontSize: 12, letterSpacing: 1, color: 'rgba(255,255,255,0.75)' },
  codigo: { fontFamily: fuente.numero, fontSize: 32, letterSpacing: 6, color: '#fff' },
  codigoAyuda: { fontFamily: fuente.texto, fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  filaEtiqueta: { fontFamily: fuente.textoMedio, fontSize: 14, color: color.apagado },
  filaValor: { fontFamily: fuente.textoFuerte, fontSize: 14, color: color.tinta, flexShrink: 1, textAlign: 'right' },
  pregunta: { fontFamily: fuente.textoFuerte, fontSize: 16, color: color.tinta },
});
