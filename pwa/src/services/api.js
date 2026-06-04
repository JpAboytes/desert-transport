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

// TODO: Fase 2 — agregar endpoints de solicitudes de reparación

export default api;
