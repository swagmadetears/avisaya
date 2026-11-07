import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fechaCorta, type Rango, type TipoRango } from '../lib/fechas';
import { color, fuente } from '../lib/tema';
import { Aviso, Boton } from './ui';

const RAPIDOS: { tipo: TipoRango; texto: string }[] = [
  { tipo: 'todas', texto: 'Cualquier fecha' },
  { tipo: 'hoy', texto: 'Hoy' },
  { tipo: 'ayer', texto: 'Ayer' },
  { tipo: '7d', texto: 'Últimos 7 días' },
  { tipo: '30d', texto: 'Últimos 30 días' },
];

/** Fila de filtros de fecha (por fecha del aviso) con opción de elegir un rango. */
export function FiltroFecha({ valor, onCambio }: { valor: Rango; onCambio: (r: Rango) => void }) {
  const insets = useSafeAreaInsets();
  const [abierto, setAbierto] = useState(false);
  const [desde, setDesde] = useState<Date | undefined>(valor.desde);
  const [hasta, setHasta] = useState<Date | undefined>(valor.hasta);
  const [editando, setEditando] = useState<'desde' | 'hasta' | null>(null);
  const [error, setError] = useState('');
  const hoy = new Date();

  function abrir() {
    setDesde(valor.tipo === 'rango' ? valor.desde : undefined);
    setHasta(valor.tipo === 'rango' ? valor.hasta : undefined);
    setEditando(null);
    setError('');
    setAbierto(true);
  }

  function elegir(campo: 'desde' | 'hasta') {
    const actual = (campo === 'desde' ? desde : hasta) ?? hoy;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: actual,
        mode: 'date',
        maximumDate: hoy,
        onValueChange: (_e, d) => (campo === 'desde' ? setDesde(d) : setHasta(d)),
      });
    } else {
      setEditando(editando === campo ? null : campo);
    }
  }

  function aplicar() {
    if (!desde && !hasta) return setError('Elige al menos una fecha.');
    if (desde && hasta && desde > hasta) return setError('La fecha «desde» es posterior a «hasta».');
    onCambio({ tipo: 'rango', desde, hasta });
    setAbierto(false);
  }

  const etiquetaRango = valor.tipo === 'rango' ? `${valor.desde ? fechaCorta(valor.desde) : '…'} – ${valor.hasta ? fechaCorta(valor.hasta) : 'hoy'}` : 'Elegir fechas';

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fila} keyboardShouldPersistTaps="handled">
        <MaterialCommunityIcons name="calendar-month-outline" size={18} color={color.apagado} style={{ marginRight: 2 }} />
        {RAPIDOS.map((r) => (
          <Pressable key={r.tipo} onPress={() => onCambio({ tipo: r.tipo })} style={[s.chip, valor.tipo === r.tipo && s.chipActivo]} accessibilityRole="radio" accessibilityState={{ checked: valor.tipo === r.tipo }}>
            <Text style={[s.chipTexto, valor.tipo === r.tipo && { color: '#fff' }]}>{r.texto}</Text>
          </Pressable>
        ))}
        <Pressable onPress={abrir} style={[s.chip, valor.tipo === 'rango' && s.chipActivo]} accessibilityRole="button" accessibilityLabel="Elegir rango de fechas">
          <Text style={[s.chipTexto, valor.tipo === 'rango' && { color: '#fff' }]}>{etiquetaRango}</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={abierto} transparent animationType="slide" onRequestClose={() => setAbierto(false)}>
        <Pressable style={s.fondo} onPress={() => setAbierto(false)} accessibilityLabel="Cerrar">
          <Pressable style={[s.hoja, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <Text style={s.titulo}>Elegir fechas</Text>
            <Text style={s.sub}>Partes avisados entre estas dos fechas (ambas incluidas).</Text>
            {(['desde', 'hasta'] as const).map((campo) => {
              const v = campo === 'desde' ? desde : hasta;
              return (
                <View key={campo} style={{ gap: 6 }}>
                  <Pressable onPress={() => elegir(campo)} style={[s.campo, editando === campo && { borderColor: color.acento }]} accessibilityRole="button">
                    <Text style={s.campoEtiqueta}>{campo === 'desde' ? 'Desde' : 'Hasta'}</Text>
                    <Text style={[s.campoValor, !v && { color: color.apagado }]}>{v ? fechaCorta(v) : campo === 'desde' ? 'Sin límite' : 'Hoy'}</Text>
                    {v ? (
                      <Pressable
                        hitSlop={10}
                        onPress={() => (campo === 'desde' ? setDesde(undefined) : setHasta(undefined))}
                        accessibilityRole="button"
                        accessibilityLabel={`Quitar fecha ${campo}`}>
                        <MaterialCommunityIcons name="close-circle" size={18} color={color.apagado} />
                      </Pressable>
                    ) : (
                      <MaterialCommunityIcons name="calendar" size={18} color={color.apagado} />
                    )}
                  </Pressable>
                  {Platform.OS === 'ios' && editando === campo ? (
                    <DateTimePicker
                      value={v ?? hoy}
                      mode="date"
                      display="inline"
                      locale="es-ES"
                      maximumDate={hoy}
                      accentColor={color.acento}
                      onValueChange={(_e, d) => (campo === 'desde' ? setDesde(d) : setHasta(d))}
                    />
                  ) : null}
                </View>
              );
            })}
            <Aviso texto={error} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Boton texto="Cancelar" onPress={() => setAbierto(false)} style={{ flex: 1 }} />
              <Boton texto="Aplicar" tipo="principal" onPress={aplicar} style={{ flex: 2 }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: color.superficie, borderWidth: 1, borderColor: color.linea },
  chipActivo: { backgroundColor: color.marca2, borderColor: color.marca2 },
  chipTexto: { fontFamily: fuente.textoMedio, fontSize: 13.5, color: color.tinta },
  fondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(6,12,10,0.4)' },
  hoja: { backgroundColor: color.superficie, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, gap: 12 },
  titulo: { fontFamily: fuente.titulo, fontSize: 19, color: color.tinta },
  sub: { fontFamily: fuente.texto, fontSize: 14, color: color.apagado },
  campo: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: color.linea, backgroundColor: color.elevado, borderRadius: 12, padding: 12 },
  campoEtiqueta: { fontFamily: fuente.textoFuerte, fontSize: 13, color: color.apagado, width: 56 },
  campoValor: { flex: 1, fontFamily: fuente.numero, fontSize: 17, color: color.tinta },
});
