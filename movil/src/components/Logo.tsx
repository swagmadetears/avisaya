import { Image } from 'expo-image';

/** El logo de Avisaya: la A con su punto de aviso. */
export function Logo({ tamano = 32 }: { tamano?: number }) {
  return <Image source={require('../../assets/logo.png')} style={{ width: tamano, height: tamano, borderRadius: tamano * 0.225 }} contentFit="contain" accessibilityLabel="Avisaya" />;
}
