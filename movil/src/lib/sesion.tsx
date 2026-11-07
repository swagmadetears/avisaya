import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { olvidarDispositivo, registrarNotificaciones, type EstadoPush } from './notificaciones';
import { supabase } from './supabase';
import type { Hotel, Perfil } from './tema';

type Sesion = {
  cargando: boolean;
  /** true cuando el perfil corresponde ya al usuario que ha iniciado sesión */
  perfilListo: boolean;
  session: Session | null;
  perfil: Perfil | null;
  /** Hotel principal (el primero al que se unió) */
  hotel: Hotel | null;
  /** Todos los hoteles en los que trabaja (ordenados por nombre) */
  hoteles: Hotel[];
  /** Solicitudes de acceso que esperan aprobación de administración */
  solicitudes: { hotel_id: string; hotel: string }[];
  /** true mientras se recupera la contraseña: hay que poner una nueva antes de seguir */
  recuperando: boolean;
  setRecuperando: (v: boolean) => void;
  /** Si este móvil recibe avisos con la app cerrada */
  estadoPush: EstadoPush | null;
  recargar: () => Promise<void>;
  salir: () => Promise<void>;
};

const Ctx = createContext<Sesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [hoteles, setHoteles] = useState<Hotel[]>([]);
  const [solicitudes, setSolicitudes] = useState<{ hotel_id: string; hotel: string }[]>([]);
  const [recuperando, setRecuperando] = useState(false);
  const [perfilDe, setPerfilDe] = useState<string | null>(null);
  const [estadoPush, setEstadoPush] = useState<EstadoPush | null>(null);
  const tokenPush = useRef<string | undefined>(undefined);

  const cargarPerfil = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setPerfil(null);
      setHotel(null);
      setHoteles([]);
      setSolicitudes([]);
      setPerfilDe(null);
      return;
    }
    const { data: p } = await supabase.from('perfiles').select('id, hotel_id, nombre, rol, activo').eq('id', uid).maybeSingle();
    setPerfil((p as Perfil | null) ?? null);
    if (p) {
      // La seguridad de la base de datos devuelve solo los hoteles de esta persona
      const [{ data: hs }, { data: sol }] = await Promise.all([
        supabase.from('hoteles').select('id, nombre, codigo_union').order('nombre'),
        supabase.rpc('mis_solicitudes'),
      ]);
      const lista = (hs ?? []) as Hotel[];
      setSolicitudes((sol ?? []) as { hotel_id: string; hotel: string }[]);
      setHoteles(lista);
      setHotel(lista.find((h) => h.id === p.hotel_id) ?? lista[0] ?? null);
    } else {
      setHotel(null);
      setHoteles([]);
      setSolicitudes([]);
    }
    setPerfilDe(uid);
  }, []);

  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return;
      setSession(data.session);
      await cargarPerfil(data.session?.user.id);
      if (vivo) setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSession(s);
      // No se llama a Supabase dentro del callback (puede bloquearse); se hace justo después.
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') {
        setTimeout(() => {
          cargarPerfil(s?.user.id);
        }, 0);
      }
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [cargarPerfil]);

  const recargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await cargarPerfil(data.session?.user.id);
  }, [cargarPerfil]);

  // Registra el móvil para recibir avisos en cuanto la persona pertenece a un hotel
  const perfilId = perfil?.id;
  useEffect(() => {
    if (!perfilId) return;
    let vivo = true;
    registrarNotificaciones().then((r) => {
      if (!vivo) return;
      tokenPush.current = r.token;
      setEstadoPush(r.estado);
    });
    return () => {
      vivo = false;
    };
  }, [perfilId]);

  const salir = useCallback(async () => {
    await olvidarDispositivo(tokenPush.current).catch(() => {});
    tokenPush.current = undefined;
    setEstadoPush(null);
    await supabase.auth.signOut();
    setPerfil(null);
    setHotel(null);
    setHoteles([]);
    setSolicitudes([]);
    setRecuperando(false);
  }, []);

  const perfilListo = !session || perfilDe === session.user.id;
  return <Ctx.Provider value={{ cargando, perfilListo, session, perfil, hotel, hoteles, solicitudes, recuperando, setRecuperando, estadoPush, recargar, salir }}>{children}</Ctx.Provider>;
}

export function useSesion(): Sesion {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSesion fuera de SesionProvider');
  return v;
}
