import { useState, useEffect } from 'react';
import { getUnidades, crearSolicitud } from '../services/api';

const TIPOS_UNIDAD = ['Camión', 'Remolque'];

// Tipos que cargan su número económico desde la base de datos
const TIPO_API = { 'Camión': 'camion', 'Remolque': 'remolque' };

export default function MecanicoForm({ user }) {
  const [form, setForm] = useState({
    fechaHora: '',
    tipoUnidad: '',
    numeroEconomico: '',
    descripcionServicio: '',
    costoEstimado: '',
    odometro: '',
  });
  const [unidades, setUnidades] = useState([]);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const esCamion   = form.tipoUnidad === 'Camión';
  const tieneApi   = !!TIPO_API[form.tipoUnidad];

  // Cargar catálogo de unidades cuando cambia el tipo
  useEffect(() => {
    if (!tieneApi) {
      setUnidades([]);
      return;
    }
    setLoadingUnidades(true);
    setForm((p) => ({ ...p, numeroEconomico: '' }));
    getUnidades(TIPO_API[form.tipoUnidad])
      .then(({ data }) => setUnidades(data.data ?? []))
      .catch(() => setUnidades([]))
      .finally(() => setLoadingUnidades(false));
  }, [form.tipoUnidad]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Al cambiar tipo de unidad, limpiar número económico
    if (name === 'tipoUnidad') {
      setForm((p) => ({ ...p, tipoUnidad: value, numeroEconomico: '' }));
    } else {
      setForm((p) => ({ ...p, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const payload = { ...form };
      if (!esCamion) delete payload.odometro;
      await crearSolicitud(payload);
      setStatus('success');
      setForm({
        fechaHora: '', tipoUnidad: '', numeroEconomico: '',
        descripcionServicio: '', costoEstimado: '', odometro: '',
      });
      setUnidades([]);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error al enviar la solicitud');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="form-success">
        <p className="form-success__msg">Solicitud enviada correctamente.</p>
        <p className="form-success__sub">Pendiente de autorización.</p>
        <button className="btn-submit" style={{ marginTop: '2rem' }} onClick={() => setStatus(null)}>
          Nueva solicitud
        </button>
      </div>
    );
  }

  return (
    <form className="form form--full" onSubmit={handleSubmit} autoComplete="off">
      <div className="form-greeting">
        <p className="form-greeting__text">
          Hola, <strong>{user.nombre}</strong>
        </p>
        <p className="form-greeting__sub">Complete el formulario para solicitar autorización de servicio.</p>
      </div>

      {/* Fecha y hora */}
      <div className="form-group">
        <label className="form-label" htmlFor="fechaHora">Fecha y hora</label>
        <input
          id="fechaHora"
          type="datetime-local"
          name="fechaHora"
          value={form.fechaHora}
          onChange={handleChange}
          required
          className="form-input"
        />
      </div>

      {/* Tipo de unidad */}
      <div className="form-group">
        <label className="form-label" htmlFor="tipoUnidad">Tipo de unidad</label>
        <select
          id="tipoUnidad"
          name="tipoUnidad"
          value={form.tipoUnidad}
          onChange={handleChange}
          required
          className="form-select"
        >
          <option value="">— Seleccionar —</option>
          {TIPOS_UNIDAD.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Odómetro — solo para camión */}
      {esCamion && (
        <div className="form-group">
          <label className="form-label" htmlFor="odometro">Odómetro (km)</label>
          <input
            id="odometro"
            type="number"
            name="odometro"
            value={form.odometro}
            onChange={handleChange}
            required
            min="0"
            className="form-input"
            placeholder="0"
          />
        </div>
      )}

      {/* Número económico */}
      {form.tipoUnidad && (
        <div className="form-group">
          <label className="form-label" htmlFor="numeroEconomico">Número económico</label>

          {tieneApi ? (
            <select
              id="numeroEconomico"
              name="numeroEconomico"
              value={form.numeroEconomico}
              onChange={handleChange}
              required
              disabled={loadingUnidades}
              className="form-select"
            >
              <option value="">
                {loadingUnidades ? 'Cargando...' : '— Seleccionar —'}
              </option>
              {unidades.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          ) : (
            <input
              id="numeroEconomico"
              type="text"
              name="numeroEconomico"
              value={form.numeroEconomico}
              onChange={handleChange}
              required
              className="form-input"
            />
          )}
        </div>
      )}

      {/* Descripción del servicio */}
      <div className="form-group">
        <label className="form-label" htmlFor="descripcionServicio">Descripción del servicio</label>
        <textarea
          id="descripcionServicio"
          name="descripcionServicio"
          value={form.descripcionServicio}
          onChange={handleChange}
          required
          rows={4}
          className="form-textarea"
        />
      </div>

      {/* Costo estimado */}
      <div className="form-group">
        <label className="form-label" htmlFor="costoEstimado">Costo estimado ($)</label>
        <input
          id="costoEstimado"
          type="number"
          name="costoEstimado"
          value={form.costoEstimado}
          onChange={handleChange}
          required
          min="0"
          step="0.01"
          className="form-input"
          placeholder="0.00"
        />
      </div>

      {/* Fotografía */}
      <div className="form-group">
        <label className="form-label">Fotografía</label>
        <div className="form-photo-placeholder">
          Próximamente disponible
        </div>
      </div>

      {status === 'error' && (
        <div className="form-error">{errorMsg}</div>
      )}

      <button type="submit" className="btn-submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Enviando...' : 'Solicitar autorización'}
      </button>
    </form>
  );
}
