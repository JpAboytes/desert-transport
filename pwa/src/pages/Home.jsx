import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

// TODO: Fase 2 — cargar y mostrar solicitudes de reparación del usuario

function getWelcomeMessage(tusuario) {
  if (tusuario === 'Administrador') return 'Bienvenido, eres Administrador';
  if (tusuario === 'Mecanico') return 'Bienvenido, eres Mecánico';
  return `Bienvenido, ${tusuario}`;
}

export default function Home() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = token ? jwtDecode(token) : {};

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center font-bold shrink-0">
          {user.nombre?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{user.nombre}</p>
          <p className="text-xs text-slate-400">{user.tusuario}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-slate-400 hover:text-red-400 transition shrink-0"
        >
          Cerrar sesión
        </button>
      </header>

      {/* Contenido principal */}
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-orange-400 mb-1">
            {getWelcomeMessage(user.tusuario)}
          </h2>
          <p className="text-slate-400 text-sm">
            {user.nombre} &middot; @{user.usuario}
          </p>
        </div>

        {/* TODO: Fase 2 — tarjetas de solicitudes de reparación asignadas */}
      </main>
    </div>
  );
}
