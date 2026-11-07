import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, fuente } from '../lib/tema';

export type NotificacionRef = { mostrar: (titulo: string, cuerpo: string, urgente?: boolean) => void };

/** Aviso que baja desde arriba cuando llega algo nuevo con la app abierta. */
export const Notificacion = forwardRef<NotificacionRef>(function Notificacion(_, ref) {
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-160)).current;
  const [datos, setDatos] = useState<{ titulo: string; cuerpo: string; urgente: boolean } | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  function ocultar() {
    Animated.timing(y, { toValue: -160, duration: 200, useNativeDriver: true }).start(() => setDatos(null));
  }

  useImperativeHandle(ref, () => ({
    mostrar(titulo, cuerpo, urgente = false) {
      setDatos({ titulo, cuerpo, urgente });
      y.setValue(-160);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
      Haptics.notificationAsync(urgente ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(ocultar, urgente ? 8000 : 5000);
    },
  }));

  if (!datos) return null;
  return (
    <Animated.View style={[s.capa, { top: insets.top + 8, transform: [{ translateY: y }] }]} accessibilityLiveRegion="polite">
      <Pressable onPress={ocultar} style={s.caja} accessibilityRole="alert" accessibilityHint="Pulsa para cerrar">
        <View style={[s.icono, datos.urgente && { backgroundColor: color.pendiente }]}>
          <MaterialCommunityIcons name={datos.urgente ? 'alert-circle' : 'wrench'} size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.fila}>
            <Text style={s.app}>AVISAYA</Text>
            <Text style={s.app}>AHORA</Text>
          </View>
          <Text style={[s.titulo, datos.urgente && { color: color.pendiente }]}>{datos.titulo}</Text>
          {datos.cuerpo ? (
            <Text style={s.cuerpo} numberOfLines={2}>
              {datos.cuerpo}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
});

const s = StyleSheet.create({
  capa: { position: 'absolute', left: 10, right: 10, zIndex: 50 },
  caja: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderWidth: 1,
    borderColor: color.linea,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  icono: { width: 36, height: 36, borderRadius: 10, backgroundColor: color.acento, alignItems: 'center', justifyContent: 'center' },
  fila: { flexDirection: 'row', justifyContent: 'space-between' },
  app: { fontFamily: fuente.textoFuerte, fontSize: 10.5, color: color.apagado, letterSpacing: 0.6 },
  titulo: { fontFamily: fuente.titulo, fontSize: 15, color: color.tinta, marginTop: 1 },
  cuerpo: { fontFamily: fuente.texto, fontSize: 13.5, color: color.apagado },
});
