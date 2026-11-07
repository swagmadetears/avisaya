import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { color, fuente, suave, type NombreIcono } from '../lib/tema';

type BotonProps = {
  texto: string;
  onPress: () => void;
  tipo?: 'principal' | 'camino' | 'ok' | 'normal' | 'fantasma';
  icono?: NombreIcono;
  cargando?: boolean;
  desactivado?: boolean;
  grande?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Boton({ texto, onPress, tipo = 'normal', icono, cargando, desactivado, grande, style }: BotonProps) {
  const fondo = { principal: color.acento, camino: color.camino, ok: color.ok, normal: color.superficie, fantasma: 'transparent' }[tipo];
  const tinta = tipo === 'normal' || tipo === 'fantasma' ? color.tinta : '#FFFFFF';
  const borde = tipo === 'normal' ? color.linea : fondo;
  const off = desactivado || cargando;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!cargando }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        s.boton,
        grande && s.botonGrande,
        { backgroundColor: fondo, borderColor: borde, opacity: off ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}>
      {cargando ? (
        <ActivityIndicator color={tinta} />
      ) : (
        <>
          {icono ? <MaterialCommunityIcons name={icono} size={grande ? 20 : 18} color={tinta} /> : null}
          <Text style={[s.botonTexto, grande && { fontSize: 16 }, { color: tinta }]}>{texto}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return <Text style={s.etiqueta}>{children}</Text>;
}

export function Campo(props: TextInputProps & { etiqueta: string; grande?: boolean }) {
  const { etiqueta, grande, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      <Etiqueta>{etiqueta}</Etiqueta>
      <TextInput placeholderTextColor={color.apagado} {...rest} style={[s.input, grande && s.inputGrande, style]} />
    </View>
  );
}

export function Insignia({ texto, tono }: { texto: string; tono: string }) {
  return (
    <View style={[s.insignia, { backgroundColor: suave(tono, 0.13) }]}>
      <Text style={[s.insigniaTexto, { color: tono }]}>{texto.toUpperCase()}</Text>
    </View>
  );
}

export function Aviso({ texto, tono = color.pendiente }: { texto: string; tono?: string }) {
  if (!texto) return null;
  return <Text style={[s.aviso, { color: tono }]}>{texto}</Text>;
}

export function Opcion({
  activa,
  onPress,
  texto,
  icono,
  tono = color.acento,
  vertical,
  style,
}: {
  activa: boolean;
  onPress: () => void;
  texto: string;
  icono?: NombreIcono;
  tono?: string;
  vertical?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: activa }}
      onPress={onPress}
      style={[
        s.opcion,
        vertical && s.opcionVertical,
        activa && { borderColor: tono, backgroundColor: suave(tono, 0.09) },
        style,
      ]}>
      {icono ? (
        <View style={[vertical ? s.opcionIcono : null, vertical && { backgroundColor: suave(tono, 0.15) }]}>
          <MaterialCommunityIcons name={icono} size={vertical ? 22 : 18} color={tono} />
        </View>
      ) : null}
      <Text style={[s.opcionTexto, vertical && { fontSize: 12, textAlign: 'center' }, activa && { fontFamily: fuente.textoFuerte }]} numberOfLines={2}>
        {texto}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  boton: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botonGrande: { minHeight: 54 },
  botonTexto: { fontFamily: fuente.textoFuerte, fontSize: 15 },
  etiqueta: { fontFamily: fuente.textoFuerte, fontSize: 12, color: color.apagado, letterSpacing: 0.7, textTransform: 'uppercase' },
  input: {
    fontFamily: fuente.texto,
    fontSize: 16,
    color: color.tinta,
    backgroundColor: color.elevado,
    borderWidth: 1,
    borderColor: color.linea,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputGrande: { fontFamily: fuente.numero, fontSize: 24, paddingVertical: 10 },
  insignia: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  insigniaTexto: { fontFamily: fuente.textoFuerte, fontSize: 10.5, letterSpacing: 0.6 },
  aviso: { fontFamily: fuente.textoMedio, fontSize: 14 },
  opcion: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: color.linea,
    backgroundColor: color.elevado,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  opcionVertical: { flexDirection: 'column', paddingVertical: 10, minHeight: 92 },
  opcionIcono: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  opcionTexto: { fontFamily: fuente.textoMedio, fontSize: 14, color: color.tinta },
});
