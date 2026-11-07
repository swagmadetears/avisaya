import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aviso, Boton, Campo } from '../components/ui';
import { useSesion } from '../lib/sesion';
import { mensajeError, supabase } from '../lib/supabase';
import { color, fuente, sombra } from '../lib/tema';

/** Paso 3 de recuperar la contraseña: el código ya es correcto, se pone la nueva. */
export default function NuevaClave() {
  const insets = useSafeAreaInsets();
  const { session, setRecuperando, salir } = useSesion();
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function guardar() {
    setError('');
    if (clave.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    if (clave !== clave2) return setError('Las dos contraseñas no coinciden.');
    setCargando(true);
    const { error: e } = await supabase.auth.updateUser({ password: clave });
    setCargando(false);
    if (e) return setError(mensajeError(e));
    // Contraseña cambiada: la app sigue a la pantalla que le toque
    setRecuperando(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.fondo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={[s.hero, { paddingTop: insets.top + 36 }]}>
          <View style={s.icono}>
            <MaterialCommunityIcons name="lock-reset" size={28} color="#fff" />
          </View>
          <Text style={s.paso}>PASO 3 DE 3</Text>
          <Text style={s.titulo}>Contraseña nueva</Text>
          <Text style={s.lema}>Código correcto. Elige la contraseña nueva para {session?.user.email ?? 'tu cuenta'}.</Text>
        </View>
        <View style={[s.cuerpo, { paddingBottom: insets.bottom + 24 }]}>
          <View style={s.tarjeta}>
            <Campo etiqueta="Contraseña nueva" value={clave} onChangeText={setClave} placeholder="Mínimo 6 caracteres" secureTextEntry autoComplete="new-password" textContentType="newPassword" autoFocus />
            <Campo etiqueta="Repite la contraseña" value={clave2} onChangeText={setClave2} secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={guardar} />
            <Aviso texto={error} />
            <Boton texto="Guardar y entrar" tipo="principal" grande onPress={guardar} cargando={cargando} />
            <Boton texto="Cancelar" tipo="fantasma" onPress={salir} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: color.marca, paddingHorizontal: 24, paddingBottom: 28, gap: 8 },
  icono: { width: 52, height: 52, borderRadius: 15, backgroundColor: color.acento, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  paso: { fontFamily: fuente.textoFuerte, fontSize: 12, letterSpacing: 1, color: 'rgba(255,255,255,0.75)' },
  titulo: { fontFamily: fuente.tituloFuerte, fontSize: 28, color: '#fff' },
  lema: { fontFamily: fuente.texto, fontSize: 15.5, color: 'rgba(255,255,255,0.85)', lineHeight: 22 },
  cuerpo: { padding: 16 },
  tarjeta: { backgroundColor: color.superficie, borderRadius: 18, padding: 18, gap: 16, ...sombra },
});
