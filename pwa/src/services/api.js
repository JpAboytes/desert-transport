import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Adjunta el JWT en cada request si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const loginRequest = (usuario, password) =>
  api.post('/login', { usuario, password });

export const getUnidades = (tipo) =>
  api.get('/unidades', { params: { tipo } });

export const crearSolicitud = (data) =>
  api.post('/solicitudes', data);

export const getMisSolicitudes = () =>
  api.get('/mis-solicitudes');

export const getSolicitudes = () =>
  api.get('/admin/solicitudes');

export const actualizarEstatus = (id, estatus) =>
  api.patch(`/admin/solicitudes/${id}`, { estatus });

export default api;
