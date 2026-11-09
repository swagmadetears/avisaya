import type { Estado, Rol } from './tema';

/** Una entrada del registro de eliminados (tabla archivo). */
export type Entrada = {
  id: number;
  tipo: 'parte' | 'aviso';
  hotel_id: string | null;
  resumen: string;
  borrado_por_nombre: string | null;
  borrado_en: string;
  datos: {
    parte?: { descripcion?: string; estado?: Estado; creado_en?: string; resuelto_en?: string | null; nota_resolucion?: string; prioridad?: string };
    creado_por?: string | null;
    tecnico?: string | null;
    eventos?: { tipo: string; estado: Estado | null; quien: string | null; en: string }[];
    chat?: { quien: string | null; rol: Rol | null; texto: string; en: string }[];
    aviso?: { texto?: string; lugar?: string; creado_en?: string; activo?: boolean; cerrado_en?: string | null };
    autor?: string | null;
  };
};

export const CAMPOS_REGISTRO = 'id, tipo, hotel_id, resumen, borrado_por_nombre, borrado_en, datos';

/** ¿Estaba resuelto cuando se eliminó? (un parte resuelto, o un aviso ya cerrado) */
export const estabaResuelto = (e: Entrada) => (e.tipo === 'parte' ? e.datos.parte?.estado === 'resuelto' : e.datos.aviso?.activo === false);

export const fechaRegistro = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
