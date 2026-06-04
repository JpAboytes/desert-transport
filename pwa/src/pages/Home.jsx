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
    <div className="page">
      <header className="masthead">
        <div className="masthead__brand">
          <span className="masthead__title">Transporte App</span>
          <span className="masthead__subtitle">Sistema de gestión de reparaciones</span>
        </div>
        <button className="masthead__action" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </header>

      <main className="content">
        <div className="user-block">
          <p className="user-block__name">{user.nombre}</p>
          <p className="user-block__meta">
            {user.tusuario}&nbsp;&middot;&nbsp;@{user.usuario}
          </p>
        </div>

        <p className="welcome-msg">{getWelcomeMessage(user.tusuario)}</p>

        {/* TODO: Fase 2 — listado de solicitudes de reparación asignadas */}
      </main>
    </div>
  );
}
