import { useState, useEffect, useCallback } from 'react';
import { getSolicitudes, actualizarEstatus, autorizarPago } from '../services/api';
import Toast from '../components/Toast';
import FotoThumb from '../components/FotoThumb';
import BotonNotificaciones from '../components/BotonNotificaciones';
import ReportesAdmin from '../components/ReportesAdmin';
import { useToast } from '../hooks/useToast';

const ESTATUS_LABEL = {
  Pendiente:        'Pendiente',
  'En proceso':     'En proceso',
  Reparado:         'Reparado',
  'Pago autorizado':'Pago autorizado',
  Rechazado:        'Rechazado',
  'Pago rechazado': 'Pago rechazado',
};

const FILTROS = ['Todos', 'Pendiente', 'En proceso', 'Reparado', 'Pago autorizado', 'Rechazado', 'Pago rechazado'];
const FILTROS_FECHA = ['Todo', 'Hoy', 'Últimos 7 días', 'Últimos 30 días'];
const POR_PAGINA = 10;

// slug para la clase CSS del badge ('En proceso' -> 'en-proceso')
const estatusSlug = (e) => e.toLowerCase().replace(/\s+/g, '-');
const money = (v) => `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

// Filtro por rango de fecha (presets). 'Hoy' = mismo día; N días = últimos N días.
function dentroDeRango(raw, rango) {
  if (rango === 'Todo') return true;
  const f = parseWall(raw);
  if (!f) return false;
  if (rango === 'Hoy') return f.toDateString() === new Date().toDateString();
  const dias = rango === 'Últimos 7 días' ? 7 : 30;
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);
  return f >= limite;
}

// Bloque de fotos colapsable (Apertura/Cierre): oculto por defecto.
function FotosColapsables({ fotos }) {
  const [abierto, setAbierto] = useState(false);
  if (!fotos?.length) return null;
  return (
    // stopPropagation: la tarjeta del admin abre el modal de detalle al hacer clic
    <div className="fotos-colapsables" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="fotos-toggle" onClick={() => setAbierto((a) => !a)}>
        {abierto ? 'Ocultar imágenes' : `Ver imágenes (${fotos.length})`}
      </button>
      {abierto && (
        <div className="solicitud__fotos">
          {['Apertura', 'Cierre'].map((tipo) => {
            const fs = fotos.filter((f) => f.tipo === tipo);
            if (fs.length === 0) return null;
            return (
              <div key={tipo} className="solicitud__foto-col">
                <span className="solicitud__field-label">{tipo}</span>
                <div className="solicitud__fotos-row">
                  {fs.map((f, i) => <FotoThumb key={i} url={f.url} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Estatus para mostrar: el pago se deriva del booleano autorizacionpago
// (NULL = esperando pago → 'Reparado'; 1 = 'Pago autorizado'; 0 = 'Pago rechazado').
const displayEstatus = (s) => {
  if (s.estatus === 'Reparado') {
    if (s.autorizacionpago === 1) return 'Pago autorizado';
    if (s.autorizacionpago === 0) return 'Pago rechazado';
  }
  return s.estatus;
};

// Hora de pared: interpreta el DATETIME guardado tal cual, SIN convertir zona horaria.
// Acepta "2026-06-22 11:36:00" o el ISO con 'Z' que serializa el backend.
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

// Etiqueta de la decisión de pago (solo aplica a tickets cerrados).
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

// Modal con el detalle completo de una solicitud (se abre al hacer clic en la tarjeta).
function DetalleSolicitud({ s, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const est = displayEstatus(s);

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
        </div>

        <div className="detalle-dato detalle-dato--full">
          <span className="solicitud__field-label">Descripción</span>
          <span className="detalle-dato__valor">{s.descripcion}</span>
        </div>

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
      </div>
    </div>
  );
}

function SolicitudRow({ s, onActualizar, onPago, onToast, onVerDetalle }) {
  const [loading, setLoading] = useState(null);
  const est = displayEstatus(s);

  const handleEstatus = async (estatus, etiqueta) => {
    setLoading(estatus);
    try {
      await onActualizar(s.idserviciomovil, estatus);
      onToast(`Solicitud #${String(s.idserviciomovil)} ${etiqueta}`);
    } catch (e) {
      onToast(e?.response?.data?.message || 'Error al actualizar la solicitud', 'error');
    }
    setLoading(null);
  };

  const handlePago = async (aprobado) => {
    const key = aprobado ? 'pago-si' : 'pago-no';
    setLoading(key);
    try {
      await onPago(s.idserviciomovil, aprobado);
      onToast(`Pago de #${String(s.idserviciomovil)} ${aprobado ? 'autorizado' : 'rechazado'}`);
    } catch (e) {
      onToast(e?.response?.data?.message || 'Error al registrar el pago', 'error');
    }
    setLoading(null);
  };

  return (
    <div className="solicitud solicitud--clickable" onClick={() => onVerDetalle(s)}>
      <div className="solicitud__header">
        <span className="solicitud__id">#{String(s.idserviciomovil)}</span>
        <span className={`solicitud__estatus solicitud__estatus--${estatusSlug(est)}`}>
          {ESTATUS_LABEL[est] ?? est}
        </span>
        {s.PO != null && <span className="po-box">PO {s.PO}</span>}
      </div>

      <div className="solicitud__meta">
        {s.nombresolicitante}&nbsp;&middot;&nbsp;{s.tunidad}&nbsp;&middot;&nbsp;{s.numeconomico}&nbsp;&middot;&nbsp;{formatFecha(s.fechahora)}
      </div>

      {s.nombreaprobador && (
        <div className="solicitud__field">
          <span className="solicitud__field-label">
            {s.estatus === 'Rechazado' ? 'Rechazado por' : 'Autorizado por'}
          </span>
          {s.nombreaprobador}
        </div>
      )}

      {s.odometro != null && (
        <div className="solicitud__field">
          <span className="solicitud__field-label">Odómetro</span>
          {Number(s.odometro).toLocaleString('es-MX')} mi
        </div>
      )}

      <div className="solicitud__field">
        <span className="solicitud__field-label">Descripción</span>
        {s.descripcion}
      </div>

      <div className="solicitud__field">
        <span className="solicitud__field-label">Costo estimado</span>
        {money(s.costo)}
      </div>

      {s.costoreal != null && (
        <div className="solicitud__field">
          <span className="solicitud__field-label">Costo real</span>
          {money(s.costoreal)}
        </div>
      )}

      <FotosColapsables fotos={s.fotos} />

      {s.estatus === 'Pendiente' && (
        <div className="solicitud__actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="btn-accion btn-accion--aprobar"
            onClick={() => handleEstatus('En proceso', 'autorizada')}
            disabled={!!loading}
          >
            {loading === 'En proceso' ? '...' : 'Aprobar'}
          </button>
          <button
            className="btn-accion btn-accion--rechazar"
            onClick={() => handleEstatus('Rechazado', 'rechazada')}
            disabled={!!loading}
          >
            {loading === 'Rechazado' ? '...' : 'Rechazar'}
          </button>
        </div>
      )}

      {est === 'Reparado' && (
        <div className="solicitud__actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="btn-accion btn-accion--aprobar"
            onClick={() => handlePago(true)}
            disabled={!!loading}
          >
            {loading === 'pago-si' ? '...' : 'Autorizar pago'}
          </button>
          <button
            className="btn-accion btn-accion--rechazar"
            onClick={() => handlePago(false)}
            disabled={!!loading}
          >
            {loading === 'pago-no' ? '...' : 'Rechazar pago'}
          </button>
        </div>
      )}

      {/* Pago rechazado: permite corregir la decisión y autorizar el pago. */}
      {est === 'Pago rechazado' && (
        <div className="solicitud__actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="btn-accion btn-accion--aprobar"
            onClick={() => handlePago(true)}
            disabled={!!loading}
          >
            {loading === 'pago-si' ? '...' : 'Autorizar pago'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminView() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('Todos');
  const [filtroFecha, setFiltroFecha] = useState('Todo');
  const [tab, setTab] = useState('solicitudes');
  const [detalleId, setDetalleId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(POR_PAGINA);
  const { toast, showToast, hideToast } = useToast();

  // Al cambiar los filtros se vuelve a la primera página.
  useEffect(() => { setVisibleCount(POR_PAGINA); }, [filtro, filtroFecha]);

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
    try {
      await actualizarEstatus(id, estatus);
      setSolicitudes((prev) =>
        prev.map((s) => s.idserviciomovil === id ? { ...s, estatus } : s)
      );
    } catch (e) {
      cargar(); // el estado en BD difiere del de la lista (p. ej. 409): resincronizar
      throw e;  // que el child muestre el mensaje real del servidor
    }
  };

  const handlePago = async (id, aprobado) => {
    try {
      await autorizarPago(id, aprobado);
      setSolicitudes((prev) =>
        prev.map((s) => s.idserviciomovil === id ? { ...s, autorizacionpago: aprobado ? 1 : 0 } : s)
      );
    } catch (e) {
      cargar();
      throw e;
    }
  };

  // El modal guarda solo el id: así el detalle se refresca si la solicitud cambia.
  const detalle = solicitudes.find((s) => s.idserviciomovil === detalleId);

  const lista = solicitudes.filter((s) =>
    (filtro === 'Todos' || displayEstatus(s) === filtro) &&
    dentroDeRango(s.fechahora, filtroFecha)
  );
  const visibles = lista.slice(0, visibleCount);

  return (
    <div>
      <Toast message={toast.message} type={toast.type} onDismiss={hideToast} />

      <BotonNotificaciones showToast={showToast} />

      {/* Pestañas del administrador (mismo patrón que MecanicoForm) */}
      <div className="segmented">
        <button
          type="button"
          className={`segmented__btn ${tab === 'solicitudes' ? 'segmented__btn--active' : ''}`}
          onClick={() => setTab('solicitudes')}
        >
          Solicitudes
        </button>
        <button
          type="button"
          className={`segmented__btn ${tab === 'reportes' ? 'segmented__btn--active' : ''}`}
          onClick={() => setTab('reportes')}
        >
          Reportes
        </button>
      </div>

      {tab === 'reportes' ? (
        <ReportesAdmin />
      ) : (
        <>
      {/* Filtros (estatus + fecha) */}
      <div className="filtros-select">
        <label className="filtros-select__group">
          <span className="filtros-select__label">Estatus</span>
          <select className="form-select" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            {FILTROS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label className="filtros-select__group">
          <span className="filtros-select__label">Fecha</span>
          <select className="form-select" value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)}>
            {FILTROS_FECHA.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <button className="filtro-btn filtro-btn--reload" onClick={cargar} title="Recargar">↺</button>
      </div>

      {loading && <p className="admin-estado">Cargando solicitudes...</p>}
      {error   && <div className="form-error">{error}</div>}

      {!loading && !error && lista.length === 0 && (
        <p className="admin-estado">Sin solicitudes con los filtros seleccionados.</p>
      )}

      <div className="solicitudes-lista">
        {visibles.map((s) => (
          <SolicitudRow
            key={s.idserviciomovil}
            s={s}
            onActualizar={handleActualizar}
            onPago={handlePago}
            onToast={showToast}
            onVerDetalle={(sol) => setDetalleId(sol.idserviciomovil)}
          />
        ))}
      </div>

      {lista.length > visibleCount && (
        <button type="button" className="btn-ver-mas" onClick={() => setVisibleCount((c) => c + POR_PAGINA)}>
          Ver más solicitudes ({lista.length - visibleCount})
        </button>
      )}
        </>
      )}

      {detalle && <DetalleSolicitud s={detalle} onClose={() => setDetalleId(null)} />}
    </div>
  );
}
