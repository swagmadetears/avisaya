import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  categoria,
  color,
  duracion,
  ESTADOS,
  esHabitacion,
  fuente,
  hace,
  minutosDesde,
  ROLES,
  sombra,
  suave,
  type Parte,
  type Perfil,
} from '../lib/tema';
import { Boton, Insignia } from './ui';

export type Accion = 'camino' | 'empezar' | 'soltar' | 'esperar' | 'resolver' | 'reabrir';

type Props = {
  parte: Parte;
  yo: Perfil;
  perfiles: Record<string, Perfil>;
  foto?: string;
  ocupado: boolean;
  onAccion: (p: Parte, a: Accion) => void;
  onFoto: (url: string) => void;
  onDetalle: (p: Parte) => void;
};

function PasoBarra({ parte }: { parte: Parte }) {
  const idx = { pendiente: 0, en_camino: 1, en_curso: 2, esperando: 2, resuelto: 3 }[parte.estado];
  const etiquetas = ['Avisado', 'De camino', parte.estado === 'esperando' ? 'Falta pieza' : 'Reparando', 'Resuelto'];
  const tono = ESTADOS[parte.estado].color;
  return (
    <View style={s.pasos} accessibilityLabel={`Progreso: ${ESTADOS[parte.estado].texto}`}>
      {etiquetas.map((e, i) => (
        <View key={e} style={s.paso}>
          <View style={[s.pasoBarra, i <= idx && { backgroundColor: tono }]} />
          <Text style={[s.pasoTexto, i === idx && { color: tono, fontFamily: fuente.textoFuerte }]}>{e}</Text>
        </View>
      ))}
    </View>
  );
}

function acciones(p: Parte, yo: Perfil): { a: Accion; texto: string; tipo: 'principal' | 'camino' | 'ok' | 'normal' | 'fantasma'; icono?: 'run-fast' | 'check' }[] {
  if (yo.rol !== 'tecnico') {
    return p.estado === 'resuelto' && (yo.rol === 'recepcion' || yo.rol === 'admin') ? [{ a: 'reabrir', texto: 'Reabrir', tipo: 'normal' }] : [];
  }
  const mio = p.tecnico_id === yo.id;
  const deOtro = !!p.tecnico_id && !mio;
  switch (p.estado) {
    case 'pendiente':
      return [{ a: 'camino', texto: 'Voy para allá', tipo: 'camino', icono: 'run-fast' }];
    case 'en_camino':
      return deOtro
        ? [{ a: 'camino', texto: 'Me lo quedo yo', tipo: 'normal', icono: 'run-fast' }]
        : [
            { a: 'empezar', texto: 'He llegado, empiezo', tipo: 'principal' },
            { a: 'soltar', texto: 'Soltar', tipo: 'fantasma' },
          ];
    case 'en_curso':
      return deOtro
        ? [{ a: 'camino', texto: 'Me lo quedo yo', tipo: 'normal', icono: 'run-fast' }]
        : [
            { a: 'resolver', texto: 'Resuelto', tipo: 'ok', icono: 'check' },
            { a: 'esperar', texto: 'Falta una pieza', tipo: 'normal' },
          ];
    case 'esperando':
      return [
        { a: 'empezar', texto: 'Retomar', tipo: 'principal' },
        { a: 'resolver', texto: 'Resuelto', tipo: 'ok', icono: 'check' },
      ];
    case 'resuelto':
      return [{ a: 'reabrir', texto: 'Reabrir', tipo: 'normal' }];
  }
}

function ParteTarjetaBase({ parte: p, yo, perfiles, foto, ocupado, onAccion, onFoto, onDetalle }: Props) {
  const cat = categoria(p.categoria);
  const abierto = p.estado !== 'resuelto';
  const hab = esHabitacion(p.habitacion);
  const tecnico = p.tecnico_id ? perfiles[p.tecnico_id]?.nombre ?? 'Técnico' : '';
  const creador = p.creado_por ? perfiles[p.creado_por] : undefined;
  const espera = minutosDesde(p.creado_en);
  const tarde = p.estado === 'pendiente' && ((p.prioridad === 'urgente' && espera >= 15) || espera >= 120);

  let estadoTxt: React.ReactNode;
  if (p.estado === 'en_camino') estadoTxt = <Text><Text style={s.negrita}>{tecnico}</Text> va de camino · {duracion(p.cambio_estado_en)}</Text>;
  else if (p.estado === 'en_curso') estadoTxt = <Text><Text style={s.negrita}>{tecnico}</Text> reparando · {duracion(p.cambio_estado_en)}</Text>;
  else if (p.estado === 'esperando') estadoTxt = <Text><Text style={s.negrita}>{tecnico || 'Técnico'}</Text> espera una pieza</Text>;
  else if (p.estado === 'resuelto') estadoTxt = <Text>Resuelto por <Text style={s.negrita}>{tecnico || '—'}</Text> {hace(p.resuelto_en)}</Text>;
  else estadoTxt = <Text style={tarde ? s.tarde : undefined}>Sin técnico · espera {duracion(p.creado_en)}</Text>;

  const botones = acciones(p, yo);

  return (
    <View style={[s.tarjeta, !abierto && { opacity: 0.82 }]}>
      {p.prioridad === 'urgente' && abierto ? <View style={s.franja} /> : null}
      <View style={s.cabecera}>
        <View style={s.llave}>
          <View style={s.llaveAgujero} />
          <Text style={s.llaveTipo}>{hab ? 'HAB.' : 'ZONA'}</Text>
          <Text style={[s.llaveNum, !hab && s.llaveZona]} numberOfLines={2}>
            {p.habitacion}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={s.catFila}>
            <View style={[s.catIcono, { backgroundColor: suave(cat.color, 0.15) }]}>
              <MaterialCommunityIcons name={cat.icono} size={17} color={cat.color} />
            </View>
            <Text style={s.catTexto}>{p.categoria}</Text>
          </View>
          <View style={s.insignias}>
            <Insignia texto={ESTADOS[p.estado].texto} tono={ESTADOS[p.estado].color} />
            {p.prioridad === 'urgente' && abierto ? <Insignia texto="Urgente" tono={color.pendiente} /> : null}
            {p.bloquea && abierto ? <Insignia texto="No vender" tono={color.curso} /> : null}
          </View>
        </View>
      </View>

      {p.descripcion ? <Text style={s.desc}>{p.descripcion}</Text> : null}
      {foto ? (
        <Pressable accessibilityRole="imagebutton" accessibilityLabel="Ver foto" onPress={() => onFoto(foto)}>
          <Image source={{ uri: foto }} style={s.foto} contentFit="cover" transition={150} />
        </Pressable>
      ) : null}

      <PasoBarra parte={p} />

      <View style={{ gap: 2 }}>
        <Text style={s.meta}>{estadoTxt}</Text>
        <Text style={s.meta}>
          Avisa {creador?.nombre ?? '—'}
          {creador ? ` (${ROLES[creador.rol]})` : ''} · {hace(p.creado_en)}
        </Text>
      </View>
      {p.nota_resolucion ? <Text style={s.nota}>{p.nota_resolucion}</Text> : null}

      {botones.length ? (
        <View style={s.acciones}>
          {botones.map((b) => (
            <Boton key={b.a} texto={b.texto} tipo={b.tipo} icono={b.icono} onPress={() => onAccion(p, b.a)} desactivado={ocupado} style={{ flexGrow: 1 }} />
          ))}
        </View>
      ) : null}
      <Pressable onPress={() => onDetalle(p)} style={s.detalle} accessibilityRole="button" accessibilityLabel="Ver detalle e informe PDF">
        <MaterialCommunityIcons name="file-document-outline" size={17} color={color.marca2} />
        <Text style={s.detalleTexto}>Detalle e informe PDF</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={color.apagado} />
      </Pressable>
    </View>
  );
}

export const ParteTarjeta = memo(ParteTarjetaBase);

const s = StyleSheet.create({
  tarjeta: { backgroundColor: color.superficie, borderRadius: 18, padding: 14, gap: 12, overflow: 'hidden', ...sombra },
  franja: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: color.pendiente },
  cabecera: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  llave: {
    minWidth: 68,
    maxWidth: 90,
    alignItems: 'center',
    backgroundColor: color.elevado,
    borderWidth: 1.5,
    borderColor: color.linea,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 6,
  },
  llaveAgujero: { position: 'absolute', top: 5, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: color.linea },
  llaveTipo: { fontFamily: fuente.textoFuerte, fontSize: 9, color: color.apagado, letterSpacing: 1 },
  llaveNum: { fontFamily: fuente.numero, fontSize: 22, color: color.tinta, marginTop: 4, textAlign: 'center' },
  llaveZona: { fontFamily: fuente.titulo, fontSize: 13 },
  catFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catIcono: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  catTexto: { fontFamily: fuente.titulo, fontSize: 16, color: color.tinta, flexShrink: 1 },
  insignias: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  desc: { fontFamily: fuente.texto, fontSize: 15.5, color: color.tinta, lineHeight: 22 },
  foto: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: color.elevado },
  pasos: { flexDirection: 'row', gap: 4 },
  paso: { flex: 1, gap: 5 },
  pasoBarra: { height: 5, borderRadius: 3, backgroundColor: color.linea },
  pasoTexto: { fontFamily: fuente.textoMedio, fontSize: 10.5, color: color.apagado },
  meta: { fontFamily: fuente.texto, fontSize: 13, color: color.apagado },
  negrita: { fontFamily: fuente.textoFuerte, color: color.tinta },
  tarde: { color: color.pendiente, fontFamily: fuente.textoFuerte },
  nota: { fontFamily: fuente.texto, fontSize: 14, color: color.tinta, backgroundColor: suave(color.ok, 0.12), borderRadius: 10, padding: 10 },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detalle: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: color.linea, paddingTop: 10, marginTop: -2 },
  detalleTexto: { flex: 1, fontFamily: fuente.textoFuerte, fontSize: 14, color: color.marca2 },
});
