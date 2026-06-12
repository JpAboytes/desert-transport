import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { getSolicitudes } from '../services/solicitudes';

const INK        = '#0a0a0a';
const BRAND      = '#046738';
const BROWN      = '#553111';
const INK_MID    = '#444444';
const INK_LIGHT  = '#888888';
const RULE       = '#bbbbbb';
const PAPER      = '#ffffff';
const PAPER_TINT = '#f2f1ee';

const sans  = Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif';
const mono  = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const TIPOS_PERIODO = ['Semanal', 'Mensual'];
const ESTATUS_KPI = ['Pendiente', 'En proceso', 'Reparado', 'Pagado', 'Rechazado', 'Pago rechazado'];

const money = (v) => `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

// Estatus para mostrar: el pago se deriva del booleano autorizacionpago
// (NULL = esperando pago → 'Reparado'; 1 = 'Pagado'; 0 = 'Pago rechazado').
const displayEstatus = (s) => {
  if (s.estatus === 'Reparado') {
    if (s.autorizacionpago === 1) return 'Pagado';
    if (s.autorizacionpago === 0) return 'Pago rechazado';
  }
  return s.estatus;
};

// Rango [inicio, fin) del periodo. Semanal = lunes a domingo; Mensual = mes calendario.
// offset 0 = periodo actual, -1 = anterior, etc.
function rangoPeriodo(tipo, offset) {
  const hoy = new Date();
  if (tipo === 'Semanal') {
    const inicio = new Date(hoy);
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7) + offset * 7);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 7);
    return { inicio, fin };
  }
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() + offset, 1);
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + offset + 1, 1);
  return { inicio, fin };
}

function etiquetaPeriodo(tipo, { inicio, fin }) {
  if (tipo === 'Mensual') {
    const txt = inicio.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }
  const ultimo = new Date(fin);
  ultimo.setDate(ultimo.getDate() - 1);
  const f = (d) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  return `${f(inicio)} — ${f(ultimo)} ${ultimo.getFullYear()}`;
}

const enPeriodo = (raw, { inicio, fin }) => {
  if (!raw) return false;
  const f = new Date(raw);
  return f >= inicio && f < fin;
};

const formatFechaCorta = (raw) =>
  raw ? new Date(raw).toLocaleDateString('es-MX', { dateStyle: 'short' }) : '—';

// ── Reporte 1: KPIs de tickets por estatus ────────────────────
function ReporteKpis({ solicitudes, rango }) {
  const delPeriodo = solicitudes.filter((s) => enPeriodo(s.fechahora, rango));
  const total = delPeriodo.length;
  const conteos = ESTATUS_KPI.map((est) => ({
    estatus: est,
    n: delPeriodo.filter((s) => displayEstatus(s) === est).length,
  }));

  return (
    <View style={styles.reporte}>
      <Text style={styles.reporteTitulo}>Tickets por estatus</Text>
      <Text style={styles.reporteNota}>Por fecha de solicitud</Text>

      {conteos.map(({ estatus, n }) => (
        <View key={estatus} style={styles.kpiRow}>
          <Text style={styles.kpiLabel}>{estatus}</Text>
          <View style={styles.kpiBarTrack}>
            {total > 0 && n > 0 && (
              <View style={[styles.kpiBar, { flex: n / total }]} />
            )}
            <View style={{ flex: total > 0 ? 1 - n / total : 1 }} />
          </View>
          <Text style={styles.kpiValor}>{n}</Text>
          <Text style={styles.kpiPct}>{total > 0 ? `${Math.round((n / total) * 100)}%` : '—'}</Text>
        </View>
      ))}

      <View style={[styles.kpiRow, styles.kpiTotalRow]}>
        <Text style={[styles.kpiLabel, { fontWeight: '700', color: INK }]}>Total</Text>
        <View style={styles.kpiBarTrack} />
        <Text style={[styles.kpiValor, { fontWeight: '700' }]}>{total}</Text>
        <Text style={styles.kpiPct}>{total > 0 ? '100%' : '—'}</Text>
      </View>
    </View>
  );
}

// ── Reporte 2: cuentas por pagar (pagos autorizados) ──────────
// Solo tickets con pago AUTORIZADO (autorizacionpago = 1). El periodo se
// determina por la fecha de cierre de la reparación (no hay timestamp de
// la decisión de pago en la BD).
function ReporteCuentasPorPagar({ solicitudes, rango }) {
  const pagados = solicitudes
    .filter((s) => s.autorizacionpago === 1 && enPeriodo(s.fechacierre, rango))
    .sort((a, b) => new Date(a.fechacierre) - new Date(b.fechacierre));

  const totalMonto = pagados.reduce((acc, s) => acc + Number(s.costoreal ?? s.costo ?? 0), 0);

  return (
    <View style={styles.reporte}>
      <Text style={styles.reporteTitulo}>Cuentas por pagar</Text>
      <Text style={styles.reporteNota}>Pagos autorizados · por fecha de cierre · costo real</Text>

      {pagados.length === 0 && (
        <Text style={styles.empty}>Sin pagos autorizados en este periodo.</Text>
      )}

      {pagados.map((s) => (
        <View key={s.idserviciomovil} style={styles.cxpRow}>
          <View style={styles.cxpInfo}>
            <Text style={styles.cxpId}>
              #{String(s.idserviciomovil)}{s.PO != null ? `  ·  PO ${s.PO}` : ''}
            </Text>
            <Text style={styles.cxpMeta}>
              {s.tunidad} · {s.numeconomico} · cierre {formatFechaCorta(s.fechacierre)}
            </Text>
          </View>
          <Text style={styles.cxpMonto}>{money(s.costoreal ?? s.costo)}</Text>
        </View>
      ))}

      {pagados.length > 0 && (
        <View style={styles.cxpTotalRow}>
          <Text style={styles.cxpTotalLabel}>Total ({pagados.length} {pagados.length === 1 ? 'ticket' : 'tickets'})</Text>
          <Text style={styles.cxpTotalMonto}>{money(totalMonto)}</Text>
        </View>
      )}
    </View>
  );
}

export default function ReportesAdmin() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tipoPeriodo, setTipoPeriodo] = useState('Semanal');
  const [offset, setOffset] = useState(0);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getSolicitudes();
      setSolicitudes(data.data ?? []);
    } catch {
      setError('Error al cargar los datos del reporte.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const rango = rangoPeriodo(tipoPeriodo, offset);

  return (
    <View style={styles.container}>
      {/* Selector de tipo de periodo */}
      <View style={styles.periodoTipos}>
        {TIPOS_PERIODO.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.periodoTipo, tipoPeriodo === t && styles.periodoTipoActivo]}
            onPress={() => { setTipoPeriodo(t); setOffset(0); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.periodoTipoText, tipoPeriodo === t && styles.periodoTipoTextActivo]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={cargar} style={styles.reloadBtn} activeOpacity={0.7}>
          <Text style={styles.reloadText}>↺</Text>
        </TouchableOpacity>
      </View>

      {/* Navegación del periodo */}
      <View style={styles.periodoNav}>
        <TouchableOpacity onPress={() => setOffset((o) => o - 1)} style={styles.navBtn} activeOpacity={0.7}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.periodoLabelBox}>
          <Text style={styles.periodoLabel}>{etiquetaPeriodo(tipoPeriodo, rango)}</Text>
          {offset === 0 && <Text style={styles.periodoActual}>PERIODO ACTUAL</Text>}
        </View>
        <TouchableOpacity
          onPress={() => setOffset((o) => Math.min(0, o + 1))}
          style={[styles.navBtn, offset === 0 && { opacity: 0.3 }]}
          disabled={offset === 0}
          activeOpacity={0.7}
        >
          <Text style={styles.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color={INK} style={{ marginTop: 32 }} />}

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && (
        <>
          <ReporteKpis solicitudes={solicitudes} rango={rango} />
          <ReporteCuentasPorPagar solicitudes={solicitudes} rango={rango} />
        </>
      )}
    </View>
  );
}

// Sombra suave estilo iOS para tarjetas y botones destacados.
const CARD_SHADOW = {
  shadowColor: INK,
  shadowOpacity: 0.06,
  shadowOffset: { width: 0, height: 4 },
  shadowRadius: 12,
  elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Selector Semanal / Mensual (pills)
  periodoTipos: { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginBottom: 14 },
  periodoTipo: {
    flex: 1, backgroundColor: PAPER_TINT, borderRadius: 12,
    paddingVertical: 11, alignItems: 'center',
  },
  periodoTipoActivo: { backgroundColor: INK, ...CARD_SHADOW },
  periodoTipoText: {
    fontFamily: sans, fontSize: 10, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase', color: INK,
  },
  periodoTipoTextActivo: { color: PAPER },
  reloadBtn: { backgroundColor: PAPER_TINT, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  reloadText: { fontFamily: sans, fontSize: 16, color: INK, lineHeight: 18 },

  // Navegación del periodo (◀ etiqueta ▶)
  periodoNav: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4,
  },
  navBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: PAPER_TINT,
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnText: { fontFamily: sans, fontSize: 20, lineHeight: 22, color: INK },
  periodoLabelBox: { flex: 1, alignItems: 'center' },
  periodoLabel: { fontFamily: serif, fontSize: 16, fontWeight: '700', color: INK },
  periodoActual: {
    fontFamily: sans, fontSize: 8, letterSpacing: 2, color: BRAND,
    fontWeight: '700', marginTop: 2,
  },

  // Bloques de reporte (tarjetas iOS)
  reporte: {
    marginTop: 20, backgroundColor: PAPER, borderRadius: 16, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: RULE, ...CARD_SHADOW,
  },
  reporteTitulo: {
    fontFamily: serif, fontSize: 18, fontWeight: '700', color: INK,
  },
  reporteNota: {
    fontFamily: sans, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
    color: INK_LIGHT, marginTop: 2, marginBottom: 12,
  },

  // Filas KPI
  kpiRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: RULE, paddingVertical: 10,
  },
  kpiTotalRow: { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: INK },
  kpiLabel: {
    width: 110, fontFamily: sans, fontSize: 10, letterSpacing: 1,
    textTransform: 'uppercase', fontWeight: '700', color: INK_MID,
  },
  kpiBarTrack: {
    flex: 1, flexDirection: 'row', height: 8, backgroundColor: PAPER_TINT,
    borderRadius: 4, overflow: 'hidden',
  },
  kpiBar: { backgroundColor: BRAND, borderRadius: 4 },
  kpiValor: { width: 32, fontFamily: mono, fontSize: 14, color: INK, textAlign: 'right' },
  kpiPct: { width: 42, fontFamily: mono, fontSize: 11, color: INK_LIGHT, textAlign: 'right' },

  // Filas cuentas por pagar
  cxpRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: RULE, paddingVertical: 10,
  },
  cxpInfo: { flex: 1 },
  cxpId: { fontFamily: mono, fontSize: 13, fontWeight: '700', color: INK },
  cxpMeta: {
    fontFamily: sans, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase',
    color: INK_MID, marginTop: 2,
  },
  cxpMonto: { fontFamily: mono, fontSize: 14, color: INK },
  cxpTotalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: INK, paddingVertical: 12,
  },
  cxpTotalLabel: {
    fontFamily: sans, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
    fontWeight: '700', color: INK,
  },
  cxpTotalMonto: { fontFamily: mono, fontSize: 16, fontWeight: '700', color: BRAND },

  errorBox: {
    borderLeftWidth: 3, borderLeftColor: INK, borderRadius: 12,
    backgroundColor: PAPER_TINT, padding: 12, marginVertical: 16,
  },
  errorText: { fontFamily: sans, fontSize: 13, color: INK },
  empty: { fontFamily: sans, fontSize: 12, color: INK_MID, fontStyle: 'italic', marginTop: 4 },
});
