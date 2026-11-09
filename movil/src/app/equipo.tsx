import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aviso, Boton, Campo, Etiqueta, Insignia, Opcion } from '../components/ui';
import { useSesion } from '../lib/sesion';
import { mensajeError, supabase } from '../lib/supabase';
import { color, fuente, normalizar, ROLES, sombra, suave, type NombreIcono, type Rol } from '../lib/tema';

type Persona = { id: string; nombre: string; rol: Rol; activo: boolean; correo: string | null; hoteles: string[] };
type Solicitud = { perfil_id: string; nombre: string; rol: Rol; correo: string | null; hotel_id: string; hotel: string; creado_en: string; ya_es_miembro: boolean };

const ICONO_ROL: Record<Rol, NombreIcono> = { admin: 'shield-account-outline', recepcion: 'desk', limpieza: 'broom', tecnico: 'wrench' };
const TONO_ROL: Record<Rol, string> = { admin: color.acento, recepcion: color.camino, limpieza: color.espera, tecnico: color.curso };

/** Administración: ver y cambiar a las personas de tus hoteles. */
export default function Equipo() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil, hoteles, recargar } = useSesion();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('');
  const [editando, setEditando] = useState<Persona | null>(null);

  const cargar = useCallback(async () => {
    const [{ data, error: e }, { data: sol, error: e2 }] = await Promise.all([supabase.rpc('admin_equipo'), supabase.rpc('admin_solicitudes')]);
    if (e || e2) setError(mensajeError(e ?? e2));
    else {
      setError('');
      setPersonas((data ?? []) as Persona[]);
      setSolicitudes((sol ?? []) as Solicitud[]);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    // Carga desde la red: los setState ocurren tras el await, no de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const nombreHotel = useMemo(() => Object.fromEntries(hoteles.map((h) => [h.id, h.nombre])) as Record<string, string>, [hoteles]);
  const lista = useMemo(() => {
    const q = normalizar(filtro.trim());
    return q ? personas.filter((p) => normalizar(`${p.nombre} ${p.correo ?? ''} ${ROLES[p.rol]}`).includes(q)) : personas;
  }, [personas, filtro]);

  if (!perfil) return null;
  if (perfil.rol !== 'admin') {
    return (
      <View style={[s.centro, { paddingTop: insets.top + 40 }]}>
        <Aviso texto="Solo administración puede gestionar el equipo." />
        <Boton texto="Volver" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <View style={[s.barra, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={s.cerrar} accessibilityRole="button" accessibilityLabel="Volver">
          <MaterialCommunityIcons name="arrow-left" size={22} color={color.tinta} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Equipo</Text>
          <Text style={s.sub}>{personas.filter((p) => p.activo).length} personas activas en tus hoteles</Text>
        </View>
      </View>

      <FlatList
        data={lista}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} tintColor={color.marca} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <View style={s.buscador}>
              <MaterialCommunityIcons name="magnify" size={20} color={color.apagado} />
              <TextInput selectionColor={color.acento} cursorColor={color.acento} selectionHandleColor={color.acento} value={filtro} onChangeText={setFiltro} placeholder="Buscar por nombre, correo o departamento" placeholderTextColor={color.apagado} style={s.buscadorInput} autoCorrect={false} />
            </View>
            <Aviso texto={error} />
            <Text style={s.seccion}>
              Solicitudes de acceso{solicitudes.length ? ` (${solicitudes.length})` : ''}
            </Text>
            {solicitudes.length ? (
              solicitudes.map((sol) => <SolicitudTarjeta key={`${sol.perfil_id}-${sol.hotel_id}`} sol={sol} onHecho={cargar} />)
            ) : (
              <Text style={s.ayuda}>No hay nadie esperando. Para invitar a alguien, compártele el código de tu hotel (Ajustes): al registrarse, su solicitud aparecerá aquí.</Text>
            )}
            <Text style={[s.seccion, { marginTop: 8 }]}>Personas</Text>
          </View>
        }
        ListEmptyComponent={cargando ? <ActivityIndicator color={color.marca} /> : <Text style={s.ayuda}>No hay nadie que coincida.</Text>}
        renderItem={({ item: p }) => (
          <Pressable onPress={() => setEditando(p)} style={[s.tarjeta, !p.activo && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={`Editar a ${p.nombre}`}>
            <View style={[s.avatar, { backgroundColor: suave(TONO_ROL[p.rol], 0.15) }]}>
              <MaterialCommunityIcons name={ICONO_ROL[p.rol]} size={22} color={TONO_ROL[p.rol]} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={s.nombre}>
                  {p.nombre}
                  {p.id === perfil.id ? ' (tú)' : ''}
                </Text>
                <Insignia texto={ROLES[p.rol]} tono={TONO_ROL[p.rol]} />
                {!p.activo ? <Insignia texto="Desactivada" tono={color.pendiente} /> : null}
              </View>
              {p.correo ? (
                <Text style={s.correo} numberOfLines={1}>
                  {p.correo}
                </Text>
              ) : null}
              <Text style={s.hoteles} numberOfLines={2}>
                {p.hoteles.map((h) => nombreHotel[h] ?? 'Hotel').join(' · ')}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={color.apagado} />
          </Pressable>
        )}
      />

      {editando ? (
        <Editor
          persona={editando}
          esYo={editando.id === perfil.id}
          hoteles={hoteles}
          onCerrar={() => setEditando(null)}
          onGuardado={async () => {
            setEditando(null);
            await cargar();
            await recargar();
          }}
        />
      ) : null}
    </View>
  );
}

function SolicitudTarjeta({ sol, onHecho }: { sol: Solicitud; onHecho: () => void }) {
  const [rol, setRol] = useState<Rol>(sol.rol);
  const [confirmarRechazo, setConfirmarRechazo] = useState(false);
  const [ocupado, setOcupado] = useState<'si' | 'no' | null>(null);
  const [error, setError] = useState('');
  const fecha = new Date(sol.creado_en).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  async function resolver(aprobar: boolean) {
    setError('');
    setOcupado(aprobar ? 'si' : 'no');
    const { error: e } = await supabase.rpc('admin_resolver_solicitud', { p_perfil: sol.perfil_id, p_hotel: sol.hotel_id, p_aprobar: aprobar, p_rol: aprobar && !sol.ya_es_miembro ? rol : null });
    setOcupado(null);
    if (e) return setError(mensajeError(e));
    onHecho();
  }

  return (
    <View style={[s.tarjeta, s.solicitud]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[s.avatar, { backgroundColor: suave(color.curso, 0.15) }]}>
          <MaterialCommunityIcons name="account-clock-outline" size={22} color={color.curso} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.nombre}>{sol.nombre}</Text>
          {sol.correo ? <Text style={s.correo}>{sol.correo}</Text> : null}
          <Text style={s.hoteles}>
            Quiere entrar en {sol.hotel} · {fecha}
          </Text>
        </View>
      </View>
      {sol.ya_es_miembro ? (
        <Text style={s.ayuda}>Ya trabaja en otro de tus hoteles como {ROLES[sol.rol]}.</Text>
      ) : (
        <View style={{ gap: 6 }}>
          <Etiqueta>Departamento al aprobar</Etiqueta>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(Object.keys(ROLES) as Rol[]).map((r) => (
              <Opcion key={r} activa={rol === r} onPress={() => setRol(r)} texto={ROLES[r]} icono={ICONO_ROL[r]} tono={TONO_ROL[r]} style={{ flexBasis: '47%', flexGrow: 1 }} />
            ))}
          </View>
        </View>
      )}
      <Aviso texto={error} />
      {confirmarRechazo ? (
        <View style={{ gap: 8 }}>
          <Text style={s.filaTexto}>¿Rechazar la solicitud de {sol.nombre}?</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Boton texto="No" onPress={() => setConfirmarRechazo(false)} style={{ flex: 1 }} />
            <Boton texto="Rechazar" tipo="principal" onPress={() => resolver(false)} cargando={ocupado === 'no'} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Boton texto="Rechazar" tipo="fantasma" onPress={() => setConfirmarRechazo(true)} desactivado={!!ocupado} style={{ flex: 1 }} />
          <Boton texto="Aprobar" icono="check" tipo="ok" onPress={() => resolver(true)} cargando={ocupado === 'si'} style={{ flex: 2 }} />
        </View>
      )}
    </View>
  );
}

function Editor({
  persona,
  esYo,
  hoteles,
  onCerrar,
  onGuardado,
}: {
  persona: Persona;
  esYo: boolean;
  hoteles: { id: string; nombre: string }[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState(persona.nombre);
  const [rol, setRol] = useState<Rol>(persona.rol);
  const [activo, setActivo] = useState(persona.activo);
  const [suyos, setSuyos] = useState<string[]>(persona.hoteles);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError('');
    if (!nombre.trim()) return setError('Escribe un nombre.');
    setGuardando(true);
    try {
      // Primero se añaden hoteles y luego se quitan, para que nunca se quede sin ninguno
      for (const h of suyos.filter((x) => !persona.hoteles.includes(x))) {
        const { error: e } = await supabase.rpc('admin_hotel_persona', { p_perfil: persona.id, p_hotel: h, p_dentro: true });
        if (e) throw e;
      }
      for (const h of persona.hoteles.filter((x) => !suyos.includes(x))) {
        const { error: e } = await supabase.rpc('admin_hotel_persona', { p_perfil: persona.id, p_hotel: h, p_dentro: false });
        if (e) throw e;
      }
      if (nombre.trim() !== persona.nombre || rol !== persona.rol || activo !== persona.activo) {
        const { error: e } = await supabase.rpc('admin_editar_persona', { p_perfil: persona.id, p_nombre: nombre.trim(), p_rol: rol, p_activo: activo });
        if (e) throw e;
      }
      onGuardado();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCerrar}>
      <KeyboardAvoidingView style={s.hojaFondo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.hoja, { paddingBottom: insets.bottom + 16 }]}>
          <ScrollView contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
            <View>
              <Text style={s.hojaTitulo}>{esYo ? 'Tu perfil' : persona.nombre}</Text>
              {persona.correo ? <Text style={s.correo}>{persona.correo}</Text> : null}
            </View>

            <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} maxLength={40} />

            <View style={{ gap: 8 }}>
              <Etiqueta>Departamento</Etiqueta>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(Object.keys(ROLES) as Rol[]).map((r) => (
                  <Opcion
                    key={r}
                    activa={rol === r}
                    onPress={() => (esYo && r !== 'admin' ? setError('No puedes quitarte tu propio acceso de administración.') : setRol(r))}
                    texto={ROLES[r]}
                    icono={ICONO_ROL[r]}
                    tono={TONO_ROL[r]}
                    style={{ flexBasis: '47%', flexGrow: 1 }}
                  />
                ))}
              </View>
              {rol === 'admin' && !esYo ? <Text style={s.ayuda}>Administración puede gestionar el equipo y crear hoteles.</Text> : null}
            </View>

            <View style={{ gap: 8 }}>
              <Etiqueta>Hoteles</Etiqueta>
              {hoteles.map((h) => {
                const dentro = suyos.includes(h.id);
                return (
                  <Pressable
                    key={h.id}
                    onPress={() => setSuyos((l) => (dentro ? l.filter((x) => x !== h.id) : [...l, h.id]))}
                    style={[s.fila, dentro && { borderColor: color.marca2, backgroundColor: suave(color.marca2, 0.08) }]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: dentro }}>
                    <MaterialCommunityIcons name={dentro ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={dentro ? color.marca2 : color.apagado} />
                    <Text style={s.filaTexto}>{h.nombre}</Text>
                  </Pressable>
                );
              })}
            </View>

            {!esYo ? (
              <Pressable style={s.fila} onPress={() => setActivo((a) => !a)} accessibilityRole="switch" accessibilityState={{ checked: activo }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.filaTexto}>Cuenta activa</Text>
                  <Text style={s.ayuda}>Si la desactivas, no podrá entrar ni recibirá avisos. Sus partes y su historial se conservan.</Text>
                </View>
                <Switch value={activo} onValueChange={setActivo} trackColor={{ true: color.ok, false: color.linea }} />
              </Pressable>
            ) : null}

            <Aviso texto={error} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Boton texto="Cancelar" onPress={onCerrar} style={{ flex: 1 }} />
              <Boton texto="Guardar" tipo="principal" onPress={guardar} cargando={guardando} style={{ flex: 2 }} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  centro: { flex: 1, padding: 24, gap: 16, backgroundColor: color.fondo },
  barra: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: color.superficie, borderBottomWidth: 1, borderBottomColor: color.linea },
  cerrar: { width: 42, height: 42, borderRadius: 12, backgroundColor: color.elevado, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fuente.titulo, fontSize: 21, color: color.tinta },
  sub: { fontFamily: fuente.texto, fontSize: 13, color: color.apagado },
  buscador: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.superficie, borderWidth: 1, borderColor: color.linea, borderRadius: 14, paddingHorizontal: 12 },
  buscadorInput: { flex: 1, fontFamily: fuente.texto, fontSize: 15.5, color: color.tinta, paddingVertical: 11 },
  ayuda: { fontFamily: fuente.texto, fontSize: 13.5, color: color.apagado, lineHeight: 19 },
  tarjeta: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.superficie, borderRadius: 16, padding: 14, ...sombra },
  avatar: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  nombre: { fontFamily: fuente.titulo, fontSize: 16, color: color.tinta },
  correo: { fontFamily: fuente.texto, fontSize: 13.5, color: color.apagado },
  hoteles: { fontFamily: fuente.textoMedio, fontSize: 13, color: color.marca2 },
  hojaFondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(6,12,10,0.4)' },
  hoja: { backgroundColor: color.superficie, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, maxHeight: '92%' },
  hojaTitulo: { fontFamily: fuente.titulo, fontSize: 20, color: color.tinta },
  seccion: { fontFamily: fuente.titulo, fontSize: 16, color: color.tinta },
  solicitud: { flexDirection: 'column', alignItems: 'stretch', gap: 12, borderWidth: 1.5, borderColor: suave(color.curso, 0.5) },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: color.linea, borderRadius: 12, padding: 12, backgroundColor: color.elevado },
  filaTexto: { fontFamily: fuente.textoFuerte, fontSize: 15, color: color.tinta },
});
