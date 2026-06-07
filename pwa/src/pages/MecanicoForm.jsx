import { useState, useEffect, useCallback } from 'react';
import { getUnidades, crearSolicitud, getMisSolicitudes, cerrarReparacion } from '../services/api';
import { subirFoto } from '../services/uploads';
import Toast from '../components/Toast';
import FotoThumb from '../components/FotoThumb';
import FotoPicker from '../components/FotoPicker';
import { useToast } from '../hooks/useToast';

const TIPOS_UNIDAD = ['Camión', 'Remolque'];
const TIPO_API     = { 'Camión': 'camion', 'Remolque': 'remolque' };
const FILTROS      = ['Todos', 'Pendiente', 'En proceso', 'Reparado', 'Pagado', 'Rechazado', 'Pago rechazado'];

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
  return new Date(raw).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function MisSolicitudes({ refreshKey }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('Todos');

  useEffect(() => {
    setLoading(true);
    getMisSolicitudes()
      .then(({ data }) => setLista(data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <p className="admin-estado">Cargando solicitudes...</p>;

  // Más reciente primero (por id) + filtro por estatus (derivado para el pago)
  const ordenadas = [...lista].sort((a, b) => b.idserviciomovil - a.idserviciomovil);
  const visibles = filtro === 'Todos' ? ordenadas : ordenadas.filter((s) => displayEstatus(s) === filtro);

  return (
    <>
      {/* Filtros por estatus */}
      <div className="admin-filtros">
        {FILTROS.map((f) => (
          <button key={f}
            className={`filtro-btn${filtro === f ? ' filtro-btn--active' : ''}`}
            onClick={() => setFiltro(f)}>
            {f}
          </button>
        ))}
      </div>

      {visibles.length === 0 && (
        <p className="admin-estado">
          {lista.length === 0
            ? 'Aún no tienes solicitudes registradas.'
            : `Sin solicitudes con estatus "${filtro}".`}
        </p>
      )}

      <div className="solicitudes-lista">
        {visibles.map((s) => (
        <div key={s.idserviciomovil} className="solicitud">
          <div className="solicitud__header">
            <span className="solicitud__id">#{String(s.idserviciomovil).padStart(4, '0')}</span>
            <span className={`solicitud__estatus solicitud__estatus--${estatusSlug(displayEstatus(s))}`}>
              {displayEstatus(s)}
            </span>
          </div>
          <div className="solicitud__meta">
            {s.tunidad}&nbsp;&middot;&nbsp;{s.numeconomico}&nbsp;&middot;&nbsp;{formatFecha(s.fechahora)}
          </div>
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
          {s.nombreaprobador && (
            <div className="solicitud__field">
              <span className="solicitud__field-label">
                {s.estatus === 'Rechazado' ? 'Rechazado por' : 'Autorizado por'}
              </span>
              {s.nombreaprobador}
            </div>
          )}
          {(s.urlfoto || s.urlcierre) && (
            <div className="solicitud__fotos">
              {s.urlfoto && <FotoThumb url={s.urlfoto} />}
              {s.urlcierre && <FotoThumb url={s.urlcierre} />}
            </div>
          )}
        </div>
        ))}
      </div>
    </>
  );
}

// ── Reparaciones en proceso (el mecánico cierra el ticket) ─────
function ReparacionesEnProceso({ refreshKey, showToast }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localKey, setLocalKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    getMisSolicitudes()
      .then(({ data }) => setLista((data.data ?? []).filter((s) => s.estatus === 'En proceso')))
      .catch(() => setLista([]))
      .finally(() => setLoading(false));
  }, [refreshKey, localKey]);

  if (loading) return <p className="admin-estado">Cargando reparaciones...</p>;
  if (lista.length === 0) return <p className="admin-estado">No tienes reparaciones en proceso.</p>;

  const ordenadas = [...lista].sort((a, b) => b.idserviciomovil - a.idserviciomovil);

  return (
    <div className="solicitudes-lista">
      {ordenadas.map((s) => (
        <div key={s.idserviciomovil} className="solicitud">
          <div className="solicitud__header">
            <span className="solicitud__id">#{String(s.idserviciomovil).padStart(4, '0')}</span>
            <span className={`solicitud__estatus solicitud__estatus--${estatusSlug(s.estatus)}`}>
              {s.estatus}
            </span>
          </div>
          <div className="solicitud__meta">
            {s.tunidad}&nbsp;&middot;&nbsp;{s.numeconomico}&nbsp;&middot;&nbsp;{formatFecha(s.fechahora)}
          </div>
          <div className="solicitud__field">
            <span className="solicitud__field-label">Descripción</span>
            {s.descripcion}
          </div>
          <div className="solicitud__field">
            <span className="solicitud__field-label">Costo estimado</span>
            {money(s.costo)}
          </div>
          <CerrarTicketForm solicitud={s} showToast={showToast} onClosed={() => setLocalKey((k) => k + 1)} />
        </div>
      ))}
    </div>
  );
}

// ── Formulario de cierre de un ticket ─────────────────────────
function CerrarTicketForm({ solicitud, showToast, onClosed }) {
  const [costoReal, setCostoReal] = useState('');
  const [foto, setFoto] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const costo = parseFloat(costoReal);
    if (costoReal === '' || isNaN(costo) || costo < 0) {
      showToast('Ingresa un costo real válido', 'error');
      return;
    }
    setLoading(true);
    try {
      const urlCierre = foto ? await subirFoto(foto) : undefined;
      await cerrarReparacion(solicitud.idserviciomovil, { costoReal, urlCierre });
      showToast(`Reparación #${String(solicitud.idserviciomovil).padStart(4, '0')} cerrada`);
      onClosed?.();
    } catch {
      showToast('Error al cerrar la reparación', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="cierre-form" onSubmit={submit}>
      <div className="form-group">
        <label className="form-label">Costo real ($)</label>
        <input type="number" min="0" step="0.01" className="form-input"
          value={costoReal} onChange={(e) => setCostoReal(e.target.value)} placeholder="0.00" />
      </div>
      <div className="form-group">
        <label className="form-label">Fotografía del cierre</label>
        <FotoPicker file={foto} onChange={setFoto} disabled={loading} />
      </div>
      <button type="submit" className="btn-submit" disabled={loading}>
        {loading ? 'Cerrando...' : 'Marcar como reparado'}
      </button>
    </form>
  );
}

export default function MecanicoForm({ user }) {
  const [form, setForm] = useState({
    fechaHora: '', tipoUnidad: '', numeroEconomico: '',
    descripcionServicio: '', costoEstimado: '', odometro: '',
  });
  const [unidades, setUnidades] = useState([]);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState('crear');
  const [foto, setFoto] = useState(null);
  const { toast, showToast, hideToast } = useToast();

  const esCamion = form.tipoUnidad === 'Camión';
  const tieneApi = !!TIPO_API[form.tipoUnidad];

  useEffect(() => {
    if (!tieneApi) { setUnidades([]); return; }
    setLoadingUnidades(true);
    setForm((p) => ({ ...p, numeroEconomico: '' }));
    getUnidades(TIPO_API[form.tipoUnidad])
      .then(({ data }) => setUnidades(data.data ?? []))
      .catch(() => setUnidades([]))
      .finally(() => setLoadingUnidades(false));
  }, [form.tipoUnidad]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'tipoUnidad') setForm((p) => ({ ...p, tipoUnidad: value, numeroEconomico: '' }));
    else setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const payload = { ...form };
      if (!esCamion) delete payload.odometro;
      if (foto) payload.urlFoto = await subirFoto(foto);
      await crearSolicitud(payload);
      setStatus(null);
      setForm({ fechaHora: '', tipoUnidad: '', numeroEconomico: '',
                descripcionServicio: '', costoEstimado: '', odometro: '' });
      setFoto(null);
      setUnidades([]);
      setRefreshKey((k) => k + 1);
      setTab('mis');
      showToast('Solicitud enviada correctamente');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error al enviar la solicitud');
      setStatus('error');
      showToast('Error al enviar la solicitud', 'error');
    }
  };

  return (
    <>
      <Toast message={toast.message} type={toast.type} onDismiss={hideToast} />

      {/* ── Pestañas ── */}
      <div className="segmented">
        <button type="button"
          className={`segmented__btn ${tab === 'crear' ? 'segmented__btn--active' : ''}`}
          onClick={() => setTab('crear')}>Crear</button>
        <button type="button"
          className={`segmented__btn ${tab === 'proceso' ? 'segmented__btn--active' : ''}`}
          onClick={() => setTab('proceso')}>En proceso</button>
        <button type="button"
          className={`segmented__btn ${tab === 'mis' ? 'segmented__btn--active' : ''}`}
          onClick={() => setTab('mis')}>Mis solicitudes</button>
      </div>

      {tab === 'crear' ? (
      <form className="form form--full" onSubmit={handleSubmit} autoComplete="off">
        <div className="form-greeting">
          <p className="form-greeting__text">Hola, <strong>{user.nombre}</strong></p>
          <p className="form-greeting__sub">Complete el formulario para solicitar autorización de servicio.</p>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="fechaHora">Fecha y hora</label>
          <input id="fechaHora" type="datetime-local" name="fechaHora"
            value={form.fechaHora} onChange={handleChange} required className="form-input" />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="tipoUnidad">Tipo de unidad</label>
          <select id="tipoUnidad" name="tipoUnidad" value={form.tipoUnidad}
            onChange={handleChange} required className="form-select">
            <option value="">— Seleccionar —</option>
            {TIPOS_UNIDAD.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {esCamion && (
          <div className="form-group">
            <label className="form-label" htmlFor="odometro">Odómetro (km)</label>
            <input id="odometro" type="number" name="odometro" value={form.odometro}
              onChange={handleChange} required min="0" className="form-input" placeholder="0" />
          </div>
        )}

        {form.tipoUnidad && (
          <div className="form-group">
            <label className="form-label" htmlFor="numeroEconomico">Número económico</label>
            <select id="numeroEconomico" name="numeroEconomico" value={form.numeroEconomico}
              onChange={handleChange} required disabled={loadingUnidades} className="form-select">
              <option value="">{loadingUnidades ? 'Cargando...' : '— Seleccionar —'}</option>
              {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="descripcionServicio">Descripción del servicio</label>
          <textarea id="descripcionServicio" name="descripcionServicio" value={form.descripcionServicio}
            onChange={handleChange} required rows={4} className="form-textarea" />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="costoEstimado">Costo estimado ($)</label>
          <input id="costoEstimado" type="number" name="costoEstimado" value={form.costoEstimado}
            onChange={handleChange} required min="0" step="0.01" className="form-input" placeholder="0.00" />
        </div>

        <div className="form-group">
          <label className="form-label">Fotografía</label>
          <FotoPicker file={foto} onChange={setFoto} disabled={status === 'loading'} />
        </div>

        {status === 'error' && <div className="form-error">{errorMsg}</div>}

        <button type="submit" className="btn-submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Enviando...' : 'Solicitar autorización'}
        </button>
      </form>
      ) : tab === 'proceso' ? (
      <div>
        <div className="user-block">
          <p className="user-block__name">Reparaciones en proceso</p>
        </div>
        <ReparacionesEnProceso refreshKey={refreshKey} showToast={showToast} />
      </div>
      ) : (
      <div>
        <div className="user-block">
          <p className="user-block__name">Mis solicitudes</p>
        </div>
        <MisSolicitudes refreshKey={refreshKey} />
      </div>
      )}
    </>
  );
}
