import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Modal, FlatList, ActivityIndicator, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getUnidades, crearSolicitud, getMisSolicitudes, cerrarReparacion } from '../services/solicitudes';
import { subirFoto } from '../services/uploads';
import FotoPicker from './FotoPicker';
import FotoThumb from './FotoThumb';

const INK        = '#0a0a0a';
const INK_MID    = '#444444';
const INK_LIGHT  = '#888888';
const RULE       = '#bbbbbb';
const PAPER      = '#ffffff';
const PAPER_TINT = '#f2f1ee';

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const sans  = Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif';
const mono  = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

const TIPOS_UNIDAD = ['Camión', 'Remolque'];
const TIPO_API     = { 'Camión': 'camion', 'Remolque': 'remolque' };
const FILTROS      = ['Todos', 'Pendiente', 'En proceso', 'Reparado', 'Pagado', 'Rechazado', 'Pago rechazado'];

const money = (v) => `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

function formatFecha(raw) {
  if (!raw) return '—';
  return new Date(raw).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

const estatusStyleOf = (estatus) => ({
  Pendiente:        styles.estatusPendiente,
  'En proceso':     styles.estatusProceso,
  Reparado:         styles.estatusReparado,
  Pagado:           styles.estatusPagado,
  Rechazado:        styles.estatusRechazado,
  'Pago rechazado': styles.estatusRechazado,
}[estatus] ?? {});

// Estatus para mostrar: el pago se deriva del booleano autorizacionpago
// (NULL = esperando pago → 'Reparado'; 1 = 'Pagado'; 0 = 'Pago rechazado').
const displayEstatus = (s) => {
  if (s.estatus === 'Reparado') {
    if (s.autorizacionpago === 1) return 'Pagado';
    if (s.autorizacionpago === 0) return 'Pago rechazado';
  }
  return s.estatus;
};

// ── Select modal B&W ─────────────────────────────────────────
function CustomSelect({ value, options, onChange, placeholder, disabled }) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={[styles.input, styles.selectTrigger, disabled && { borderColor: RULE }]}
        onPress={() => !disabled && setVisible(true)}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <Text style={[styles.monoText, !value && { color: INK_LIGHT }]}>
          {disabled ? 'Cargando...' : (value || placeholder)}
        </Text>
        <Text style={styles.selectCaret}>▾</Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setVisible(false)} activeOpacity={1}>
          <View style={styles.sheet}>
            <FlatList
              data={options}
              keyExtractor={(item, i) => `${item}-${i}`}
              ItemSeparatorComponent={() => <View style={styles.sheetDivider} />}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.sheetOption} onPress={() => { onChange(item); setVisible(false); }}>
                  <Text style={[styles.sheetOptionText, item === value && { fontWeight: '700' }]}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ── Lista mis solicitudes ─────────────────────────────────────
function MisSolicitudes({ refreshKey }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('Todos');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getMisSolicitudes();
      setLista(data.data ?? []);
    } catch {
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar, refreshKey]);

  if (loading) return <ActivityIndicator color={INK} style={{ marginTop: 16 }} />;

  // Más reciente primero (por id) + filtro por estatus (derivado para el pago)
  const ordenadas = [...lista].sort((a, b) => b.idserviciomovil - a.idserviciomovil);
  const visibles = filtro === 'Todos' ? ordenadas : ordenadas.filter((s) => displayEstatus(s) === filtro);

  return (
    <>
      {/* Filtros por estatus */}
      <View style={styles.filtros}>
        {FILTROS.map((f) => (
          <TouchableOpacity key={f} onPress={() => setFiltro(f)} style={styles.filtroBtn} activeOpacity={0.7}>
            <Text style={[styles.filtroBtnText, filtro === f && styles.filtroBtnActive]}>{f}</Text>
            {filtro === f && <View style={styles.filtroIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {visibles.length === 0 && (
        <Text style={styles.emptyText}>
          {lista.length === 0
            ? 'Aún no tienes solicitudes registradas.'
            : `Sin solicitudes con estatus "${filtro}".`}
        </Text>
      )}

      {visibles.map((s, i) => (
        <View key={s.idserviciomovil} style={[styles.solicitudItem, i === 0 && { borderTopWidth: 1, borderTopColor: INK }]}>
          <View style={styles.solicitudHeader}>
            <Text style={styles.solicitudId}>#{String(s.idserviciomovil).padStart(4, '0')}</Text>
            <View style={[styles.estatusBadge, estatusStyleOf(displayEstatus(s))]}>
              <Text style={[styles.estatusText, estatusStyleOf(displayEstatus(s))]}>{displayEstatus(s).toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.solicitudMeta}>
            {s.tunidad} · {s.numeconomico} · {formatFecha(s.fechahora)}
          </Text>
          {s.odometro != null && (
            <View style={styles.campo}>
              <Text style={styles.campoLabel}>Odómetro  </Text>
              <Text style={styles.campoValor}>{Number(s.odometro).toLocaleString('es-MX')} km</Text>
            </View>
          )}
          <View style={styles.campo}>
            <Text style={styles.campoLabel}>Descripción  </Text>
            <Text style={styles.campoValor}>{s.descripcion}</Text>
          </View>
          <View style={styles.campo}>
            <Text style={styles.campoLabel}>Costo estimado  </Text>
            <Text style={styles.campoValor}>{money(s.costo)}</Text>
          </View>
          {s.costoreal != null && (
            <View style={styles.campo}>
              <Text style={styles.campoLabel}>Costo real  </Text>
              <Text style={styles.campoValor}>{money(s.costoreal)}</Text>
            </View>
          )}
          {s.nombreaprobador && (
            <View style={styles.campo}>
              <Text style={styles.campoLabel}>
                {s.estatus === 'Rechazado' ? 'Rechazado por  ' : 'Autorizado por  '}
              </Text>
              <Text style={styles.campoValor}>{s.nombreaprobador}</Text>
            </View>
          )}
          {(s.urlfoto || s.urlcierre) && (
            <View style={styles.fotosRow}>
              {s.urlfoto && <FotoThumb url={s.urlfoto} />}
              {s.urlcierre && <FotoThumb url={s.urlcierre} />}
            </View>
          )}
        </View>
      ))}
    </>
  );
}

// ── Reparaciones en proceso (el mecánico cierra el ticket) ─────
function ReparacionesEnProceso({ refreshKey, showToast }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localKey, setLocalKey] = useState(0);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getMisSolicitudes();
      setLista((data.data ?? []).filter((s) => s.estatus === 'En proceso'));
    } catch {
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar, refreshKey, localKey]);

  if (loading) return <ActivityIndicator color={INK} style={{ marginTop: 16 }} />;

  if (lista.length === 0) {
    return <Text style={styles.emptyText}>No tienes reparaciones en proceso.</Text>;
  }

  const ordenadas = [...lista].sort((a, b) => b.idserviciomovil - a.idserviciomovil);

  return (
    <>
      {ordenadas.map((s, i) => (
        <View key={s.idserviciomovil} style={[styles.solicitudItem, i === 0 && { borderTopWidth: 1, borderTopColor: INK }]}>
          <View style={styles.solicitudHeader}>
            <Text style={styles.solicitudId}>#{String(s.idserviciomovil).padStart(4, '0')}</Text>
            <View style={[styles.estatusBadge, estatusStyleOf(s.estatus)]}>
              <Text style={[styles.estatusText, estatusStyleOf(s.estatus)]}>{s.estatus.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.solicitudMeta}>
            {s.tunidad} · {s.numeconomico} · {formatFecha(s.fechahora)}
          </Text>
          <View style={styles.campo}>
            <Text style={styles.campoLabel}>Descripción  </Text>
            <Text style={styles.campoValor}>{s.descripcion}</Text>
          </View>
          <View style={styles.campo}>
            <Text style={styles.campoLabel}>Costo estimado  </Text>
            <Text style={styles.campoValor}>{money(s.costo)}</Text>
          </View>
          <CerrarTicketForm solicitud={s} showToast={showToast} onClosed={() => setLocalKey((k) => k + 1)} />
        </View>
      ))}
    </>
  );
}

// ── Formulario de cierre de un ticket ─────────────────────────
function CerrarTicketForm({ solicitud, showToast, onClosed }) {
  const [costoReal, setCostoReal] = useState('');
  const [fotoUri, setFotoUri] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const costo = parseFloat(costoReal);
    if (costoReal === '' || isNaN(costo) || costo < 0) {
      showToast?.('Ingresa un costo real válido', 'error');
      return;
    }
    setLoading(true);
    try {
      const urlCierre = fotoUri ? await subirFoto(fotoUri) : undefined;
      await cerrarReparacion(solicitud.idserviciomovil, { costoReal, urlCierre });
      showToast?.(`Reparación #${String(solicitud.idserviciomovil).padStart(4, '0')} cerrada`);
      onClosed?.();
    } catch {
      showToast?.('Error al cerrar la reparación', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.cierreBox}>
      <Text style={styles.label}>Costo real ($)</Text>
      <TextInput
        style={styles.input}
        value={costoReal}
        onChangeText={setCostoReal}
        placeholder="0.00"
        placeholderTextColor={INK_LIGHT}
        keyboardType="decimal-pad"
      />
      <Text style={[styles.label, { marginTop: 12 }]}>Fotografía del cierre</Text>
      <FotoPicker uri={fotoUri} onChange={setFotoUri} disabled={loading} />
      <TouchableOpacity
        style={[styles.btn, { marginTop: 12 }, loading && { backgroundColor: INK_LIGHT }]}
        onPress={submit}
        disabled={loading}
        activeOpacity={0.7}
      >
        {loading
          ? <ActivityIndicator color={PAPER} />
          : <Text style={styles.btnText}>Marcar como reparado</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

// ── Formulario principal ──────────────────────────────────────
export default function MecanicoForm({ user, showToast }) {
  const [form, setForm] = useState({
    tipoUnidad: '', numeroEconomico: '',
    descripcionServicio: '', costoEstimado: '', odometro: '',
  });
  const [fechaHora, setFechaHora] = useState(new Date());
  const [fotoUri, setFotoUri] = useState(null);
  const [showPicker, setShowPicker]   = useState(false);
  const [pickerMode, setPickerMode]   = useState('date');
  const [unidades, setUnidades] = useState([]);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState('crear');

  const esCamion = form.tipoUnidad === 'Camión';

  useEffect(() => {
    const tipoApi = TIPO_API[form.tipoUnidad];
    if (!tipoApi) { setUnidades([]); return; }
    setLoadingUnidades(true);
    setForm((p) => ({ ...p, numeroEconomico: '' }));
    getUnidades(tipoApi)
      .then(({ data }) => setUnidades(data.data ?? []))
      .catch(() => setUnidades([]))
      .finally(() => setLoadingUnidades(false));
  }, [form.tipoUnidad]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field) => (value) => setForm((p) => ({ ...p, [field]: value }));
  const setTipo = (value) => setForm((p) => ({ ...p, tipoUnidad: value, numeroEconomico: '' }));

  const onPickerChange = (event, selected) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'dismissed') return;
      if (pickerMode === 'date') {
        // combinar la fecha seleccionada con la hora actual
        const next = new Date(selected);
        next.setHours(fechaHora.getHours(), fechaHora.getMinutes());
        setFechaHora(next);
        // abrir picker de hora
        setPickerMode('time');
        setShowPicker(true);
      } else {
        const next = new Date(fechaHora);
        next.setHours(selected.getHours(), selected.getMinutes());
        setFechaHora(next);
        setPickerMode('date');
      }
    } else {
      if (selected) setFechaHora(selected);
    }
  };

  const formatFechaHora = (d) =>
    d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });

  const handleSubmit = async () => {
    const { tipoUnidad, numeroEconomico, descripcionServicio, costoEstimado, odometro } = form;
    if (!tipoUnidad || !numeroEconomico || !descripcionServicio || !costoEstimado) {
      setErrorMsg('Completa todos los campos requeridos.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      const urlFoto = fotoUri ? await subirFoto(fotoUri) : undefined;
      await crearSolicitud({
        fechaHora: fechaHora.toISOString(),
        tipoUnidad, numeroEconomico, descripcionServicio, costoEstimado,
        ...(esCamion ? { odometro } : {}),
        ...(urlFoto ? { urlFoto } : {}),
      });
      setForm({ tipoUnidad: '', numeroEconomico: '',
                descripcionServicio: '', costoEstimado: '', odometro: '' });
      setFechaHora(new Date());
      setFotoUri(null);
      setUnidades([]);
      setStatus(null);
      setRefreshKey((k) => k + 1);
      setTab('mis');
      showToast?.('Solicitud enviada correctamente');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error al enviar la solicitud');
      setStatus('error');
      showToast?.('Error al enviar la solicitud', 'error');
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

      {/* ── Pestañas ── */}
      <View style={styles.segmented}>
        <TouchableOpacity
          style={[styles.segment, tab === 'crear' && styles.segmentActive]}
          onPress={() => setTab('crear')} activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, tab === 'crear' && styles.segmentTextActive]}>Crear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, styles.segmentRight, tab === 'proceso' && styles.segmentActive]}
          onPress={() => setTab('proceso')} activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, tab === 'proceso' && styles.segmentTextActive]}>En proceso</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, styles.segmentRight, tab === 'mis' && styles.segmentActive]}
          onPress={() => setTab('mis')} activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, tab === 'mis' && styles.segmentTextActive]}>Mis solicitudes</Text>
        </TouchableOpacity>
      </View>

      {tab === 'crear' ? (
      <>
      {/* ── Formulario ── */}
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>
          Hola, <Text style={{ fontWeight: '700' }}>{user.nombre}</Text>
        </Text>
        <Text style={styles.greetingSub}>Complete el formulario para solicitar autorización de servicio.</Text>
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Fecha y hora</Text>
        <TouchableOpacity
          style={[styles.input, styles.selectTrigger]}
          onPress={() => { setPickerMode('date'); setShowPicker(true); }}
          activeOpacity={0.7}
        >
          <Text style={styles.monoText}>{formatFechaHora(fechaHora)}</Text>
          <Text style={styles.selectCaret}>▾</Text>
        </TouchableOpacity>
      </View>

      {showPicker && (
        <DateTimePicker
          value={fechaHora}
          mode={Platform.OS === 'ios' ? 'datetime' : pickerMode}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onPickerChange}
          locale="es-MX"
        />
      )}

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Tipo de unidad</Text>
        <CustomSelect value={form.tipoUnidad} options={TIPOS_UNIDAD} onChange={setTipo} placeholder="— Seleccionar —" />
      </View>

      {esCamion && (
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Odómetro (km)</Text>
          <TextInput style={styles.input} value={form.odometro} onChangeText={set('odometro')}
            placeholder="0" placeholderTextColor={INK_LIGHT} keyboardType="numeric" />
        </View>
      )}

      {!!form.tipoUnidad && (
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Número económico</Text>
          <CustomSelect value={form.numeroEconomico} options={unidades} onChange={set('numeroEconomico')}
            placeholder="— Seleccionar —" disabled={loadingUnidades} />
        </View>
      )}

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Descripción del servicio</Text>
        <TextInput style={[styles.input, styles.textarea]} value={form.descripcionServicio}
          onChangeText={set('descripcionServicio')} multiline numberOfLines={4}
          textAlignVertical="top" placeholderTextColor={INK_LIGHT} placeholder="Describe el servicio requerido" />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Costo estimado ($)</Text>
        <TextInput style={styles.input} value={form.costoEstimado} onChangeText={set('costoEstimado')}
          placeholder="0.00" placeholderTextColor={INK_LIGHT} keyboardType="decimal-pad" />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Fotografía</Text>
        <FotoPicker uri={fotoUri} onChange={setFotoUri} disabled={status === 'loading'} />
      </View>

      {status === 'error' && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.btn, status === 'loading' && { backgroundColor: INK_LIGHT }]}
        onPress={handleSubmit} disabled={status === 'loading'} activeOpacity={0.7}
      >
        {status === 'loading'
          ? <ActivityIndicator color={PAPER} />
          : <Text style={styles.btnText}>Solicitar autorización</Text>
        }
      </TouchableOpacity>

      </>
      ) : tab === 'proceso' ? (
      <View style={styles.misSolicitudesSection}>
        <ReparacionesEnProceso refreshKey={refreshKey} showToast={showToast} />
      </View>
      ) : (
      <View style={styles.misSolicitudesSection}>
        <MisSolicitudes refreshKey={refreshKey} />
      </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:     { flex: 1 },
  container:  { padding: 24, paddingBottom: 48 },

  // Control segmentado (pestañas)
  segmented:   { flexDirection: 'row', borderWidth: 1, borderColor: INK, marginBottom: 24 },
  segment:     { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: PAPER },
  segmentRight:{ borderLeftWidth: 1, borderLeftColor: INK },
  segmentActive:    { backgroundColor: INK },
  segmentText: { fontFamily: sans, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: INK },
  segmentTextActive:{ color: PAPER },

  greeting: { borderTopWidth: 3, borderTopColor: INK, paddingTop: 16, marginBottom: 24 },
  greetingText: { fontFamily: serif, fontSize: 18, color: INK, marginBottom: 4 },
  greetingSub: { fontFamily: sans, fontSize: 11, letterSpacing: 0.5, color: INK_MID },

  row:       { flexDirection: 'row' },
  fieldWrap: { marginBottom: 20 },
  label: {
    fontFamily: sans, fontSize: 10, fontWeight: '700',
    letterSpacing: 2, textTransform: 'uppercase', color: INK, marginBottom: 6,
  },
  input: {
    borderWidth: 1, borderColor: INK, borderRadius: 0,
    paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: mono, fontSize: 14, color: INK, backgroundColor: PAPER,
  },
  monoText: { fontFamily: mono, fontSize: 14, color: INK, flex: 1 },
  textarea:  { minHeight: 96, textAlignVertical: 'top' },

  selectTrigger: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  selectCaret:   { fontFamily: sans, fontSize: 14, color: INK, marginLeft: 8 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: PAPER, borderTopWidth: 5, borderTopColor: INK, maxHeight: 320 },
  sheetDivider:     { borderTopWidth: 1, borderTopColor: RULE },
  sheetOption:      { paddingHorizontal: 20, paddingVertical: 14 },
  sheetOptionText:  { fontFamily: mono, fontSize: 14, color: INK },

  photoPlaceholder: { borderWidth: 1, borderColor: RULE, borderStyle: 'dashed', padding: 20, alignItems: 'center' },
  photoPlaceholderText: { fontFamily: sans, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: INK_LIGHT },

  errorBox:  { borderLeftWidth: 3, borderLeftColor: INK, backgroundColor: PAPER_TINT, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 20 },
  errorText: { fontFamily: sans, fontSize: 13, color: INK },

  btn:     { backgroundColor: INK, paddingVertical: 14, alignItems: 'center', borderRadius: 0 },
  btnText: { fontFamily: sans, color: PAPER, fontWeight: '700', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' },

  // Sección mis solicitudes
  misSolicitudesSection: { marginTop: 40 },
  sectionTitle: { fontFamily: serif, fontSize: 18, fontWeight: '700', color: INK },
  sectionRule:  { borderTopWidth: 3, borderTopColor: INK, marginTop: 8, marginBottom: 8 },
  emptyText:    { fontFamily: sans, fontSize: 12, color: INK_MID, fontStyle: 'italic', marginTop: 12 },

  // Filtros por estatus
  filtros:        { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 1, borderBottomColor: INK, marginBottom: 8 },
  filtroBtn:      { paddingHorizontal: 10, paddingVertical: 10, alignItems: 'center' },
  filtroBtnText:  { fontFamily: sans, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '700', color: INK_MID },
  filtroBtnActive:{ color: INK },
  filtroIndicator:{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 3, backgroundColor: INK },

  // Items solicitud
  solicitudItem: { borderBottomWidth: 1, borderBottomColor: INK, paddingVertical: 16 },
  solicitudHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  solicitudId:  { fontFamily: mono, fontSize: 14, fontWeight: '700', color: INK },
  solicitudMeta: { fontFamily: sans, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: INK_MID, marginBottom: 8 },

  estatusBadge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  estatusText:  { fontFamily: sans, fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700' },
  estatusPendiente:  { borderColor: INK_MID, color: INK_MID },
  estatusProceso:    { borderColor: INK, color: INK },
  estatusReparado:   { borderColor: INK, color: INK },
  estatusPagado:     { borderColor: INK, color: PAPER, backgroundColor: INK },
  estatusRechazado:  { borderColor: INK_LIGHT, color: INK_LIGHT },

  campo:      { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 3 },
  campoLabel: { fontFamily: sans, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '700', color: INK_MID },
  campoValor: { fontFamily: serif, fontSize: 14, color: INK, flex: 1 },

  // Formulario de cierre de ticket
  cierreBox: { marginTop: 14, borderTopWidth: 1, borderTopColor: RULE, paddingTop: 14 },

  // Miniaturas de fotos
  fotosRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
