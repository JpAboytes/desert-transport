import { Navigate } from 'react-router-dom';
import { tokenVigente, cerrarSesion } from '../services/auth';

export default function ProtectedRoute({ children }) {
  // Valida existencia Y expiración: un token vencido (PWA iOS reanudado desde una
  // notificación tras >8h) renderizaba el home pero toda llamada al API daba 401.
  if (!tokenVigente()) {
    cerrarSesion();
    return <Navigate to="/" replace />;
  }
  return children;
}
