import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Platform,
} from 'react-native';
import { getSolicitudes, actualizarEstatus } from '../services/solicitudes';

const INK        = '#0a0a0a';
const INK_MID    = '#444444';
const INK_LIGHT  = '#888888';
const RULE       = '#bbbbbb';
const PAPER      = '#ffffff';
const PAPER_TINT = '#f2f1ee';

const sans = Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif';
const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const FILTROS = ['Todos', 'Pendiente', 'Autorizado', 'Rechazado'];

function formatFecha(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function SolicitudItem({ item, onActualizar, onToast }) {
  const [loading, setLoading] = useState(null);

  const handleEstatus = async (estatus) => {
    setLoading(estatus);
    try {
      await onActualizar(item.idserviciomovil, estatus);
      onToast?.(`Solicitud #${String(item.idserviciomovil).padStart(4,'0')} ${estatus.toLowerCase()}`);
    } catch {
      onToast?.('Error al actualizar la solicitud', 'error');
    }
    setLoading(null);
  };

  const estatusStyle = {
    Pendiente:  styles.estatusPendiente,
    Autorizado: styles.estatusAutorizado,
    Rechazado:  styles.estatusRechazado,
  }[item.estatus] ?? {};

  return (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemId}>#{String(item.idserviciomovil).padStart(4, '0')}</Text>
        <View style={[styles.estatusBadge, estatusStyle]}>
          <Text style={[styles.estatusText, estatusStyle]}>{item.estatus.toUpperCase()}</Text>
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
        <Text style={styles.campoValor}>
          ${Number(item.costo).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
        </Text>
      </View>

      {item.nombreaprobador && (
        <View style={styles.campo}>
          <Text style={styles.campoLabel}>
            {item.estatus === 'Autorizado' ? 'Autorizado por  ' : 'Rechazado por  '}
          </Text>
          <Text style={styles.campoValor}>{item.nombreaprobador}</Text>
        </View>
      )}

      {item.estatus === 'Pendiente' && (
        <View style={styles.acciones}>
          <TouchableOpacity
            style={[styles.btnAccion, styles.btnAprobar, loading && { opacity: 0.4 }]}
            onPress={() => handleEstatus('Autorizado')}
            disabled={!!loading}
            activeOpacity={0.7}
          >
            {loading === 'Autorizado'
              ? <ActivityIndicator color={PAPER} size="small" />
              : <Text style={styles.btnAprobarText}>Aprobar</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnAccion, styles.btnRechazar, loading && { opacity: 0.4 }]}
            onPress={() => handleEstatus('Rechazado')}
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
    </View>
  );
}

export default function AdminView({ showToast }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('Todos');

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

  const lista = filtro === 'Todos'
    ? solicitudes
    : solicitudes.filter((s) => s.estatus === filtro);

  return (
    <View style={styles.container}>
      {/* Filtros */}
      <View style={styles.filtros}>
        {FILTROS.map((f) => (
          <TouchableOpacity key={f} onPress={() => setFiltro(f)} style={styles.filtroBtn} activeOpacity={0.7}>
            <Text style={[styles.filtroBtnText, filtro === f && styles.filtroBtnActive]}>{f}</Text>
            {filtro === f && <View style={styles.filtroIndicator} />}
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={cargar} style={styles.filtroReload} activeOpacity={0.7}>
          <Text style={styles.filtroBtnText}>↺</Text>
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
          Sin solicitudes{filtro !== 'Todos' ? ` con estatus "${filtro}"` : ''}.
        </Text>
      )}

      <FlatList
        data={lista}
        keyExtractor={(item) => String(item.idserviciomovil)}
        renderItem={({ item }) => (
          <SolicitudItem item={item} onActualizar={handleActualizar} onToast={showToast} />
        )}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Filtros
  filtros: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: INK,
    marginBottom: 8,
  },
  filtroBtn: { paddingHorizontal: 10, paddingVertical: 10, alignItems: 'center' },
  filtroBtnText: {
    fontFamily: sans, fontSize: 9, letterSpacing: 1.5,
    textTransform: 'uppercase', fontWeight: '700', color: INK_MID,
  },
  filtroBtnActive: { color: INK },
  filtroIndicator: {
    position: 'absolute', bottom: -1, left: 0, right: 0,
    height: 3, backgroundColor: INK,
  },
  filtroReload: { marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 8 },

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
  estatusAutorizado: { borderColor: INK, color: INK },
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
