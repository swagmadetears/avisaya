import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boton } from '../components/ui';
import { useSesion } from '../lib/sesion';
import { color, fuente } from '../lib/tema';

/** Pantalla para quien tiene la cuenta desactivada por administración. */
export default function Desactivada() {
  const insets = useSafeAreaInsets();
  const { session, salir, recargar } = useSesion();
  return (
    <View style={[s.fondo, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}>
      <MaterialCommunityIcons name="account-cancel-outline" size={56} color={color.pendiente} />
      <Text style={s.titulo}>Tu cuenta está desactivada</Text>
      <Text style={s.texto}>Administración de tu hotel ha desactivado el acceso de {session?.user.email ?? 'esta cuenta'}. Si crees que es un error, habla con ellos.</Text>
      <Boton texto="Comprobar de nuevo" onPress={recargar} style={{ alignSelf: 'stretch' }} />
      <Boton texto="Cerrar sesión" tipo="fantasma" onPress={salir} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo, alignItems: 'center', paddingHorizontal: 24, gap: 14 },
  titulo: { fontFamily: fuente.titulo, fontSize: 22, color: color.tinta, textAlign: 'center' },
  texto: { fontFamily: fuente.texto, fontSize: 15.5, color: color.apagado, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
});
