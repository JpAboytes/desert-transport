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
const FILTROS_FECHA = ['Todo', 'Hoy', 'Últimos 7 días', 'Últimos 30 días'];

// slug para la clase CSS del badge ('En proceso' -> 'en-proceso')
const estatusSlug = (e) => e.toLowerCase().replace(/\s+/g, '-');
const money = (v) => `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

// Filtro por rango de fecha (presets). 'Hoy' = mismo día; N días = últimos N días.
function dentroDeRango(raw, rango) {
  if (rango === 'Todo') return true;
  if (!raw) return false;
  const f = new Date(raw);
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
    <div className="fotos-colapsables">
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
    <div className="solicitud">
      <div className="solicitud__header">
        <span className="solicitud__id">#{String(s.idserviciomovil)}</span>
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

      <FotosColapsables fotos={s.fotos} />

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
  const [filtroFecha, setFiltroFecha] = useState('Todo');
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

  const lista = solicitudes.filter((s) =>
    (filtro === 'Todos' || displayEstatus(s) === filtro) &&
    dentroDeRango(s.fechahora, filtroFecha)
  );

  return (
    <div>
      <Toast message={toast.message} type={toast.type} onDismiss={hideToast} />

      <BotonNotificaciones showToast={showToast} />

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
        {lista.map((s) => (
          <SolicitudRow key={s.idserviciomovil} s={s} onActualizar={handleActualizar} onPago={handlePago} onToast={showToast} />
        ))}
      </div>
    </div>
  );
}
