import { jwtDecode } from 'jwt-decode';

// Devuelve el token SOLO si existe y no ha expirado. El JWT trae `exp` en segundos (UNIX);
// se compara contra Date.now() en ms. Si está vencido o corrupto, devuelve null.
export function tokenVigente() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const { exp } = jwtDecode(token);
    if (exp && exp * 1000 <= Date.now()) return null;
    return token;
  } catch {
    return null;
  }
}

export function cerrarSesion() {
  localStorage.clear();
}
