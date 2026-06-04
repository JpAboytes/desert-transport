import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginRequest } from '../services/api';

export default function Login() {
  const [form, setForm] = useState({ usuario: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await loginRequest(form.usuario, form.password);
      localStorage.setItem('token', data.token);
      navigate('/home');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page--login">
      <div className="login-head">
        <h1 className="login-head__title">
          Sistema de Gestión<br />de Reparaciones
        </h1>
        <hr className="login-head__rule" />
        <p className="login-head__sub">Dessert Trucking &mdash; Acceso al sistema</p>
      </div>

      <form className="form" onSubmit={handleSubmit} autoComplete="off">
        <div className="form-group">
          <label className="form-label" htmlFor="usuario">Usuario</label>
          <input
            id="usuario"
            type="text"
            name="usuario"
            value={form.usuario}
            onChange={handleChange}
            required
            autoComplete="off"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            autoComplete="off"
            className="form-input"
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <button type="submit" disabled={loading} className="btn-submit">
          {loading ? 'Verificando...' : 'Iniciar sesión'}
        </button>
      </form>
    </div>
  );
}
