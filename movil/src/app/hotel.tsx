import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aviso, Boton, Campo, Etiqueta, Opcion } from '../components/ui';
import { useSesion } from '../lib/sesion';
import { mensajeError, supabase } from '../lib/supabase';
import { color, fuente, sombra, type Rol } from '../lib/tema';

const ROLES_UNION: { rol: Exclude<Rol, 'admin'>; texto: string; icono: 'desk' | 'broom' | 'wrench' }[] = [
  { rol: 'recepcion', texto: 'Recepción', icono: 'desk' },
  { rol: 'limpieza', texto: 'Limpieza', icono: 'broom' },
  { rol: 'tecnico', texto: 'Técnico', icono: 'wrench' },
];

export default function Hotel() {
  const insets = useSafeAreaInsets();
  const { recargar, salir, session } = useSesion();
  const [modo, setModo] = useState<'unirse' | 'crear'>('unirse');
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Exclude<Rol, 'admin'> | null>(null);
  const [nombreHotel, setNombreHotel] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar() {
    setError('');
    if (!nombre.trim()) return setError('Escribe tu nombre.');
    setCargando(true);
    try {
      if (modo === 'unirse') {
        if (codigo.trim().length < 4) throw new Error('Escribe el código que te ha dado tu hotel.');
        if (!rol) throw new Error('Elige tu departamento.');
        const { error: e } = await supabase.rpc('unirse_hotel', { p_codigo: codigo.trim(), p_mi_nombre: nombre.trim(), p_rol: rol });
        if (e) throw e;
      } else {
        if (nombreHotel.trim().length < 2) throw new Error('Escribe el nombre del hotel.');
        const { error: e } = await supabase.rpc('crear_hotel', { p_nombre_hotel: nombreHotel.trim(), p_mi_nombre: nombre.trim() });
        if (e) throw e;
      }
      await recargar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={[s.hero, { paddingTop: insets.top + 28 }]}>
          <Text style={s.titulo}>Tu hotel</Text>
          <Text style={s.lema}>Únete con el código que te dé tu responsable, o crea el hotel si eres el primero.</Text>
        </View>
        <View style={[s.cuerpo, { paddingBottom: insets.bottom + 24 }]}>
          <View style={s.tarjeta}>
            <View style={s.pestanas}>
              {(['unirse', 'crear'] as const).map((m) => (
                <Pressable
                  key={m}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: modo === m }}
                  onPress={() => {
                    setModo(m);
                    setError('');
                  }}
                  style={[s.pestana, modo === m && s.pestanaActiva]}>
                  <Text style={[s.pestanaTexto, modo === m && { color: '#fff' }]}>{m === 'unirse' ? 'Tengo un código' : 'Crear hotel'}</Text>
                </Pressable>
              ))}
            </View>

            {modo === 'unirse' ? (
              <>
                <Campo etiqueta="Código del hotel" value={codigo} onChangeText={(t) => setCodigo(t.toUpperCase())} placeholder="A7F3K2" autoCapitalize="characters" autoCorrect={false} grande maxLength={10} />
                <View style={{ gap: 8 }}>
                  <Etiqueta>Trabajo en</Etiqueta>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {ROLES_UNION.map((r) => (
                      <Opcion key={r.rol} vertical activa={rol === r.rol} onPress={() => setRol(r.rol)} texto={r.texto} icono={r.icono} />
                    ))}
                  </View>
                </View>
              </>
            ) : (
              <Campo etiqueta="Nombre del hotel" value={nombreHotel} onChangeText={setNombreHotel} placeholder="Hotel Sol" maxLength={80} />
            )}

            <Campo etiqueta="Tu nombre" value={nombre} onChangeText={setNombre} placeholder="Ej. Lucía" autoComplete="given-name" maxLength={40} />
            {modo === 'crear' ? <Text style={s.nota}>Quedarás como administrador y verás el código para invitar a tu equipo.</Text> : null}
            <Aviso texto={error} />
            <Boton texto={modo === 'unirse' ? 'Unirme' : 'Crear hotel'} tipo="principal" grande onPress={enviar} cargando={cargando} />
          </View>
          <Text style={s.nota}>Has entrado como {session?.user.email}.</Text>
          <Boton texto="Cerrar sesión" tipo="fantasma" onPress={salir} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: color.marca, paddingHorizontal: 24, paddingBottom: 26, gap: 8 },
  titulo: { fontFamily: fuente.tituloFuerte, fontSize: 30, color: '#fff' },
  lema: { fontFamily: fuente.texto, fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 21 },
  cuerpo: { padding: 16, gap: 12 },
  tarjeta: { backgroundColor: color.superficie, borderRadius: 18, padding: 18, gap: 16, ...sombra },
  pestanas: { flexDirection: 'row', backgroundColor: color.elevado, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: color.linea },
  pestana: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  pestanaActiva: { backgroundColor: color.marca },
  pestanaTexto: { fontFamily: fuente.textoFuerte, fontSize: 14, color: color.apagado },
  nota: { fontFamily: fuente.texto, fontSize: 14, color: color.apagado, textAlign: 'center' },
});
