import { suscribirPush } from './api';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSoportado() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// En iOS, Web Push solo funciona con el PWA instalado (modo standalone).
export function esIosNoInstalado() {
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  return iOS && !standalone;
}

export async function estadoPush() {
  if (!pushSoportado()) return 'no-soportado';
  if (Notification.permission === 'denied') return 'bloqueado';
  if (Notification.permission !== 'granted') return 'inactivo';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  return sub ? 'activo' : 'inactivo';
}

// Registra el SW, pide permiso (debe correr en gesto de usuario), se suscribe y guarda en backend.
export async function activarNotificaciones() {
  if (!pushSoportado()) throw new Error('Tu navegador no soporta notificaciones push.');
  if (!VAPID_PUBLIC) throw new Error('Falta VITE_VAPID_PUBLIC.');

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('Permiso de notificaciones denegado.');

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }

  const json = sub.toJSON();
  await suscribirPush({ endpoint: json.endpoint, keys: json.keys });
  return true;
}
