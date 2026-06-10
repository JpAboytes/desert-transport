import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Platform, Modal,
} from 'react-native';
import { getSolicitudes, actualizarEstatus, autorizarPago } from '../services/solicitudes';
import FotoThumb from './FotoThumb';

const INK        = '#0a0a0a';
const INK_MID    = '#444444';
const INK_LIGHT  = '#888888';
const RULE       = '#bbbbbb';
const PAPER      = '#ffffff';
const PAPER_TINT = '#f2f1ee';

const sans = Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif';
const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const FILTROS = ['Todos', 'Pendiente', 'En proceso', 'Reparado', 'Pagado', 'Rechazado', 'Pago rechazado'];
const FILTROS_FECHA = ['Todo', 'Hoy', '7 días', '30 días'];

const money = (v) => `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

// Filtro por rango de fecha (presets). 'Hoy' = mismo día; N días = últimos N días.
function dentroDeRango(raw, rango) {
  if (rango === 'Todo') return true;
  if (!raw) return false;
  const f = new Date(raw);
  if (rango === 'Hoy') return f.toDateString() === new Date().toDateString();
  const dias = rango === '7 días' ? 7 : 30;
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);
  return f >= limite;
}

// Estatus para mostrar: el pago se deriva del booleano autorizacionpago
// (NULL = esperando pago → 'Reparado'; 1 = 'Pagado'; 0 = 'Pago rechazado').
const displayEstatus = (s) => {
  if (s.estatus === 'Reparado') {
    if (s.autorizacionpago === 1) return 'Pagado';
    if (s.autorizacionpago === 0) return 'Pago rechazado';
  }
  return s.estatus;
};

function formatFecha(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

// ── Select modal B&W (compacto, para filtros) ────────────────
function CustomSelect({ value, options, onChange, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={[styles.input, styles.selectTrigger]}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.monoText, !value && { color: INK_LIGHT }]} numberOfLines={1}>
          {value || placeholder}
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

// Bloque de fotos colapsable (Apertura/Cierre): oculto por defecto.
function FotosColapsables({ fotos }) {
  const [abierto, setAbierto] = useState(false);
  if (!fotos?.length) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <TouchableOpacity style={styles.fotosToggle} onPress={() => setAbierto((a) => !a)} activeOpacity={0.7}>
        <Text style={styles.fotosToggleText}>
          {abierto ? 'Ocultar imágenes' : `Ver imágenes (${fotos.length})`}
        </Text>
      </TouchableOpacity>
      {abierto && (
        <View style={styles.fotosBlock}>
          {['Apertura', 'Cierre'].map((tipo) => {
            const fs = fotos.filter((f) => f.tipo === tipo);
            if (fs.length === 0) return null;
            return (
              <View key={tipo} style={styles.fotoCol}>
                <Text style={styles.campoLabel}>{tipo}</Text>
                <View style={styles.fotosRowAdmin}>
                  {fs.map((f, i) => <FotoThumb key={i} url={f.url} size={48} />)}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function SolicitudItem({ item, onActualizar, onPago, onToast }) {
  const [loading, setLoading] = useState(null);
  const est = displayEstatus(item);

  const handleEstatus = async (estatus, etiqueta) => {
    setLoading(estatus);
    try {
      await onActualizar(item.idserviciomovil, estatus);
      onToast?.(`Solicitud #${String(item.idserviciomovil)} ${etiqueta}`);
    } catch {
      onToast?.('Error al actualizar la solicitud', 'error');
    }
    setLoading(null);
  };

  const handlePago = async (aprobado) => {
    const key = aprobado ? 'pago-si' : 'pago-no';
    setLoading(key);
    try {
      await onPago(item.idserviciomovil, aprobado);
      onToast?.(`Pago de #${String(item.idserviciomovil)} ${aprobado ? 'autorizado' : 'rechazado'}`);
    } catch {
      onToast?.('Error al registrar el pago', 'error');
    }
    setLoading(null);
  };

  const estatusStyle = {
    Pendiente:         styles.estatusPendiente,
    'En proceso':      styles.estatusProceso,
    Reparado:          styles.estatusReparado,
    Pagado:            styles.estatusPagado,
    Rechazado:         styles.estatusRechazado,
    'Pago rechazado':  styles.estatusRechazado,
  }[est] ?? {};

  return (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemId}>#{String(item.idserviciomovil)}</Text>
        <View style={[styles.estatusBadge, estatusStyle]}>
          <Text style={[styles.estatusText, estatusStyle]}>{est.toUpperCase()}</Text>
        </View>
      </View>

      <Text style={styles.itemMeta}>
        {item.nombresolicitante} · {item.tunidad} · {item.numeconomico} · {formatFecha(item.fechahora)}
      </Text>

      {item.odometro != null && (
        <View style={styles.campo}>
          <Text style={styles.campoLabel}>Odómetro  </Text>
          <Text style={styles.campoValor}>{Number(item.odometro).toLocaleString('es-MX')} km</Text>
        </View>
      )}

      <View style={styles.campo}>
        <Text style={styles.campoLabel}>Descripción  </Text>
        <Text style={styles.campoValor}>{item.descripcion}</Text>
      </View>

      <View style={styles.campo}>
        <Text style={styles.campoLabel}>Costo estimado  </Text>
        <Text style={styles.campoValor}>{money(item.costo)}</Text>
      </View>

      {item.costoreal != null && (
        <View style={styles.campo}>
          <Text style={styles.campoLabel}>Costo real  </Text>
          <Text style={styles.campoValor}>{money(item.costoreal)}</Text>
        </View>
      )}

      <FotosColapsables fotos={item.fotos} />

      {item.nombreaprobador && (
        <View style={styles.campo}>
          <Text style={styles.campoLabel}>
            {item.estatus === 'Rechazado' ? 'Rechazado por  ' : 'Autorizado por  '}
          </Text>
          <Text style={styles.campoValor}>{item.nombreaprobador}</Text>
        </View>
      )}

      {item.estatus === 'Pendiente' && (
        <View style={styles.acciones}>
          <TouchableOpacity
            style={[styles.btnAccion, styles.btnAprobar, loading && { opacity: 0.4 }]}
            onPress={() => handleEstatus('En proceso', 'autorizada')}
            disabled={!!loading}
            activeOpacity={0.7}
          >
            {loading === 'En proceso'
              ? <ActivityIndicator color={PAPER} size="small" />
              : <Text style={styles.btnAprobarText}>Aprobar</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnAccion, styles.btnRechazar, loading && { opacity: 0.4 }]}
            onPress={() => handleEstatus('Rechazado', 'rechazada')}
            disabled={!!loading}
            activeOpacity={0.7}
          >
            {loading === 'Rechazado'
              ? <ActivityIndicator color={INK} size="small" />
              : <Text style={styles.btnRechazarText}>Rechazar</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {est === 'Reparado' && (
        <View style={styles.acciones}>
          <TouchableOpacity
            style={[styles.btnAccion, styles.btnAprobar, loading && { opacity: 0.4 }]}
            onPress={() => handlePago(true)}
            disabled={!!loading}
            activeOpacity={0.7}
          >
            {loading === 'pago-si'
              ? <ActivityIndicator color={PAPER} size="small" />
              : <Text style={styles.btnAprobarText}>Autorizar pago</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnAccion, styles.btnRechazar, loading && { opacity: 0.4 }]}
            onPress={() => handlePago(false)}
            disabled={!!loading}
            activeOpacity={0.7}
          >
            {loading === 'pago-no'
              ? <ActivityIndicator color={INK} size="small" />
              : <Text style={styles.btnRechazarText}>Rechazar pago</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function AdminView({ showToast }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('Todos');
  const [filtroFecha, setFiltroFecha] = useState('Todo');

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getSolicitudes();
      setSolicitudes(data.data ?? []);
    } catch {
      setError('Error al cargar las solicitudes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleActualizar = async (id, estatus) => {
    await actualizarEstatus(id, estatus);
    setSolicitudes((prev) =>
      prev.map((s) => s.idserviciomovil === id ? { ...s, estatus } : s)
    );
  };

  const handlePago = async (id, aprobado) => {
    await autorizarPago(id, aprobado);
    setSolicitudes((prev) =>
      prev.map((s) => s.idserviciomovil === id ? { ...s, autorizacionpago: aprobado ? 1 : 0 } : s)
    );
  };

  const lista = solicitudes.filter((s) =>
    (filtro === 'Todos' || displayEstatus(s) === filtro) &&
    dentroDeRango(s.fechahora, filtroFecha)
  );

  return (
    <View style={styles.container}>
      {/* Filtros (estatus + fecha) */}
      <View style={styles.filtroSelects}>
        <View style={styles.filtroSelectCol}>
          <Text style={styles.filtroSelectLabel}>Estatus</Text>
          <CustomSelect value={filtro} options={FILTROS} onChange={setFiltro} placeholder="Todos" />
        </View>
        <View style={styles.filtroSelectCol}>
          <Text style={styles.filtroSelectLabel}>Fecha</Text>
          <CustomSelect value={filtroFecha} options={FILTROS_FECHA} onChange={setFiltroFecha} placeholder="Todo" />
        </View>
        <TouchableOpacity onPress={cargar} style={styles.filtroReload} activeOpacity={0.7}>
          <Text style={styles.filtroReloadText}>↺</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color={INK} style={{ marginTop: 32 }} />}

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && lista.length === 0 && (
        <Text style={styles.empty}>
          Sin solicitudes con los filtros seleccionados.
        </Text>
      )}

      <FlatList
        data={lista}
        keyExtractor={(item) => String(item.idserviciomovil)}
        renderItem={({ item }) => (
          <SolicitudItem item={item} onActualizar={handleActualizar} onPago={handlePago} onToast={showToast} />
        )}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Filtros (estatus + fecha) como selects
  filtroSelects: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 14, marginBottom: 14,
  },
  filtroSelectCol: { flex: 1 },
  filtroSelectLabel: {
    fontFamily: sans, fontSize: 9, letterSpacing: 1.5,
    textTransform: 'uppercase', fontWeight: '700', color: INK_LIGHT, marginBottom: 6,
  },
  filtroReload: { borderWidth: 1, borderColor: INK, paddingHorizontal: 12, paddingVertical: 10 },
  filtroReloadText: { fontFamily: sans, fontSize: 16, color: INK, lineHeight: 18 },

  // Select (trigger + sheet)
  input: {
    borderWidth: 1, borderColor: INK, borderRadius: 0,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: PAPER,
  },
  selectTrigger: { flexDirection: 'row', alignItems: 'center' },
  monoText: { fontFamily: mono, fontSize: 14, color: INK, flex: 1 },
  selectCaret: { fontFamily: sans, fontSize: 14, color: INK, marginLeft: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: PAPER, borderTopWidth: 5, borderTopColor: INK, maxHeight: 320 },
  sheetDivider: { borderTopWidth: 1, borderTopColor: RULE },
  sheetOption: { paddingHorizontal: 20, paddingVertical: 14 },
  sheetOptionText: { fontFamily: mono, fontSize: 14, color: INK },

  // Toggle de fotos
  fotosToggle: {
    alignSelf: 'flex-start', borderWidth: 1, borderColor: INK,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  fotosToggleText: {
    fontFamily: sans, fontSize: 9, letterSpacing: 1.5,
    textTransform: 'uppercase', fontWeight: '700', color: INK,
  },

  // Solicitud item
  item: {
    borderTopWidth: 1,
    borderTopColor: INK,
    paddingVertical: 16,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  itemId: { fontFamily: mono, fontSize: 14, fontWeight: '700', color: INK },

  estatusBadge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  estatusText: {
    fontFamily: sans, fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700',
  },
  estatusPendiente:  { borderColor: INK_MID, color: INK_MID },
  estatusProceso:    { borderColor: INK, color: INK },
  estatusReparado:   { borderColor: INK, color: INK },
  estatusPagado:     { borderColor: INK, color: PAPER, backgroundColor: INK },
  estatusRechazado:  { borderColor: INK_LIGHT, color: INK_LIGHT },

  itemMeta: {
    fontFamily: sans, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
    color: INK_MID, marginBottom: 10,
  },

  campo: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  campoLabel: {
    fontFamily: sans, fontSize: 9, letterSpacing: 1.5,
    textTransform: 'uppercase', fontWeight: '700', color: INK_MID,
  },
  campoValor: { fontFamily: serif, fontSize: 14, color: INK, flex: 1 },

  // Fotos
  fotosBlock: { gap: 10, marginTop: 8, marginBottom: 4 },
  fotoCol: { gap: 4 },
  fotosRowAdmin: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  // Acciones
  acciones: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btnAccion: { paddingVertical: 9, paddingHorizontal: 20, alignItems: 'center', minWidth: 96 },
  btnAprobar: { backgroundColor: INK },
  btnRechazar: { backgroundColor: PAPER, borderWidth: 1, borderColor: INK },
  btnAprobarText: {
    fontFamily: sans, color: PAPER, fontWeight: '700',
    fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
  },
  btnRechazarText: {
    fontFamily: sans, color: INK, fontWeight: '700',
    fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
  },

  // Error / vacío
  errorBox: {
    borderLeftWidth: 3, borderLeftColor: INK,
    backgroundColor: PAPER_TINT, padding: 12, marginVertical: 16,
  },
  errorText: { fontFamily: sans, fontSize: 13, color: INK },
  empty: { fontFamily: sans, fontSize: 12, color: INK_MID, fontStyle: 'italic', marginTop: 24 },
});
