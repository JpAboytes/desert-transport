import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants/api';

export const login = async (usuario, password) => {
  const { data } = await axios.post(`${API_URL}/login`, { usuario, password });
  await AsyncStorage.setItem('token', data.token);
  return data;
};

export const logout = async () => {
  await AsyncStorage.removeItem('token');
};

export const getToken = () => AsyncStorage.getItem('token');

// Decodifica el payload del JWT sin verificar firma (solo para UI)
export const decodeToken = (token) => {
  try {
    const payload = token.split('.')[1];
    // JWT usa base64url — convertir a base64 estándar antes de atob
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};
