import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import MecanicoForm from './MecanicoForm';
import AdminView from './AdminView';
import Logo from '../components/Logo';

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
        <div className="masthead__left">
          <Logo size="sm" />
          <div className="masthead__brand">
            <span className="masthead__title">Desert Transport</span>
            <span className="masthead__subtitle">SERVICE CENTER</span>
          </div>
        </div>
        <button className="masthead__action" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </header>

      <main className="content">
        {user.tusuario === 'Mantenimiento' && <MecanicoForm user={user} />}

        {user.tusuario === 'Administrador' && (
          <>
            <div className="user-block">
              <p className="user-block__name">Solicitudes de servicio</p>
              <p className="user-block__meta">
                {user.nombre}&nbsp;&middot;&nbsp;Administrador
              </p>
            </div>
            <AdminView />
          </>
        )}
      </main>
    </div>
  );
}
