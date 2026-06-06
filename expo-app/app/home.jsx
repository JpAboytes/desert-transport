import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { getToken, decodeToken, logout } from '../services/auth';
import MecanicoForm from '../components/MecanicoForm';
import AdminView from '../components/AdminView';
import Toast from '../components/Toast';
import { registerForNotifications } from '../services/notifications';

const INK     = '#0a0a0a';
const INK_MID = '#444444';
const RULE    = '#bbbbbb';
const PAPER   = '#ffffff';

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const sans  = Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif';

export default function HomeScreen() {
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'success' });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast({ message: '', type: 'success' });
  }, []);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) { router.replace('/'); return; }
      const decoded = decodeToken(token);
      if (!decoded) { router.replace('/'); return; }
      setUser(decoded);
      if (decoded.tusuario === 'Mantenimiento') {
        await registerForNotifications();
      }
    });
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  if (!user) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={INK} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Masthead */}
      <View style={styles.masthead}>
        <View>
          <Text style={styles.mastheadTitle}>Desert Transport</Text>
          <Text style={styles.mastheadSub}>Sistema de gestión de reparaciones</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} activeOpacity={0.6}>
          <Text style={styles.logoutBtn}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>

      {/* Contenido según rol */}
      {user.tusuario === 'Mantenimiento' && (
        <MecanicoForm user={user} showToast={showToast} />
      )}

      {user.tusuario === 'Administrador' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={styles.userBlock}>
            <Text style={styles.userName}>Solicitudes de servicio</Text>
            <Text style={styles.userMeta}>{user.nombre} · Administrador</Text>
          </View>
          <AdminView showToast={showToast} />
        </ScrollView>
      )}

      {/* Toast — fuera del ScrollView para superponerse a todo */}
      <Toast message={toast.message} type={toast.type} onDismiss={hideToast} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PAPER },
  container: { flex: 1, backgroundColor: PAPER },

  masthead: {
    borderTopWidth: 5, borderTopColor: INK,
    borderBottomWidth: 1, borderBottomColor: INK,
    paddingHorizontal: 20, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-between', backgroundColor: PAPER,
  },
  mastheadTitle: {
    fontFamily: serif, fontSize: 15, fontWeight: '700',
    color: INK, letterSpacing: 1, textTransform: 'uppercase',
  },
  mastheadSub: {
    fontFamily: sans, fontSize: 9, color: INK_MID,
    letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2,
  },
  logoutBtn: {
    fontFamily: sans, fontSize: 10, color: INK,
    letterSpacing: 1.5, textTransform: 'uppercase', textDecorationLine: 'underline',
  },

  scroll:    { flex: 1 },
  content:   { padding: 24, paddingBottom: 48 },
  userBlock: {
    borderTopWidth: 3, borderTopColor: INK,
    borderBottomWidth: 1, borderBottomColor: RULE,
    paddingTop: 16, paddingBottom: 16, marginBottom: 24,
  },
  userName: {
    fontFamily: serif, fontSize: 20, fontWeight: '700',
    color: INK, letterSpacing: 0.3, marginBottom: 4,
  },
  userMeta: {
    fontFamily: sans, fontSize: 10, color: INK_MID,
    letterSpacing: 2, textTransform: 'uppercase',
  },
});
