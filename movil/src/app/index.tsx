import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Logo } from '../components/Logo';
import { color, fuente } from '../lib/tema';

/** Pantalla de carga mientras se comprueba la sesión. El Guardian redirige. */
export default function Inicio() {
  return (
    <View style={s.fondo}>
      <Logo tamano={88} />
      <Text style={s.nombre}>Avisaya</Text>
      <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 72, height: 72, borderRadius: 22, backgroundColor: color.acento, alignItems: 'center', justifyContent: 'center' },
  nombre: { marginTop: 16, fontFamily: fuente.tituloFuerte, fontSize: 30, color: '#fff' },
});
