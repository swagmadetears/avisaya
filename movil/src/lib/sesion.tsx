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
  hotel: Hotel | null;
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
  const [perfilDe, setPerfilDe] = useState<string | null>(null);
  const [estadoPush, setEstadoPush] = useState<EstadoPush | null>(null);
  const tokenPush = useRef<string | undefined>(undefined);

  const cargarPerfil = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setPerfil(null);
      setHotel(null);
      setPerfilDe(null);
      return;
    }
    const { data: p } = await supabase.from('perfiles').select('id, hotel_id, nombre, rol, activo').eq('id', uid).maybeSingle();
    setPerfil((p as Perfil | null) ?? null);
    if (p) {
      const { data: h } = await supabase.from('hoteles').select('id, nombre, codigo_union').eq('id', p.hotel_id).maybeSingle();
      setHotel((h as Hotel | null) ?? null);
    } else {
      setHotel(null);
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
  }, []);

  const perfilListo = !session || perfilDe === session.user.id;
  return <Ctx.Provider value={{ cargando, perfilListo, session, perfil, hotel, estadoPush, recargar, salir }}>{children}</Ctx.Provider>;
}

export function useSesion(): Sesion {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSesion fuera de SesionProvider');
  return v;
}
