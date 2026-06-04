import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import MecanicoForm from './MecanicoForm';

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
          <span className="masthead__title">Dessert Trucking</span>
          <span className="masthead__subtitle">Sistema de gestión de reparaciones</span>
        </div>
        <button className="masthead__action" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </header>

      <main className="content">
        {user.tusuario === 'Usuario'
          ? <MecanicoForm user={user} />
          : (
            <>
              <div className="user-block">
                <p className="user-block__name">{user.nombre}</p>
                <p className="user-block__meta">
                  {user.tusuario}&nbsp;&middot;&nbsp;@{user.usuario}
                </p>
              </div>
              <p className="welcome-msg">Bienvenido, {user.nombre}</p>
            </>
          )
        }
      </main>
    </div>
  );
}
