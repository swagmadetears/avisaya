import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aviso, Boton, Campo, Etiqueta, Opcion } from '../components/ui';
import { CAMPOS, subirFoto } from '../lib/partes';
import { useSesion } from '../lib/sesion';
import { mensajeError, supabase } from '../lib/supabase';
import { CATEGORIAS, color, esHabitacion, ESTADOS, fuente, hace, suave, type Parte, type Prioridad } from '../lib/tema';

/** Reduce la foto a 1400 px como máximo para que suba rápido. */
async function reducir(uri: string): Promise<string> {
  const imagen = await ImageManipulator.manipulate(uri).resize({ width: 1400 }).renderAsync();
  const r = await imagen.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return r.uri;
}

export default function Nuevo() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil, hotel, hoteles } = useSesion();
  const params = useLocalSearchParams<{ hotel?: string }>();
  // Hotel del aviso: el elegido en la pantalla principal o el principal de la persona
  const [hotelElegido, setHotelId] = useState(() => (params.hotel && hoteles.some((h) => h.id === params.hotel) ? params.hotel : ''));
  // Si la sesión aún no había cargado al abrir, se usa el hotel principal en cuanto llega
  const hotelId = hotelElegido || (params.hotel && hoteles.some((h) => h.id === params.hotel) ? params.hotel : (hotel?.id ?? ''));
  const [habitacion, setHabitacion] = useState('');
  const [cat, setCat] = useState(CATEGORIAS[0].nombre);
  const [desc, setDesc] = useState('');
  const [prio, setPrio] = useState<Prioridad>('normal');
  const [bloquea, setBloquea] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Partes abiertos en el mismo sitio: para no abrir dos veces la misma avería
  const [existentes, setExistentes] = useState<{ clave: string; partes: Parte[] }>({ clave: '', partes: [] });
  const sitio = habitacion.trim();
  const claveSitio = `${hotelId}|${sitio.toLowerCase()}`;
  useEffect(() => {
    if (!hotelId || !sitio) return;
    let vivo = true;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('partes')
        .select(CAMPOS)
        .eq('hotel_id', hotelId)
        .neq('estado', 'resuelto')
        .ilike('habitacion', sitio.replace(/[%_]/g, ''))
        .order('creado_en', { ascending: false })
        .limit(5);
      if (vivo) setExistentes({ clave: claveSitio, partes: (data ?? []) as Parte[] });
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [hotelId, sitio, claveSitio]);
  const abiertos = sitio && existentes.clave === claveSitio ? existentes.partes : [];
  const mismaAveria = abiertos.filter((p) => p.categoria === cat);

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

  function enviar() {
    setError('');
    if (!perfil || !hotelId) return setError('Elige el hotel.');
    if (!habitacion.trim()) return setError('Escribe la habitación o la zona.');
    if (!desc.trim() && !foto) return setError('Cuenta qué pasa o añade una foto.');
    if (mismaAveria.length) {
      const p = mismaAveria[0];
      Alert.alert(
        'Ya hay un parte abierto',
        `${esHabitacion(p.habitacion) ? 'Hab. ' : ''}${p.habitacion} · ${p.categoria}: «${ESTADOS[p.estado].texto}», ${hace(p.creado_en)}.${p.descripcion ? `\n\n${p.descripcion}` : ''}\n\n¿Quieres abrir otro igualmente?`,
        [
          { text: 'Ver el que hay', onPress: () => router.replace(`/parte/${p.id}`) },
          { text: 'Crear otro', style: 'destructive', onPress: crear },
          { text: 'Cancelar', style: 'cancel' },
        ],
      );
      return;
    }
    crear();
  }

  async function crear() {
    if (!perfil || !hotelId) return;
    setEnviando(true);
    try {
      let foto_path: string | null = null;
      if (foto) foto_path = await subirFoto(hotelId, foto);
      const { error: e } = await supabase.from('partes').insert({
        hotel_id: hotelId,
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
  const nombreHotel = hoteles.find((h) => h.id === hotelId)?.nombre ?? '';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.fondo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.barra, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.ceja}>{esLimpieza ? 'AVISAR DE UNA AVERÍA' : 'NUEVO PARTE'}</Text>
          <Text style={s.titulo}>{esLimpieza ? '¿Has visto algo roto?' : '¿Qué hay que arreglar?'}</Text>
          {/* Siempre a la vista: en qué hotel se crea el parte */}
          <View style={s.enHotel} accessibilityLabel={`Hotel del aviso: ${nombreHotel}`}>
            <MaterialCommunityIcons name="office-building-outline" size={15} color={color.marca2} />
            <Text style={s.enHotelTexto} numberOfLines={1}>
              {nombreHotel || 'Elige el hotel'}
            </Text>
          </View>
        </View>
        <Pressable onPress={() => router.back()} style={s.cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
          <MaterialCommunityIcons name="close" size={22} color={color.tinta} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        {hoteles.length > 1 ? (
          <View style={{ gap: 8 }}>
            <Etiqueta>¿En qué hotel es la avería?</Etiqueta>
            <View style={s.hotelesFila}>
              {hoteles.map((h) => (
                <Opcion key={h.id} activa={hotelId === h.id} onPress={() => setHotelId(h.id)} texto={h.nombre} icono="office-building-outline" tono={color.marca2} style={{ flexBasis: '47%', flexGrow: 1 }} />
              ))}
            </View>
          </View>
        ) : null}

        <Campo etiqueta="Habitación o zona" value={habitacion} onChangeText={setHabitacion} placeholder="214" grande autoCorrect={false} maxLength={30} />

        {abiertos.length ? (
          <Animated.View entering={FadeInDown.springify().damping(18)} exiting={FadeOut.duration(200)} style={s.yaHay}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="alert-circle" size={20} color={color.curso} />
              <Text style={s.yaHayTitulo}>
                {abiertos.length === 1 ? 'Ya hay un parte abierto aquí' : `Ya hay ${abiertos.length} partes abiertos aquí`}
              </Text>
            </View>
            {abiertos.map((p) => (
              <Pressable key={p.id} onPress={() => router.replace(`/parte/${p.id}`)} style={s.yaHayFila} accessibilityRole="button" accessibilityLabel={`Ver el parte de ${p.categoria}`}>
                <View style={{ flex: 1 }}>
                  <Text style={s.yaHayCat}>
                    {p.categoria}
                    {p.categoria === cat ? ' · la misma avería' : ''}
                  </Text>
                  <Text style={s.yaHaySub} numberOfLines={1}>
                    {ESTADOS[p.estado].texto} · {hace(p.creado_en)}
                    {p.descripcion ? ` · ${p.descripcion}` : ''}
                  </Text>
                </View>
                <Text style={s.yaHayVer}>Ver</Text>
              </Pressable>
            ))}
          </Animated.View>
        ) : null}

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
        <Boton texto={foto && enviando ? 'Subiendo foto…' : hoteles.length > 1 && nombreHotel ? `Enviar a ${nombreHotel}` : 'Enviar a mantenimiento'} icono="send" tipo="principal" grande onPress={enviar} cargando={enviando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  yaHay: { gap: 8, padding: 14, borderRadius: 16, borderCurve: 'continuous', backgroundColor: suave(color.curso, 0.12), borderWidth: 1, borderColor: suave(color.curso, 0.4) },
  yaHayTitulo: { flex: 1, fontFamily: fuente.textoFuerte, fontSize: 15, color: color.tinta },
  yaHayFila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: suave(color.curso, 0.35) },
  yaHayCat: { fontFamily: fuente.textoFuerte, fontSize: 14.5, color: color.tinta },
  yaHaySub: { fontFamily: fuente.texto, fontSize: 13, color: color.apagado },
  yaHayVer: { fontFamily: fuente.textoFuerte, fontSize: 14, color: color.curso },
  barra: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: color.superficie, borderBottomWidth: 1, borderBottomColor: color.linea },
  ceja: { fontFamily: fuente.textoFuerte, fontSize: 11.5, letterSpacing: 0.9, color: color.acento },
  titulo: { fontFamily: fuente.titulo, fontSize: 21, color: color.tinta },
  enHotel: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 6, backgroundColor: suave(color.marca2, 0.1), borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, maxWidth: '100%' },
  enHotelTexto: { fontFamily: fuente.textoFuerte, fontSize: 13, color: color.marca2, flexShrink: 1 },
  cerrar: { width: 42, height: 42, borderRadius: 12, backgroundColor: color.elevado, alignItems: 'center', justifyContent: 'center' },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  hotelesFila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  celda: { width: '33.333%', padding: 4 },
  foto: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: color.elevado },
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.superficie, borderWidth: 1, borderColor: color.linea, borderRadius: 14, padding: 14 },
  interruptorTexto: { flex: 1, fontFamily: fuente.textoMedio, fontSize: 15, color: color.tinta },
});
