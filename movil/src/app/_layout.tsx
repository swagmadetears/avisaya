import { Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import { Sora_700Bold, Sora_800ExtraBold, useFonts } from '@expo-google-fonts/sora';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SesionProvider, useSesion } from '../lib/sesion';
import { color } from '../lib/tema';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Lleva a cada persona a la pantalla que le toca según su sesión y su hotel. */
function Guardian() {
  const { cargando, perfilListo, session, perfil, hoteles, solicitudes, recuperando } = useSesion();
  const segmentos = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;
    const actual = segmentos[0] ?? '';
    // Recuperando la contraseña: primero hay que poner la nueva
    if (session && recuperando) {
      if (actual !== 'nueva-clave') router.replace('/nueva-clave');
      return;
    }
    if (!perfilListo) return;
    const destino = !session
      ? 'entrar'
      : !perfil
        ? 'hotel'
        : !perfil.activo
          ? 'desactivada'
          : !hoteles.length
            ? solicitudes.length
              ? 'pendiente'
              : 'hotel'
            : null;
    const deEntrada = ['entrar', 'hotel', 'desactivada', 'pendiente', 'nueva-clave', ''];
    if (destino && actual !== destino) router.replace(`/${destino}`);
    else if (!destino && deEntrada.includes(actual)) router.replace('/inicio');
  }, [cargando, perfilListo, session, perfil, hoteles.length, solicitudes.length, recuperando, segmentos, router]);

  return null;
}

export default function Layout() {
  const [fuentes] = useFonts({
    Sora_700Bold,
    Sora_800ExtraBold,
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
    IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    if (fuentes) SplashScreen.hideAsync().catch(() => {});
  }, [fuentes]);

  if (!fuentes) return null;

  return (
    <SafeAreaProvider>
      <SesionProvider>
        <StatusBar style="light" />
        <Guardian />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.fondo } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="entrar" />
          <Stack.Screen name="hotel" />
          <Stack.Screen name="inicio" />
          <Stack.Screen name="parte/[id]" />
          <Stack.Screen name="nuevo" options={{ presentation: 'modal' }} />
          <Stack.Screen name="ajustes" options={{ presentation: 'modal' }} />
          <Stack.Screen name="equipo" />
          <Stack.Screen name="desactivada" />
          <Stack.Screen name="pendiente" />
          <Stack.Screen name="nueva-clave" />
        </Stack>
      </SesionProvider>
    </SafeAreaProvider>
  );
}
