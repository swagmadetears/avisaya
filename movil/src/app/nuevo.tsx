import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aviso, Boton, Campo, Etiqueta, Opcion } from '../components/ui';
import { subirFoto } from '../lib/partes';
import { useSesion } from '../lib/sesion';
import { mensajeError, supabase } from '../lib/supabase';
import { CATEGORIAS, color, fuente, type Prioridad } from '../lib/tema';

/** Reduce la foto a 1400 px como máximo para que suba rápido. */
async function reducir(uri: string): Promise<string> {
  const imagen = await ImageManipulator.manipulate(uri).resize({ width: 1400 }).renderAsync();
  const r = await imagen.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return r.uri;
}

export default function Nuevo() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil, hotel } = useSesion();
  const [habitacion, setHabitacion] = useState('');
  const [cat, setCat] = useState(CATEGORIAS[0].nombre);
  const [desc, setDesc] = useState('');
  const [prio, setPrio] = useState<Prioridad>('normal');
  const [bloquea, setBloquea] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function elegirFoto(origen: 'camara' | 'galeria') {
    setError('');
    try {
      if (origen === 'camara') {
        const permiso = await ImagePicker.requestCameraPermissionsAsync();
        if (!permiso.granted) return setError('Sin permiso para usar la cámara. Actívalo en los ajustes del móvil.');
      }
      const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false };
      const r = origen === 'camara' ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
      if (r.canceled || !r.assets?.length) return;
      setFoto(await reducir(r.assets[0].uri));
    } catch (e) {
      setError('No se ha podido usar la foto: ' + mensajeError(e));
    }
  }

  async function enviar() {
    setError('');
    if (!perfil || !hotel) return;
    if (!habitacion.trim()) return setError('Escribe la habitación o la zona.');
    if (!desc.trim() && !foto) return setError('Cuenta qué pasa o añade una foto.');
    setEnviando(true);
    try {
      let foto_path: string | null = null;
      if (foto) foto_path = await subirFoto(hotel.id, foto);
      const { error: e } = await supabase.from('partes').insert({
        hotel_id: hotel.id,
        habitacion: habitacion.trim().slice(0, 30),
        categoria: cat,
        descripcion: desc.trim().slice(0, 600),
        prioridad: prio,
        bloquea,
        foto_path,
      });
      if (e) throw e;
      router.back();
    } catch (e) {
      setError('No se ha enviado: ' + mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  const esLimpieza = perfil?.rol === 'limpieza';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.fondo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.barra, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.ceja}>{esLimpieza ? 'AVISAR DE UNA AVERÍA' : 'NUEVO PARTE'}</Text>
          <Text style={s.titulo}>{esLimpieza ? '¿Has visto algo roto?' : '¿Qué hay que arreglar?'}</Text>
        </View>
        <Pressable onPress={() => router.back()} style={s.cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
          <MaterialCommunityIcons name="close" size={22} color={color.tinta} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <Campo etiqueta="Habitación o zona" value={habitacion} onChangeText={setHabitacion} placeholder="214" grande autoCorrect={false} maxLength={30} />

        <View style={{ gap: 8 }}>
          <Etiqueta>Tipo de avería</Etiqueta>
          <View style={s.rejilla}>
            {CATEGORIAS.map((c) => (
              <View key={c.nombre} style={s.celda}>
                <Opcion vertical activa={cat === c.nombre} onPress={() => setCat(c.nombre)} texto={c.nombre} icono={c.icono} tono={c.color} />
              </View>
            ))}
          </View>
        </View>

        <Campo etiqueta="Qué pasa" value={desc} onChangeText={setDesc} placeholder="Ej. El aire no enfría" multiline maxLength={600} style={{ minHeight: 84, textAlignVertical: 'top' }} />

        <View style={{ gap: 8 }}>
          <Etiqueta>Foto</Etiqueta>
          {foto ? (
            <View style={{ gap: 8 }}>
              <Image source={{ uri: foto }} style={s.foto} contentFit="cover" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Boton texto="Cambiar" icono="camera" onPress={() => elegirFoto('camara')} style={{ flex: 1 }} />
                <Boton texto="Quitar" tipo="fantasma" onPress={() => setFoto(null)} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Boton texto="Hacer foto" icono="camera" onPress={() => elegirFoto('camara')} style={{ flex: 1 }} />
              <Boton texto="Galería" icono="image-outline" onPress={() => elegirFoto('galeria')} style={{ flex: 1 }} />
            </View>
          )}
        </View>

        <View style={{ gap: 8 }}>
          <Etiqueta>Prioridad</Etiqueta>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Opcion activa={prio === 'urgente'} onPress={() => setPrio('urgente')} texto="Urgente" icono="alert-circle-outline" tono={color.pendiente} />
            <Opcion activa={prio === 'normal'} onPress={() => setPrio('normal')} texto="Normal" />
            <Opcion activa={prio === 'baja'} onPress={() => setPrio('baja')} texto="Sin prisa" />
          </View>
        </View>

        <Pressable style={s.interruptor} onPress={() => setBloquea((b) => !b)} accessibilityRole="switch" accessibilityState={{ checked: bloquea }}>
          <Text style={s.interruptorTexto}>No se puede vender la habitación hasta que se arregle</Text>
          <Switch value={bloquea} onValueChange={setBloquea} trackColor={{ true: color.pendiente, false: color.linea }} />
        </Pressable>

        <Aviso texto={error} />
        <Boton texto={foto && enviando ? 'Subiendo foto…' : 'Enviar a mantenimiento'} icono="send" tipo="principal" grande onPress={enviar} cargando={enviando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  barra: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: color.superficie, borderBottomWidth: 1, borderBottomColor: color.linea },
  ceja: { fontFamily: fuente.textoFuerte, fontSize: 11.5, letterSpacing: 0.9, color: color.acento },
  titulo: { fontFamily: fuente.titulo, fontSize: 21, color: color.tinta },
  cerrar: { width: 42, height: 42, borderRadius: 12, backgroundColor: color.elevado, alignItems: 'center', justifyContent: 'center' },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  celda: { width: '33.333%', padding: 4 },
  foto: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: color.elevado },
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.superficie, borderWidth: 1, borderColor: color.linea, borderRadius: 14, padding: 14 },
  interruptorTexto: { flex: 1, fontFamily: fuente.textoMedio, fontSize: 15, color: color.tinta },
});
