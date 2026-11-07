export type TipoRango = 'todas' | 'hoy' | 'ayer' | '7d' | '30d' | 'rango';
export type Rango = { tipo: TipoRango; desde?: Date; hasta?: Date };

export const SIN_FECHA: Rango = { tipo: 'todas' };

const inicioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Límites del rango en hora local: desde (incluido) y hasta (sin incluir). */
export function limites(r: Rango): { desde: Date | null; hasta: Date | null } {
  const hoy = inicioDia(new Date());
  switch (r.tipo) {
    case 'hoy':
      return { desde: hoy, hasta: sumarDias(hoy, 1) };
    case 'ayer':
      return { desde: sumarDias(hoy, -1), hasta: hoy };
    case '7d':
      return { desde: sumarDias(hoy, -6), hasta: sumarDias(hoy, 1) };
    case '30d':
      return { desde: sumarDias(hoy, -29), hasta: sumarDias(hoy, 1) };
    case 'rango':
      return {
        desde: r.desde ? inicioDia(r.desde) : null,
        hasta: r.hasta ? sumarDias(inicioDia(r.hasta), 1) : null,
      };
    default:
      return { desde: null, hasta: null };
  }
}

export function dentroDe(iso: string, r: Rango): boolean {
  const { desde, hasta } = limites(r);
  const t = new Date(iso).getTime();
  return (!desde || t >= desde.getTime()) && (!hasta || t < hasta.getTime());
}

export const fechaCorta = (d: Date) => d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });

export function textoRango(r: Rango): string {
  switch (r.tipo) {
    case 'hoy':
      return 'hoy';
    case 'ayer':
      return 'ayer';
    case '7d':
      return 'los últimos 7 días';
    case '30d':
      return 'los últimos 30 días';
    case 'rango':
      if (r.desde && r.hasta) return `del ${fechaCorta(r.desde)} al ${fechaCorta(r.hasta)}`;
      if (r.desde) return `desde el ${fechaCorta(r.desde)}`;
      if (r.hasta) return `hasta el ${fechaCorta(r.hasta)}`;
      return 'cualquier fecha';
    default:
      return 'cualquier fecha';
  }
}
