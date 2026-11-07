import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aviso, Boton, Campo } from '../components/ui';
import { useSesion } from '../lib/sesion';
import { mensajeError, supabase } from '../lib/supabase';
import { color, fuente, ROLES, sombra } from '../lib/tema';

export default function Ajustes() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil, hotel, session, estadoPush, recargar, salir } = useSesion();
  const [nombre, setNombre] = useState(perfil?.nombre ?? '');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmarSalir, setConfirmarSalir] = useState(false);

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

  async function compartirCodigo() {
    await Share.share({
      message: `Únete a ${hotel!.nombre} en Avisaya.\n1. Descarga la app y crea tu cuenta.\n2. Elige «Tengo un código» y escribe: ${hotel!.codigo_union}`,
    }).catch(() => {});
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <View style={[s.barra, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 12 }]}>
        <Text style={s.titulo}>Ajustes</Text>
        <Pressable onPress={() => router.back()} style={s.cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
          <MaterialCommunityIcons name="close" size={22} color={color.tinta} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <View style={s.codigoCaja}>
          <Text style={s.codigoEtiqueta}>CÓDIGO PARA TU EQUIPO</Text>
          <Text style={s.codigo} selectable>
            {hotel.codigo_union}
          </Text>
          <Text style={s.codigoAyuda}>Cada persona crea su cuenta en la app, elige «Tengo un código» y escribe este código.</Text>
          <Boton texto="Compartir código" icono="share-variant" tipo="principal" onPress={compartirCodigo} />
        </View>

        <View style={s.tarjeta}>
          <Fila etiqueta="Hotel" valor={hotel.nombre} />
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
  barra: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: color.superficie, borderBottomWidth: 1, borderBottomColor: color.linea },
  titulo: { flex: 1, fontFamily: fuente.titulo, fontSize: 21, color: color.tinta },
  cerrar: { width: 42, height: 42, borderRadius: 12, backgroundColor: color.elevado, alignItems: 'center', justifyContent: 'center' },
  tarjeta: { backgroundColor: color.superficie, borderRadius: 18, padding: 16, gap: 12, ...sombra },
  codigoCaja: { backgroundColor: color.marca, borderRadius: 18, padding: 18, gap: 10 },
  codigoEtiqueta: { fontFamily: fuente.textoFuerte, fontSize: 12, letterSpacing: 1, color: 'rgba(255,255,255,0.75)' },
  codigo: { fontFamily: fuente.numero, fontSize: 38, letterSpacing: 6, color: '#fff' },
  codigoAyuda: { fontFamily: fuente.texto, fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  filaEtiqueta: { fontFamily: fuente.textoMedio, fontSize: 14, color: color.apagado },
  filaValor: { fontFamily: fuente.textoFuerte, fontSize: 14, color: color.tinta, flexShrink: 1, textAlign: 'right' },
  pregunta: { fontFamily: fuente.textoFuerte, fontSize: 16, color: color.tinta },
});
