import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type NombreIcono = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const color = {
  fondo: '#EEF3F1',
  superficie: '#FFFFFF',
  elevado: '#F5F8F7',
  tinta: '#0F1F1C',
  apagado: '#5A6B66',
  linea: '#D6E0DC',
  marca: '#0B3D37',
  marca2: '#13574E',
  sobreMarca: '#FFFFFF',
  acento: '#E4561B',
  sobreAcento: '#FFFFFF',
  pendiente: '#CF3A28',
  camino: '#2462C8',
  curso: '#B46A00',
  espera: '#6B4FC4',
  ok: '#13894E',
};

/** Color con transparencia, para fondos suaves de iconos y etiquetas. */
export function suave(hex: string, alpha = 0.14): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export const fuente = {
  titulo: 'Sora_700Bold',
  tituloFuerte: 'Sora_800ExtraBold',
  texto: 'Figtree_400Regular',
  textoMedio: 'Figtree_600SemiBold',
  textoFuerte: 'Figtree_700Bold',
  numero: 'IBMPlexMono_600SemiBold',
};

export const sombra = {
  shadowColor: '#0F1F1C',
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

export type Rol = 'admin' | 'recepcion' | 'limpieza' | 'tecnico';
export type Estado = 'pendiente' | 'en_camino' | 'en_curso' | 'esperando' | 'resuelto';
export type Prioridad = 'urgente' | 'normal' | 'baja';

export const ROLES: Record<Rol, string> = {
  admin: 'Administración',
  recepcion: 'Recepción',
  limpieza: 'Limpieza',
  tecnico: 'Técnico',
};

export const CATEGORIAS: { nombre: string; icono: NombreIcono; color: string }[] = [
  { nombre: 'Fontanería', icono: 'water', color: '#1F7AE0' },
  { nombre: 'Electricidad', icono: 'lightning-bolt', color: '#D99A00' },
  { nombre: 'Climatización', icono: 'snowflake', color: '#0AA3B5' },
  { nombre: 'TV / WiFi', icono: 'television', color: '#7A52D6' },
  { nombre: 'Cerraduras', icono: 'lock', color: '#4E6470' },
  { nombre: 'Mobiliario', icono: 'sofa', color: '#A2622D' },
  { nombre: 'Otro', icono: 'alert-circle-outline', color: '#6B7A76' },
];
export const categoria = (n: string) => CATEGORIAS.find((c) => c.nombre === n) ?? CATEGORIAS[CATEGORIAS.length - 1];

export const ESTADOS: Record<Estado, { texto: string; color: string }> = {
  pendiente: { texto: 'Avisado', color: color.pendiente },
  en_camino: { texto: 'Técnico de camino', color: color.camino },
  en_curso: { texto: 'Reparando', color: color.curso },
  esperando: { texto: 'Falta una pieza', color: color.espera },
  resuelto: { texto: 'Resuelto', color: color.ok },
};

export type Hotel = { id: string; nombre: string; codigo_union: string };
export type Perfil = { id: string; hotel_id: string; nombre: string; rol: Rol; activo: boolean };
export type Parte = {
  id: string;
  hotel_id: string;
  habitacion: string;
  categoria: string;
  descripcion: string;
  prioridad: Prioridad;
  bloquea: boolean;
  estado: Estado;
  tecnico_id: string | null;
  creado_por: string | null;
  foto_path: string | null;
  nota_resolucion: string;
  creado_en: string;
  actualizado_en: string;
  cambio_estado_en: string;
  resuelto_en: string | null;
};

// ---------- tiempos ----------
const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
export const minutosDesde = (iso: string | null) => Math.max(0, Math.round((Date.now() - ms(iso)) / 60000));
export function hace(iso: string | null): string {
  if (!iso) return '';
  const m = minutosDesde(iso);
  if (m < 1) return 'ahora mismo';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}
export function duracion(iso: string | null): string {
  const m = minutosDesde(iso);
  if (m < 1) return 'menos de 1 min';
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
export const esHoy = (iso: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString();
export const esHabitacion = (h: string) => /^\d{1,5}[a-zA-Z]?$/.test(h.trim());

/** Texto en minúsculas y sin tildes, para buscar «fontaneria» y encontrar «Fontanería». */
export const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
