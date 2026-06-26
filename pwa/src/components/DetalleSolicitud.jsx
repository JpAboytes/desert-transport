import { useEffect, useState } from 'react';
import FotoThumb from './FotoThumb';

// Modal de detalle de una solicitud, reutilizado por admin y mecánico.
// onAutorizarPago (opcional, solo admin): si se pasa y el pago está rechazado, muestra el
// botón "Autorizar pago" para corregir la decisión.

const ESTATUS_LABEL = {
  Pendiente:        'Pendiente',
  'En proceso':     'En proceso',
  Reparado:         'Reparado',
  'Pago autorizado':'Pago autorizado',
  Rechazado:        'Rechazado',
  'Pago rechazado': 'Pago rechazado',
};

const estatusSlug = (e) => e.toLowerCase().replace(/\s+/g, '-');
const money = (v) => `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

const displayEstatus = (s) => {
  if (s.estatus === 'Reparado') {
    if (s.autorizacionpago === 1) return 'Pago autorizado';
    if (s.autorizacionpago === 0) return 'Pago rechazado';
  }
  return s.estatus;
};

// Hora de pared: interpreta el DATETIME guardado tal cual, sin convertir zona horaria.
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

const pagoLabel = (s) => {
  if (s.autorizacionpago === 1) return 'Autorizado';
  if (s.autorizacionpago === 0) return 'Rechazado';
  return 'Pendiente';
};

function Dato({ label, children }) {
  return (
    <div className="detalle-dato">
      <span className="solicitud__field-label">{label}</span>
      <span className="detalle-dato__valor">{children}</span>
    </div>
  );
}

export default function DetalleSolicitud({ s, onClose, onAutorizarPago }) {
  const [autorizando, setAutorizando] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const est = displayEstatus(s);

  const handleAutorizar = async () => {
    setAutorizando(true);
    try { await onAutorizarPago(s.idserviciomovil); } finally { setAutorizando(false); }
  };

  return (
    <div className="detalle-modal" onClick={onClose}>
      <div className="detalle-modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="detalle-modal__header">
          <span className="solicitud__id">#{String(s.idserviciomovil)}</span>
          <span className={`solicitud__estatus solicitud__estatus--${estatusSlug(est)}`}>
            {ESTATUS_LABEL[est] ?? est}
          </span>
          {s.PO != null && <span className="po-box">PO {s.PO}</span>}
          <button type="button" className="detalle-modal__cerrar" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="detalle-modal__grid">
          <Dato label="Solicitante">{s.nombresolicitante}</Dato>
          {s.nombreaprobador && (
            <Dato label={s.estatus === 'Rechazado' ? 'Rechazado por' : 'Autorizado por'}>
              {s.nombreaprobador}
            </Dato>
          )}
          <Dato label="Tipo de unidad">{s.tunidad}</Dato>
          <Dato label="No. económico">{s.numeconomico}</Dato>
          <Dato label="Fecha de solicitud">{formatFecha(s.fechahora)}</Dato>
          {s.fechacierre && <Dato label="Fecha de cierre">{formatFecha(s.fechacierre)}</Dato>}
          {s.odometro != null && (
            <Dato label="Odómetro">{Number(s.odometro).toLocaleString('es-MX')} mi</Dato>
          )}
          <Dato label="Costo estimado">{money(s.costo)}</Dato>
          {s.costoreal != null && <Dato label="Costo real">{money(s.costoreal)}</Dato>}
          {s.estatus === 'Reparado' && <Dato label="Pago">{pagoLabel(s)}</Dato>}
          {est === 'Pago rechazado' && s.nombrepagador && (
            <Dato label="Rechazado por">{s.nombrepagador}</Dato>
          )}
        </div>

        <div className="detalle-dato detalle-dato--full">
          <span className="solicitud__field-label">Descripción</span>
          <span className="detalle-dato__valor">{s.descripcion}</span>
        </div>

        {est === 'Pago rechazado' && s.comentariorechazo && (
          <div className="detalle-dato detalle-dato--full">
            <span className="solicitud__field-label">Motivo del rechazo de pago</span>
            <span className="detalle-dato__valor">{s.comentariorechazo}</span>
          </div>
        )}

        {s.fotos?.length > 0 && (
          <div className="solicitud__fotos">
            {['Apertura', 'Cierre'].map((tipo) => {
              const fs = s.fotos.filter((f) => f.tipo === tipo);
              if (fs.length === 0) return null;
              return (
                <div key={tipo} className="solicitud__foto-col">
                  <span className="solicitud__field-label">{tipo}</span>
                  <div className="solicitud__fotos-row">
                    {fs.map((f, i) => <FotoThumb key={i} url={f.url} size={72} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {onAutorizarPago && est === 'Pago rechazado' && (
          <div className="solicitud__actions" style={{ marginTop: 18 }}>
            <button
              className="btn-accion btn-accion--aprobar"
              onClick={handleAutorizar}
              disabled={autorizando}
            >
              {autorizando ? '...' : 'Autorizar pago'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
