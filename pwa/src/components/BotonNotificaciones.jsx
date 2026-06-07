import { useEffect, useState } from 'react';
import { pushSoportado, esIosNoInstalado, estadoPush, activarNotificaciones } from '../services/push';

// Botón para que el admin active las notificaciones Web Push en el PWA.
export default function BotonNotificaciones({ showToast }) {
  const [estado, setEstado] = useState('cargando');
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    if (!pushSoportado()) { setEstado('no-soportado'); return; }
    if (esIosNoInstalado()) { setEstado('ios-no-instalado'); return; }
    estadoPush().then(setEstado).catch(() => setEstado('inactivo'));
  }, []);

  const activar = async () => {
    setTrabajando(true);
    try {
      await activarNotificaciones();
      setEstado('activo');
      showToast?.('Notificaciones activadas');
    } catch (e) {
      showToast?.(e.message || 'No se pudieron activar', 'error');
      setEstado(await estadoPush().catch(() => 'inactivo'));
    } finally {
      setTrabajando(false);
    }
  };

  if (estado === 'cargando' || estado === 'no-soportado') return null;

  if (estado === 'ios-no-instalado') {
    return (
      <div className="notif-banner">
        Para recibir notificaciones en iPhone, instala la app: Compartir → “Agregar a inicio”.
      </div>
    );
  }
  if (estado === 'bloqueado') {
    return <div className="notif-banner">Notificaciones bloqueadas. Actívalas en los ajustes del navegador.</div>;
  }
  if (estado === 'activo') {
    return <div className="notif-banner notif-banner--ok">✓ Notificaciones activadas en este dispositivo.</div>;
  }

  return (
    <button className="btn-notif" onClick={activar} disabled={trabajando}>
      {trabajando ? 'Activando...' : 'Activar notificaciones'}
    </button>
  );
}
