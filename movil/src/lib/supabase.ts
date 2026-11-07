import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !key) {
  throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_KEY en el archivo .env');
}

export const supabase = createClient(url, key, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Renueva la sesión solo mientras la app está en primer plano.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Traduce los errores más habituales a un mensaje claro. */
export function mensajeError(e: unknown): string {
  const msg = (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e)) || '';
  if (/Invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/User already registered/i.test(msg)) return 'Ya existe una cuenta con ese correo. Entra con tu contraseña.';
  if (/Password should be at least/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/Email not confirmed/i.test(msg)) return 'Confirma tu correo con el enlace que te hemos enviado.';
  if (/invalid.*email|Unable to validate email/i.test(msg)) return 'Ese correo no es válido.';
  if (/Network request failed|fetch failed/i.test(msg)) return 'Sin conexión. Revisa el WiFi o los datos.';
  if (/rate limit/i.test(msg)) return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
  return msg || 'Algo ha fallado. Vuelve a intentarlo.';
}
