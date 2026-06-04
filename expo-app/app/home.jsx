import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { getToken, decodeToken, logout } from '../services/auth';

// TODO: Fase 2 — cargar solicitudes de reparación asignadas al usuario

function getWelcomeMessage(tusuario) {
  if (tusuario === 'Administrador') return 'Bienvenido, eres Administrador';
  if (tusuario === 'Mecanico') return 'Bienvenido, eres Mecánico';
  return `Bienvenido, ${tusuario}`;
}

export default function HomeScreen() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    getToken().then((token) => {
      if (!token) { router.replace('/'); return; }
      const decoded = decodeToken(token);
      if (!decoded) { router.replace('/'); return; }
      setUser(decoded);
    });
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  if (!user) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#f97316" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.nombre?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName} numberOfLines={1}>{user.nombre}</Text>
          <Text style={styles.headerRole}>{user.tusuario}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} activeOpacity={0.7}>
          <Text style={styles.logoutBtn}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Contenido */}
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.welcome}>{getWelcomeMessage(user.tusuario)}</Text>
          <Text style={styles.userInfo}>
            {user.nombre} · @{user.usuario}
          </Text>
        </View>

        {/* TODO: Fase 2 — lista de solicitudes de reparación */}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 12,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  headerName: { color: '#fff', fontWeight: '600', fontSize: 14 },
  headerRole: { color: '#94a3b8', fontSize: 12 },
  logoutBtn: { color: '#f87171', fontSize: 14 },
  content: { padding: 16 },
  card: {
    backgroundColor: '#1e293b', borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: '#334155',
  },
  welcome: { color: '#fb923c', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  userInfo: { color: '#94a3b8', fontSize: 13 },
});
