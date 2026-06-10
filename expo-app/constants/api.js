import Constants from 'expo-constants';

// La URL del API se inyecta por entorno desde app.config.js (extra.apiUrl).
// Fallback a dev por si se evalúa fuera del runtime de Expo.
export const API_URL =
  Constants.expoConfig?.extra?.apiUrl ??
  'https://ui7sns7rxj.execute-api.us-east-2.amazonaws.com';

export const ENDPOINTS = {
  login: `${API_URL}/login`,
  // TODO: Fase 2 — agregar endpoints de solicitudes de reparación
};
