import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/** Canal de Android para los partes (sonido y vibración a tope). */
export const CANAL_PARTES = 'partes';

// Con la app abierta ya mostramos nuestro propio aviso, así que no se duplica.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type EstadoPush =
  | 'activo'
  | 'sin-permiso'
  | 'expo-go' // Expo Go no recibe notificaciones remotas: hace falta la versión de desarrollo
  | 'no-disponible'
  | 'error';

/**
 * Pide permiso, obtiene el token del móvil y lo guarda en Supabase
 * para que la base de datos pueda enviarle avisos.
 */
export async function registrarNotificaciones(): Promise<{ estado: EstadoPush; token?: string }> {
  if (Platform.OS === 'web' || !Device.isDevice) return { estado: 'no-disponible' };
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return { estado: 'expo-go' };
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL_PARTES, {
        name: 'Partes de mantenimiento',
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 250, 150, 250],
        lightColor: '#E4561B',
        sound: 'default',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return { estado: 'sin-permiso' };

    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return { estado: 'no-disponible' };

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('registrar_dispositivo', { p_token: token, p_plataforma: Platform.OS });
    if (error) return { estado: 'error' };
    return { estado: 'activo', token };
  } catch {
    return { estado: 'error' };
  }
}

/** Al cerrar sesión, este móvil deja de recibir avisos de esa cuenta. */
export async function olvidarDispositivo(token: string | undefined) {
  if (!token) return;
  await supabase.rpc('borrar_dispositivo', { p_token: token });
}
