import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aviso, Boton, Campo } from '../components/ui';
import { useSesion } from '../lib/sesion';
import { mensajeError, supabase } from '../lib/supabase';
import { color, fuente, sombra } from '../lib/tema';

export default function Entrar() {
  const insets = useSafeAreaInsets();
  const [modo, setModo] = useState<'entrar' | 'registro' | 'olvido'>('entrar');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar() {
    setError('');
    setInfo('');
    const email = correo.trim().toLowerCase();
    if (!email || !clave) return setError('Escribe tu correo y tu contraseña.');
    if (modo === 'registro' && clave.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    setCargando(true);
    try {
      if (modo === 'entrar') {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password: clave });
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase.auth.signUp({ email, password: clave });
        if (e) throw e;
        if (!data.session) setInfo('Te hemos enviado un correo. Pulsa el enlace para confirmar y luego entra aquí.');
      }
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={[s.hero, { paddingTop: insets.top + 36 }]}>
          <View style={s.logo}>
            <MaterialCommunityIcons name="wrench" size={26} color="#fff" />
          </View>
          <Text style={s.titulo}>Avisaya</Text>
          <Text style={s.lema}>Averías del hotel, desde quien las ve hasta quien las arregla.</Text>
        </View>

        <View style={[s.cuerpo, { paddingBottom: insets.bottom + 24 }]}>
          {modo === 'olvido' ? (
            <Recuperar correoInicial={correo} onVolver={() => setModo('entrar')} />
          ) : (
          <View style={s.tarjeta}>
            <View style={s.pestanas} accessibilityRole="tablist">
              {(['entrar', 'registro'] as const).map((m) => (
                <Pressable
                  key={m}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: modo === m }}
                  onPress={() => {
                    setModo(m);
                    setError('');
                    setInfo('');
                  }}
                  style={[s.pestana, modo === m && s.pestanaActiva]}>
                  <Text style={[s.pestanaTexto, modo === m && { color: '#fff' }]}>{m === 'entrar' ? 'Entrar' : 'Crear cuenta'}</Text>
                </Pressable>
              ))}
            </View>
            <Campo
              etiqueta="Correo"
              value={correo}
              onChangeText={setCorreo}
              placeholder="tu@correo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <Campo
              etiqueta="Contraseña"
              value={clave}
              onChangeText={setClave}
              placeholder={modo === 'registro' ? 'Mínimo 6 caracteres' : 'Tu contraseña'}
              secureTextEntry
              autoComplete={modo === 'registro' ? 'new-password' : 'current-password'}
              textContentType={modo === 'registro' ? 'newPassword' : 'password'}
              onSubmitEditing={enviar}
            />
            <Aviso texto={error} />
            <Aviso texto={info} tono={color.ok} />
            <Boton texto={modo === 'entrar' ? 'Entrar' : 'Crear cuenta'} tipo="principal" grande onPress={enviar} cargando={cargando} />
            {modo === 'entrar' ? (
              <Pressable
                onPress={() => {
                  setError('');
                  setInfo('');
                  setModo('olvido');
                }}
                accessibilityRole="button"
                style={{ alignSelf: 'center', padding: 4 }}>
                <Text style={s.enlace}>¿Olvidaste tu contraseña?</Text>
              </Pressable>
            ) : null}
          </View>
          )}
          {modo !== 'olvido' ? (
            <Text style={s.nota}>
              {modo === 'entrar'
                ? '¿Es tu primera vez? Pulsa «Crear cuenta». Después te uniremos a tu hotel.'
                : 'Después de crear la cuenta te pediremos el código de tu hotel.'}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Recuperar la contraseña: 1) correo, 2) código del correo, 3) pantalla de contraseña nueva. */
function Recuperar({ correoInicial, onVolver }: { correoInicial: string; onVolver: () => void }) {
  const { setRecuperando } = useSesion();
  const [paso, setPaso] = useState<'correo' | 'codigo'>('correo');
  const [correo, setCorreo] = useState(correoInicial);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cargando, setCargando] = useState(false);
  const email = correo.trim().toLowerCase();

  async function pedirCodigo() {
    setError('');
    setInfo('');
    if (!email.includes('@')) return setError('Escribe el correo de tu cuenta.');
    setCargando(true);
    const { error: e } = await supabase.auth.resetPasswordForEmail(email);
    setCargando(false);
    if (e) return setError(mensajeError(e));
    setPaso('codigo');
    setCodigo('');
    setInfo(`Si ${email} tiene cuenta, te llegará un correo con un código. Mira también en «Spam».`);
  }

  async function comprobarCodigo() {
    setError('');
    if (!/^\d{6,10}$/.test(codigo.trim())) return setError('Escribe el código numérico del correo.');
    setCargando(true);
    // Se marca antes de comprobar: si el código es bueno, la app abre la pantalla de contraseña nueva
    setRecuperando(true);
    const { error: e } = await supabase.auth.verifyOtp({ email, token: codigo.trim(), type: 'recovery' });
    setCargando(false);
    if (e) {
      setRecuperando(false);
      setError(/expired|invalid/i.test(e.message) ? 'El código no es correcto o ha caducado. Pide uno nuevo.' : mensajeError(e));
    }
  }

  return (
    <View style={s.tarjeta}>
      <View style={{ gap: 4 }}>
        <Text style={s.recPaso}>PASO {paso === 'correo' ? '1' : '2'} DE 3</Text>
        <Text style={s.recTitulo}>{paso === 'correo' ? 'Recuperar contraseña' : 'Escribe el código'}</Text>
        <Text style={s.recTexto}>
          {paso === 'correo' ? 'Te enviaremos un código por correo.' : 'Cuando el código sea correcto podrás poner tu contraseña nueva.'}
        </Text>
      </View>
      {paso === 'correo' ? (
        <>
          <Campo etiqueta="Correo" value={correo} onChangeText={setCorreo} placeholder="tu@correo.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" onSubmitEditing={pedirCodigo} />
          <Aviso texto={error} />
          <Boton texto="Enviar código" icono="email-fast-outline" tipo="principal" grande onPress={pedirCodigo} cargando={cargando} />
        </>
      ) : (
        <>
          <Aviso texto={info} tono={color.ok} />
          <Campo etiqueta="Código" value={codigo} onChangeText={(t) => setCodigo(t.replace(/\D/g, ''))} placeholder="123456" keyboardType="number-pad" grande maxLength={10} textContentType="oneTimeCode" autoComplete="one-time-code" onSubmitEditing={comprobarCodigo} />
          <Aviso texto={error} />
          <Boton texto="Comprobar código" tipo="principal" grande onPress={comprobarCodigo} cargando={cargando} />
          <Pressable onPress={pedirCodigo} accessibilityRole="button" style={{ alignSelf: 'center', padding: 4 }} disabled={cargando}>
            <Text style={s.enlace}>No me ha llegado: enviar otro código</Text>
          </Pressable>
        </>
      )}
      <Pressable onPress={onVolver} accessibilityRole="button" style={{ alignSelf: 'center', padding: 4 }}>
        <Text style={[s.enlace, { color: color.apagado }]}>Volver a entrar</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  enlace: { fontFamily: fuente.textoFuerte, fontSize: 14.5, color: color.acento },
  recTitulo: { fontFamily: fuente.titulo, fontSize: 19, color: color.tinta },
  recPaso: { fontFamily: fuente.textoFuerte, fontSize: 11.5, letterSpacing: 0.9, color: color.acento },
  recTexto: { fontFamily: fuente.texto, fontSize: 14.5, color: color.apagado, lineHeight: 20 },
  hero: { backgroundColor: color.marca, paddingHorizontal: 24, paddingBottom: 30, gap: 10 },
  logo: { width: 48, height: 48, borderRadius: 14, backgroundColor: color.acento, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fuente.tituloFuerte, fontSize: 34, color: '#fff', marginTop: 4 },
  lema: { fontFamily: fuente.texto, fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 22 },
  cuerpo: { padding: 16, gap: 14 },
  tarjeta: { backgroundColor: color.superficie, borderRadius: 18, padding: 18, gap: 16, ...sombra },
  pestanas: { flexDirection: 'row', backgroundColor: color.elevado, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: color.linea },
  pestana: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  pestanaActiva: { backgroundColor: color.marca },
  pestanaTexto: { fontFamily: fuente.textoFuerte, fontSize: 14, color: color.apagado },
  nota: { fontFamily: fuente.texto, fontSize: 14, color: color.apagado, textAlign: 'center', paddingHorizontal: 12 },
});
