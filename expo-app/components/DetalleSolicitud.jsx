import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, ActivityIndicator, Platform,
} from 'react-native';
import FotoThumb from './FotoThumb';

// Modal de detalle de una solicitud, compartido por admin y mecánico (Expo).
// onAutorizarPago (opcional, solo admin): si se pasa y el pago está rechazado, muestra el
// botón "Autorizar pago" para corregir la decisión.

const INK = '#0a0a0a';
const BRAND = '#046738';
const RED = '#C0202A';
const WARNING = '#E6A100';
const NEUTRAL = '#737373';
const LIME = '#84CC16';
const INK_MID = '#444444';
const INK_LIGHT = '#888888';
const PAPER = '#ffffff';
const PAPER_TINT = '#f2f1ee';

const sans = Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif';
const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

const money = (v) => `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

const displayEstatus = (s) => {
  if (s.estatus === 'Reparado') {
    if (s.autorizacionpago === 1) return 'Pago autorizado';
    if (s.autorizacionpago === 0) return 'Pago rechazado';
  }
  return s.estatus;
};

function parseWall(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
}

function formatFecha(raw) {
  const d = parseWall(raw);
  return d ? d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

const pagoLabel = (s) =>
  s.autorizacionpago === 1 ? 'Autorizado' : s.autorizacionpago === 0 ? 'Rechazado' : 'Pendiente';

const BADGE_COLOR = {
  'Pago autorizado': BRAND,
  Pagado: INK,
  'Pago rechazado': RED,
  Rechazado: RED,
  'En proceso': WARNING,
  Reparado: LIME,
  Pendiente: NEUTRAL,
};

function Campo({ label, children }) {
  if (children == null || children === '') return null;
  return (
    <View style={styles.campo}>
      <Text style={styles.campoLabel}>{label}</Text>
      <Text style={styles.campoValor}>{children}</Text>
    </View>
  );
}

export default function DetalleSolicitud({ solicitud: s, onClose, onAutorizarPago }) {
  const [autorizando, setAutorizando] = useState(false);
  if (!s) return null;

  const est = displayEstatus(s);
  const badgeColor = BADGE_COLOR[est] || NEUTRAL;
  const fotosAp = (s.fotos || []).filter((f) => f.tipo === 'Apertura');
  const fotosCi = (s.fotos || []).filter((f) => f.tipo === 'Cierre');

  const handleAutorizar = async () => {
    setAutorizando(true);
    try { await onAutorizarPago(s.idserviciomovil); } finally { setAutorizando(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.id}>#{String(s.idserviciomovil)}</Text>
            <View style={[styles.badge, { backgroundColor: badgeColor }]}>
              <Text style={styles.badgeText}>{est.toUpperCase()}</Text>
            </View>
            {s.PO != null && (
              <View style={styles.poBox}><Text style={styles.poText}>PO {s.PO}</Text></View>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.cerrar}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 10 }}>
            <Campo label="Solicitante">{s.nombresolicitante}</Campo>
            {s.nombreaprobador ? (
              <Campo label={s.estatus === 'Rechazado' ? 'Rechazado por' : 'Autorizado por'}>{s.nombreaprobador}</Campo>
            ) : null}
            <Campo label="Tipo de unidad">{s.tunidad}</Campo>
            <Campo label="No. económico">{s.numeconomico}</Campo>
            <Campo label="Fecha de solicitud">{formatFecha(s.fechahora)}</Campo>
            {s.fechacierre ? <Campo label="Fecha de cierre">{formatFecha(s.fechacierre)}</Campo> : null}
            {s.odometro != null ? (
              <Campo label="Odómetro">{`${Number(s.odometro).toLocaleString('es-MX')} mi`}</Campo>
            ) : null}
            <Campo label="Costo estimado">{money(s.costo)}</Campo>
            {s.costoreal != null ? <Campo label="Costo real">{money(s.costoreal)}</Campo> : null}
            {s.estatus === 'Reparado' && est !== 'Pago rechazado' && est !== 'Pago autorizado' ? (
              <Campo label="Pago">{pagoLabel(s)}</Campo>
            ) : null}
            {s.autorizacionpago === 1 && s.nombrepagador ? (
              <Campo label="Pago autorizado por">{s.nombrepagador}</Campo>
            ) : null}
            {est === 'Pago rechazado' && s.nombrepagador ? (
              <Campo label="Rechazado por">{s.nombrepagador}</Campo>
            ) : null}
            <Campo label="Descripción">{s.descripcion}</Campo>
            {est === 'Pago rechazado' && s.comentariorechazo ? (
              <Campo label="Motivo del rechazo de pago">{s.comentariorechazo}</Campo>
            ) : null}
            {s.estatus === 'Pagado' && s.comentariocheckbox ? (
              <Campo label="Comentario de pago">{s.comentariocheckbox}</Campo>
            ) : null}

            {fotosAp.length > 0 && (
              <View style={styles.fotoCol}>
                <Text style={styles.campoLabel}>Apertura</Text>
                <View style={styles.fotosRow}>{fotosAp.map((f, i) => <FotoThumb key={i} url={f.url} />)}</View>
              </View>
            )}
            {fotosCi.length > 0 && (
              <View style={styles.fotoCol}>
                <Text style={styles.campoLabel}>Cierre</Text>
                <View style={styles.fotosRow}>{fotosCi.map((f, i) => <FotoThumb key={i} url={f.url} />)}</View>
              </View>
            )}
          </ScrollView>

          {onAutorizarPago && est === 'Pago rechazado' && (
            <TouchableOpacity
              style={[styles.btnAutorizar, autorizando && { opacity: 0.4 }]}
              onPress={handleAutorizar}
              disabled={autorizando}
              activeOpacity={0.7}
            >
              {autorizando
                ? <ActivityIndicator color={PAPER} size="small" />
                : <Text style={styles.btnAutorizarText}>Autorizar pago</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: PAPER, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 22, paddingTop: 18, paddingBottom: 22, maxHeight: '88%',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  id: { fontFamily: mono, fontSize: 15, fontWeight: '700', color: INK },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontFamily: sans, fontSize: 9, fontWeight: '700', letterSpacing: 1, color: PAPER },
  poBox: { backgroundColor: PAPER_TINT, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  poText: { fontFamily: mono, fontSize: 10, color: INK },
  cerrar: { fontFamily: sans, fontSize: 18, color: INK_MID, paddingHorizontal: 4 },

  body: { flexGrow: 0 },
  campo: { marginBottom: 12 },
  campoLabel: {
    fontFamily: sans, fontSize: 9, color: INK_LIGHT, letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: 3,
  },
  campoValor: { fontFamily: serif, fontSize: 15, color: INK, lineHeight: 21 },

  fotoCol: { marginBottom: 12 },
  fotosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },

  btnAutorizar: {
    backgroundColor: BRAND, borderRadius: 999, paddingVertical: 13,
    alignItems: 'center', marginTop: 12,
  },
  btnAutorizarText: { fontFamily: sans, color: PAPER, fontWeight: '700', fontSize: 13, letterSpacing: 1 },
});
