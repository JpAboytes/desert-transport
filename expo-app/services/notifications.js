import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushToken } from './solicitudes';

const CHANNEL_ID = 'solicitudes';

function getProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    null
  );
}

// Pide permiso, crea el canal Android, obtiene el ExpoPushToken
// y lo registra en el backend. Devuelve el token o null.
export async function registerForNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Solicitudes de servicio',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('[notifications] Falta projectId (extra.eas.projectId). Corre `eas init`.');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerPushToken(token);
    return token;
  } catch (e) {
    console.warn('[notifications] No se pudo registrar el push token:', e?.message ?? e);
    return null;
  }
}
