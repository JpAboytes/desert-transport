import { useState, useEffect, useCallback } from 'react';
import { getSolicitudes, actualizarEstatus, autorizarPago } from '../services/api';
import Toast from '../components/Toast';
import FotoThumb from '../components/FotoThumb';
import BotonNotificaciones from '../components/BotonNotificaciones';
import { useToast } from '../hooks/useToast';

const ESTATUS_LABEL = {
  Pendiente:        'Pendiente',
  'En proceso':     'En proceso',
  Reparado:         'Reparado',
  Pagado:           'Pagado',
  Rechazado:        'Rechazado',
  'Pago rechazado': 'Pago rechazado',
};

const FILTROS = ['Todos', 'Pendiente', 'En proceso', 'Reparado', 'Pagado', 'Rechazado', 'Pago rechazado'];

// slug para la clase CSS del badge ('En proceso' -> 'en-proceso')
const estatusSlug = (e) => e.toLowerCase().replace(/\s+/g, '-');
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

function formatFecha(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function SolicitudRow({ s, onActualizar, onPago, onToast }) {
  const [loading, setLoading] = useState(null);
  const est = displayEstatus(s);

  const handleEstatus = async (estatus, etiqueta) => {
    setLoading(estatus);
    try {
      await onActualizar(s.idserviciomovil, estatus);
      onToast(`Solicitud #${String(s.idserviciomovil).padStart(4,'0')} ${etiqueta}`);
    } catch {
      onToast('Error al actualizar la solicitud', 'error');
    }
    setLoading(null);
  };

  const handlePago = async (aprobado) => {
    const key = aprobado ? 'pago-si' : 'pago-no';
    setLoading(key);
    try {
      await onPago(s.idserviciomovil, aprobado);
      onToast(`Pago de #${String(s.idserviciomovil).padStart(4,'0')} ${aprobado ? 'autorizado' : 'rechazado'}`);
    } catch {
      onToast('Error al registrar el pago', 'error');
    }
    setLoading(null);
  };

  return (
    <div className="solicitud">
      <div className="solicitud__header">
        <span className="solicitud__id">#{String(s.idserviciomovil).padStart(4, '0')}</span>
        <span className={`solicitud__estatus solicitud__estatus--${estatusSlug(est)}`}>
          {ESTATUS_LABEL[est] ?? est}
        </span>
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
          {Number(s.odometro).toLocaleString('es-MX')} km
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

      {s.fotos?.length > 0 && (
        <div className="solicitud__fotos">
          {['Apertura', 'Cierre'].map((tipo) => {
            const fs = s.fotos.filter((f) => f.tipo === tipo);
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

      {s.estatus === 'Pendiente' && (
        <div className="solicitud__actions">
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
        <div className="solicitud__actions">
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
    </div>
  );
}

export default function AdminView() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('Todos');
  const { toast, showToast, hideToast } = useToast();

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

  const lista = filtro === 'Todos'
    ? solicitudes
    : solicitudes.filter((s) => displayEstatus(s) === filtro);

  return (
    <div>
      <Toast message={toast.message} type={toast.type} onDismiss={hideToast} />

      <BotonNotificaciones showToast={showToast} />

      {/* Barra de filtros */}
      <div className="admin-filtros">
        {FILTROS.map((f) => (
          <button
            key={f}
            className={`filtro-btn${filtro === f ? ' filtro-btn--active' : ''}`}
            onClick={() => setFiltro(f)}
          >
            {f}
          </button>
        ))}
        <button className="filtro-btn filtro-btn--reload" onClick={cargar} title="Recargar">
          ↺
        </button>
      </div>

      {loading && <p className="admin-estado">Cargando solicitudes...</p>}
      {error   && <div className="form-error">{error}</div>}

      {!loading && !error && lista.length === 0 && (
        <p className="admin-estado">Sin solicitudes{filtro !== 'Todos' ? ` con estatus "${filtro}"` : ''}.</p>
      )}

      <div className="solicitudes-lista">
        {lista.map((s) => (
          <SolicitudRow key={s.idserviciomovil} s={s} onActualizar={handleActualizar} onPago={handlePago} onToast={showToast} />
        ))}
      </div>
    </div>
  );
}
