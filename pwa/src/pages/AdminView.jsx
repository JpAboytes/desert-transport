import { useState, useEffect, useCallback } from 'react';
import { getSolicitudes, actualizarEstatus } from '../services/api';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

const ESTATUS_LABEL = {
  Pendiente:  'Pendiente',
  Autorizado: 'Autorizado',
  Rechazado:  'Rechazado',
};

function formatFecha(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function SolicitudRow({ s, onActualizar, onToast }) {
  const [loading, setLoading] = useState(null);

  const handleEstatus = async (estatus) => {
    setLoading(estatus);
    try {
      await onActualizar(s.idserviciomovil, estatus);
      onToast(`Solicitud #${String(s.idserviciomovil).padStart(4,'0')} ${estatus.toLowerCase()}`);
    } catch {
      onToast('Error al actualizar la solicitud', 'error');
    }
    setLoading(null);
  };

  return (
    <div className="solicitud">
      <div className="solicitud__header">
        <span className="solicitud__id">#{String(s.idserviciomovil).padStart(4, '0')}</span>
        <span className={`solicitud__estatus solicitud__estatus--${s.estatus.toLowerCase()}`}>
          {ESTATUS_LABEL[s.estatus] ?? s.estatus}
        </span>
      </div>

      <div className="solicitud__meta">
        {s.nombresolicitante}&nbsp;&middot;&nbsp;{s.tunidad}&nbsp;&middot;&nbsp;{s.numeconomico}&nbsp;&middot;&nbsp;{formatFecha(s.fechahora)}
      </div>

      {s.nombreaprobador && (
        <div className="solicitud__field">
          <span className="solicitud__field-label">
            {s.estatus === 'Autorizado' ? 'Autorizado por' : 'Rechazado por'}
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
        ${Number(s.costo).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
      </div>

      {s.estatus === 'Pendiente' && (
        <div className="solicitud__actions">
          <button
            className="btn-accion btn-accion--aprobar"
            onClick={() => handleEstatus('Autorizado')}
            disabled={!!loading}
          >
            {loading === 'Autorizado' ? '...' : 'Aprobar'}
          </button>
          <button
            className="btn-accion btn-accion--rechazar"
            onClick={() => handleEstatus('Rechazado')}
            disabled={!!loading}
          >
            {loading === 'Rechazado' ? '...' : 'Rechazar'}
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

  const lista = filtro === 'Todos'
    ? solicitudes
    : solicitudes.filter((s) => s.estatus === filtro);

  return (
    <div>
      <Toast message={toast.message} type={toast.type} onDismiss={hideToast} />

      {/* Barra de filtros */}
      <div className="admin-filtros">
        {['Todos', 'Pendiente', 'Autorizado', 'Rechazado'].map((f) => (
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
          <SolicitudRow key={s.idserviciomovil} s={s} onActualizar={handleActualizar} onToast={showToast} />
        ))}
      </div>
    </div>
  );
}
