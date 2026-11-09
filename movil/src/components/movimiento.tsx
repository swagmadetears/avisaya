import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { LayoutAnimation, Platform, Pressable, UIManager, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { color, movimiento } from '../lib/tema';

const PressableAnimado = Animated.createAnimatedComponent(Pressable);

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);

/** Antes de abrir o cerrar algo: el resto de la pantalla se recoloca con la curva suave de iOS, sin rebote. */
export function suavizar() {
  LayoutAnimation.configureNext(LayoutAnimation.create(260, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}

/** Un toque ligero en iOS (en Android la vibración de sistema ya es suficiente). */
export function toque(tipo: 'ligero' | 'medio' | 'seleccion' | 'exito' | 'aviso' = 'ligero') {
  if (process.env.EXPO_OS !== 'ios') return;
  if (tipo === 'seleccion') Haptics.selectionAsync().catch(() => {});
  else if (tipo === 'exito') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else if (tipo === 'aviso') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  else Haptics.impactAsync(tipo === 'medio' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

type PulsableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((s: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** Cuánto se encoge al pulsar (1 = nada). */
  encoge?: number;
  /** Vibración al pulsar (solo iOS). */
  vibra?: Parameters<typeof toque>[0] | false;
};

/** Botón que se hunde un poco al pulsarlo y vuelve con un resorte, como en iOS. */
export function Pulsable({ style, encoge = 0.97, vibra = 'ligero', onPressIn, onPressOut, onPress, disabled, ...rest }: PulsableProps) {
  const escala = useSharedValue(1);
  const reducido = useReducedMotion();
  // Reanimated no acepta estilos en forma de función: se resuelven aquí con el estado de pulsado
  const [pulsado, setPulsado] = useState(false);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: escala.get() }] }));
  const base = typeof style === 'function' ? style({ pressed: pulsado }) : style;
  return (
    <PressableAnimado
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        setPulsado(true);
        if (!reducido) escala.set(withSpring(encoge, movimiento.resorte));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPulsado(false);
        escala.set(withSpring(1, movimiento.resorte));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (vibra) toque(vibra);
        onPress?.(e);
      }}
      style={[base, anim]}
    />
  );
}

/** Curva de iOS: arranca rápido y frena suave, sin rebotes. */
export const curvaApple = Easing.bezier(0.25, 0.1, 0.25, 1);
export const transicion = LinearTransition.duration(280).easing(curvaApple);

/** Aparece con un fundido y un desplazamiento corto, sin rebote; `orden` escalona las filas de una lista.
    Solo anima opacidad y posición (no la maquetación), así nunca descoloca a sus vecinos. */
export function Entra({ children, orden = 0, style }: { children: ReactNode; orden?: number; style?: StyleProp<ViewStyle> }) {
  const reducido = useReducedMotion();
  const p = useSharedValue(reducido ? 1 : 0);
  useEffect(() => {
    if (reducido) return;
    p.set(withDelay(Math.min(orden, 8) * 35, withTiming(1, { duration: 320, easing: curvaApple })));
  }, [p, orden, reducido]);
  const anim = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ translateY: (1 - p.get()) * 8 }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** Bloque gris que «respira» mientras carga (en lugar de una ruedecita). */
export function Esqueleto({ alto = 16, ancho = '100%', radio = 8, style }: { alto?: number; ancho?: number | `${number}%`; radio?: number; style?: StyleProp<ViewStyle> }) {
  const op = useSharedValue(0.45);
  const reducido = useReducedMotion();
  useEffect(() => {
    if (reducido) return;
    op.set(withRepeat(withSequence(withTiming(0.9, { duration: 750, easing: Easing.inOut(Easing.quad) }), withTiming(0.45, { duration: 750, easing: Easing.inOut(Easing.quad) })), -1));
  }, [op, reducido]);
  const anim = useAnimatedStyle(() => ({ opacity: op.get() }));
  return <Animated.View style={[{ height: alto, width: ancho, borderRadius: radio, backgroundColor: color.elevado, borderCurve: 'continuous' }, anim, style]} />;
}

/** La silueta de una tarjeta de parte, para la carga inicial. */
export function TarjetaEsqueleto() {
  return (
    <View style={{ backgroundColor: color.superficie, borderRadius: 20, borderCurve: 'continuous', padding: 14, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Esqueleto alto={54} ancho={54} radio={14} />
        <View style={{ flex: 1, gap: 8 }}>
          <Esqueleto alto={16} ancho="55%" />
          <Esqueleto alto={12} ancho="35%" />
        </View>
      </View>
      <Esqueleto alto={12} ancho="85%" />
      <Esqueleto alto={6} radio={3} />
    </View>
  );
}

export { Animated, FadeInDown, LinearTransition };
