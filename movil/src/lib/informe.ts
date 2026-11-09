import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabase';
import { ESTADOS, esHabitacion, ROLES, type Estado, type Hotel, type Parte, type Perfil } from './tema';

export type Evento = { id: number; tipo: 'creado' | 'estado' | 'reasignado'; estado: Estado | null; actor_id: string | null; creado_en: string };

/** Historial del parte (lo rellena la base de datos automáticamente). */
export async function cargarEventos(parteId: string): Promise<Evento[]> {
  const { data } = await supabase.from('parte_eventos').select('id, tipo, estado, actor_id, creado_en').eq('parte_id', parteId).order('creado_en', { ascending: true });
  return (data ?? []) as Evento[];
}

export const codigoParte = (p: Parte) => 'PT-' + p.id.slice(0, 8).toUpperCase();

export function textoEvento(e: Evento, perfiles: Record<string, Perfil>): string {
  const quien = e.actor_id ? perfiles[e.actor_id]?.nombre ?? 'Alguien' : 'Alguien';
  if (e.tipo === 'creado') return `${quien} abre el parte`;
  if (e.tipo === 'reasignado') return `${quien} se queda el parte`;
  switch (e.estado) {
    case 'en_camino':
      return `${quien} va de camino`;
    case 'en_curso':
      return `${quien} empieza la reparación`;
    case 'esperando':
      return `${quien}: falta una pieza`;
    case 'resuelto':
      return `${quien} lo marca resuelto`;
    case 'pendiente':
      return `${quien} lo devuelve a pendiente`;
    default:
      return quien;
  }
}

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export function minutosEntre(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}
export const textoMinutos = (m: number | null) => (m === null ? '—' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);

/** Tiempos clave del parte a partir del historial. */
export function tiempos(p: Parte, eventos: Evento[]) {
  const primero = (estado: Estado) => eventos.find((e) => e.estado === estado && e.tipo === 'estado')?.creado_en;
  return {
    respuesta: minutosEntre(p.creado_en, primero('en_camino') ?? primero('en_curso')),
    reparacion: minutosEntre(primero('en_curso'), p.resuelto_en),
    total: minutosEntre(p.creado_en, p.resuelto_en),
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

async function aBase64(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((ok) => {
      const r = new FileReader();
      r.onloadend = () => ok(typeof r.result === 'string' ? r.result : null);
      r.onerror = () => ok(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export type LineaChat = { autor_id: string; texto: string; creado_en: string };

/** Mensajes de una conversación, en orden y con quién y cuándo: para que quede constancia. */
function htmlChat(mensajes: LineaChat[], perfiles: Record<string, Perfil>): string {
  if (!mensajes.length) return '<p class="sub">Sin mensajes.</p>';
  return `<table class="chat">${mensajes
    .map((m) => {
      const a = perfiles[m.autor_id];
      return `<tr><td class="cuando">${esc(fecha(m.creado_en))}</td><td class="quien">${esc(a ? `${a.nombre} (${ROLES[a.rol]})` : 'Usuario')}</td><td>${esc(m.texto)}</td></tr>`;
    })
    .join('')}</table>`;
}

export function htmlInforme(p: Parte, hotel: Hotel, perfiles: Record<string, Perfil>, eventos: Evento[], foto: string | null, chat: LineaChat[] = []): string {
  const creador = p.creado_por ? perfiles[p.creado_por] : undefined;
  const tecnico = p.tecnico_id ? perfiles[p.tecnico_id] : undefined;
  const t = tiempos(p, eventos);
  const est = ESTADOS[p.estado];
  const donde = (esHabitacion(p.habitacion) ? 'Habitación ' : '') + p.habitacion;
  const prioridad = { urgente: 'Urgente', normal: 'Normal', baja: 'Sin prisa' }[p.prioridad];
  const fila = (k: string, v: string) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; color: #0F1F1C; font-size: 11pt; margin: 0; }
    .cab { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #0B3D37; padding-bottom: 10px; }
    .marca { font-size: 20pt; font-weight: 800; color: #0B3D37; letter-spacing: -0.5px; }
    .marca span { color: #E4561B; }
    .cab .der { text-align: right; font-size: 9.5pt; color: #5A6B66; }
    .cab .der b { display: block; font-size: 12pt; color: #0F1F1C; font-family: Menlo, 'Courier New', monospace; }
    h1 { font-size: 17pt; margin: 18px 0 4px; }
    .sub { color: #5A6B66; margin: 0 0 12px; }
    .estado { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: ${est.color}; border: 1.5px solid ${est.color}; }
    .urg { color: #CF3A28; border-color: #CF3A28; margin-left: 6px; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0; }
    th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #D6E0DC; vertical-align: top; }
    th { width: 34%; color: #5A6B66; font-weight: 600; }
    h2 { font-size: 12pt; margin: 20px 0 6px; color: #0B3D37; text-transform: uppercase; letter-spacing: .6px; }
    .caja { background: #F5F8F7; border: 1px solid #D6E0DC; border-radius: 8px; padding: 10px 12px; white-space: pre-wrap; }
    .tiempos { display: flex; gap: 10px; }
    .tiempos div { flex: 1; border: 1px solid #D6E0DC; border-radius: 8px; padding: 8px 10px; }
    .tiempos small { display: block; color: #5A6B66; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .4px; }
    .tiempos b { font-size: 13pt; }
    ol { padding-left: 18px; margin: 6px 0; } li { margin: 4px 0; } li span { color: #5A6B66; font-family: Menlo, 'Courier New', monospace; font-size: 9.5pt; margin-right: 8px; }
    img { max-width: 100%; max-height: 90mm; border-radius: 8px; border: 1px solid #D6E0DC; }
    table.chat td { font-size: 9.5pt; } table.chat .cuando { width: 22%; color: #5A6B66; font-family: Menlo, 'Courier New', monospace; font-size: 8.5pt; white-space: nowrap; } table.chat .quien { width: 24%; font-weight: 600; }
    .pie { margin-top: 24px; padding-top: 8px; border-top: 1px solid #D6E0DC; font-size: 8.5pt; color: #5A6B66; }
  </style></head><body>
    <div class="cab">
      <div class="marca">Avisa<span>ya</span></div>
      <div class="der">Informe de incidencia<b>${esc(codigoParte(p))}</b>${esc(hotel.nombre)}</div>
    </div>
    <h1>${esc(donde)} · ${esc(p.categoria)}</h1>
    <p class="sub"><span class="estado">${esc(est.texto)}</span>${p.prioridad === 'urgente' ? '<span class="estado urg">Urgente</span>' : ''}</p>
    <table>
      ${fila('Hotel', hotel.nombre)}
      ${fila('Lugar', donde)}
      ${fila('Tipo de avería', p.categoria)}
      ${fila('Prioridad', prioridad)}
      ${fila('Habitación bloqueada', p.bloquea ? 'Sí, no se podía vender' : 'No')}
      ${fila('Avisó', creador ? `${creador.nombre} (${ROLES[creador.rol]})` : '—')}
      ${fila('Fecha del aviso', fecha(p.creado_en))}
      ${fila('Técnico', tecnico ? tecnico.nombre : '—')}
      ${fila('Resuelto', p.estado === 'resuelto' ? fecha(p.resuelto_en) : 'Todavía no')}
    </table>
    <h2>Qué ocurrió</h2>
    <div class="caja">${esc(p.descripcion || 'Sin descripción.')}</div>
    ${foto ? `<h2>Foto</h2><img src="${foto}">` : ''}
    ${p.nota_resolucion ? `<h2>Qué se hizo</h2><div class="caja">${esc(p.nota_resolucion)}</div>` : ''}
    <h2>Tiempos</h2>
    <div class="tiempos">
      <div><small>Hasta que salió el técnico</small><b>${textoMinutos(t.respuesta)}</b></div>
      <div><small>Reparación</small><b>${textoMinutos(t.reparacion)}</b></div>
      <div><small>Total</small><b>${textoMinutos(t.total)}</b></div>
    </div>
    <h2>Historial</h2>
    <ol>${eventos.map((e) => `<li><span>${esc(fecha(e.creado_en))}</span>${esc(textoEvento(e, perfiles))}</li>`).join('') || '<li>Sin movimientos registrados.</li>'}</ol>
    <h2>Chat de la avería</h2>
    ${htmlChat(chat, perfiles)}
    <div class="pie">Generado con Avisaya el ${esc(fecha(new Date().toISOString()))}. Los datos reflejan el estado del parte en ese momento. Los mensajes del chat no se pueden borrar ni modificar.</div>
  </body></html>`;
}

/** Crea el PDF del parte y abre el menú para verlo, guardarlo o enviarlo. */
export async function compartirInforme(p: Parte, hotel: Hotel, perfiles: Record<string, Perfil>, eventos: Evento[], fotoUrl?: string) {
  const foto = fotoUrl ? await aBase64(fotoUrl) : null;
  const { data } = await supabase.from('mensajes').select('autor_id, texto, creado_en').eq('parte_id', p.id).order('creado_en', { ascending: true });
  const { uri } = await Print.printToFileAsync({ html: htmlInforme(p, hotel, perfiles, eventos, foto, (data ?? []) as LineaChat[]) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Informe ${codigoParte(p)}` });
  } else {
    await Print.printAsync({ uri });
  }
}

/** PDF con toda una conversación (quién, cuándo y qué dijo), para guardarla o enviarla. */
export async function exportarConversacion(titulo: string, subtitulo: string, mensajes: LineaChat[], perfiles: Record<string, Perfil>) {
  const orden = [...mensajes].sort((a, b) => a.creado_en.localeCompare(b.creado_en));
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 16mm 14mm; }
    body { font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; color: #0F1F1C; font-size: 10.5pt; margin: 0; }
    .cab { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #0B3D37; padding-bottom: 10px; }
    .marca { font-size: 20pt; font-weight: 800; color: #0B3D37; } .marca span { color: #E4561B; }
    .der { text-align: right; font-size: 9.5pt; color: #5A6B66; }
    h1 { font-size: 16pt; margin: 16px 0 2px; } .sub { color: #5A6B66; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; } td { padding: 6px 8px; border-bottom: 1px solid #D6E0DC; vertical-align: top; font-size: 9.5pt; }
    .cuando { width: 22%; color: #5A6B66; font-family: Menlo, 'Courier New', monospace; font-size: 8.5pt; white-space: nowrap; } .quien { width: 24%; font-weight: 600; }
    .pie { margin-top: 18px; padding-top: 8px; border-top: 1px solid #D6E0DC; font-size: 8.5pt; color: #5A6B66; }
  </style></head><body>
    <div class="cab"><div class="marca">Avisa<span>ya</span></div><div class="der">Registro de conversación<br>${esc(orden.length + ' mensajes')}</div></div>
    <h1>${esc(titulo)}</h1><p class="sub">${esc(subtitulo)}${orden.length ? ` · del ${esc(fecha(orden[0].creado_en))} al ${esc(fecha(orden[orden.length - 1].creado_en))}` : ''}</p>
    ${htmlChat(orden, perfiles)}
    <div class="pie">Generado con Avisaya el ${esc(fecha(new Date().toISOString()))}. Los mensajes no se pueden borrar ni modificar en la app.</div>
  </body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: titulo });
  else await Print.printAsync({ uri });
}
