import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants/api';

const authAxios = async () => {
  const token = await AsyncStorage.getItem('token');
  return axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const getUnidades = async (tipo) => {
  const api = await authAxios();
  return api.get('/unidades', { params: { tipo } });
};

export const crearSolicitud = async (data) => {
  const api = await authAxios();
  return api.post('/solicitudes', data);
};

export const getMisSolicitudes = async () => {
  const api = await authAxios();
  return api.get('/mis-solicitudes');
};

export const getSolicitudes = async () => {
  const api = await authAxios();
  return api.get('/admin/solicitudes');
};

export const actualizarEstatus = async (id, estatus) => {
  const api = await authAxios();
  return api.patch(`/admin/solicitudes/${id}`, { estatus });
};

export const getPresignUrl = async (contentType = 'image/jpeg') => {
  const api = await authAxios();
  return api.post('/uploads/presign', { contentType });
};

export const cerrarReparacion = async (id, { costoReal, urlCierre }) => {
  const api = await authAxios();
  return api.patch(`/mis-solicitudes/${id}`, { costoReal, urlCierre });
};

// Decisión de pago del admin sobre un ticket Reparado (true = autorizar, false = rechazar).
export const autorizarPago = async (id, autorizacionPago) => {
  const api = await authAxios();
  return api.patch(`/admin/solicitudes/${id}`, { autorizacionPago });
};

export const registerPushToken = async (expoPushToken) => {
  const api = await authAxios();
  return api.put('/push-token', { expoPushToken });
};
