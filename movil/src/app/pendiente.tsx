import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aviso, Boton } from '../components/ui';
import { useSesion } from '../lib/sesion';
import { mensajeError, supabase } from '../lib/supabase';
import { color, fuente, ROLES, sombra } from '../lib/tema';

/** Quien ha pedido acceso espera aquí a que administración lo apruebe. */
export default function Pendiente() {
  const insets = useSafeAreaInsets();
  const { session, perfil, solicitudes, recargar, salir } = useSesion();
  const [comprobando, setComprobando] = useState(false);
  const [error, setError] = useState('');
  const [retirando, setRetirando] = useState<string | null>(null);

  // Al volver a la app, comprueba si ya la han aprobado
  useEffect(() => {
    const sub = AppState.addEventListener('change', (e) => {
      if (e === 'active') recargar();
    });
    return () => sub.remove();
  }, [recargar]);

  async function comprobar() {
    setComprobando(true);
    await recargar();
    setComprobando(false);
  }

  async function retirar(hotelId: string) {
    setError('');
    setRetirando(hotelId);
    const { error: e } = await supabase.rpc('cancelar_solicitud', { p_hotel: hotelId });
    setRetirando(null);
    if (e) return setError(mensajeError(e));
    await recargar();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.fondo }} contentContainerStyle={[s.cuerpo, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.icono}>
        <MaterialCommunityIcons name="account-clock-outline" size={40} color={color.acento} />
      </View>
      <Text style={s.titulo}>Solicitud enviada</Text>
      <Text style={s.texto}>
        Administración tiene que aprobar tu acceso antes de que puedas ver los partes. Te avisarán; cuando lo hagan, pulsa «Comprobar de nuevo».
      </Text>

      <View style={s.tarjeta}>
        <Fila k="Nombre" v={perfil?.nombre ?? ''} />
        <Fila k="Departamento" v={perfil ? ROLES[perfil.rol] : ''} />
        <Fila k="Correo" v={session?.user.email ?? ''} />
      </View>

      {solicitudes.map((sol) => (
        <View key={sol.hotel_id} style={s.solicitud}>
          <MaterialCommunityIcons name="office-building-outline" size={22} color={color.marca2} />
          <View style={{ flex: 1 }}>
            <Text style={s.hotel}>{sol.hotel}</Text>
            <Text style={s.estado}>Esperando aprobación</Text>
          </View>
          <Boton texto="Retirar" tipo="fantasma" onPress={() => retirar(sol.hotel_id)} cargando={retirando === sol.hotel_id} />
        </View>
      ))}

      <Aviso texto={error} />
      <Boton texto="Comprobar de nuevo" icono="refresh" tipo="principal" grande onPress={comprobar} cargando={comprobando} style={{ alignSelf: 'stretch' }} />
      <Boton texto="Cerrar sesión" tipo="fantasma" onPress={salir} style={{ alignSelf: 'stretch' }} />
    </ScrollView>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={s.k}>{k}</Text>
      <Text style={s.v} numberOfLines={1}>
        {v}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  cuerpo: { paddingHorizontal: 20, gap: 14, alignItems: 'center' },
  icono: { width: 76, height: 76, borderRadius: 24, backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center', ...sombra },
  titulo: { fontFamily: fuente.titulo, fontSize: 24, color: color.tinta, textAlign: 'center' },
  texto: { fontFamily: fuente.texto, fontSize: 15.5, color: color.apagado, textAlign: 'center', lineHeight: 22 },
  tarjeta: { alignSelf: 'stretch', backgroundColor: color.superficie, borderRadius: 16, padding: 16, gap: 10, ...sombra },
  k: { fontFamily: fuente.textoMedio, fontSize: 14, color: color.apagado },
  v: { fontFamily: fuente.textoFuerte, fontSize: 14, color: color.tinta, flexShrink: 1, textAlign: 'right' },
  solicitud: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.superficie, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: color.linea },
  hotel: { fontFamily: fuente.titulo, fontSize: 16, color: color.tinta },
  estado: { fontFamily: fuente.textoMedio, fontSize: 13, color: color.curso },
});
