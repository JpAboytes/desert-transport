import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { login } from '../services/auth';

export default function LoginScreen() {
  const [form, setForm] = useState({ usuario: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!form.usuario || !form.password) {
      setError('Ingresa usuario y contraseña');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(form.usuario, form.password);
      router.replace('/home');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Ícono */}
        <View style={styles.iconWrap}>
          <Text style={styles.iconText}>⚡</Text>
        </View>
        <Text style={styles.title}>Transporte App</Text>
        <Text style={styles.subtitle}>Sistema de gestión de reparaciones</Text>

        {/* Formulario */}
        <View style={styles.form}>
          <Text style={styles.label}>Usuario</Text>
          <TextInput
            style={styles.input}
            value={form.usuario}
            onChangeText={(v) => setForm((p) => ({ ...p, usuario: v }))}
            placeholder="Ingresa tu usuario"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            value={form.password}
            onChangeText={(v) => setForm((p) => ({ ...p, password: v }))}
            placeholder="Ingresa tu contraseña"
            placeholderTextColor="#64748b"
            secureTextEntry
          />

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Iniciar sesión</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  iconText: { fontSize: 32 },
  title: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 13, marginTop: 4, marginBottom: 32 },
  form: {
    width: '100%',
    backgroundColor: '#1e293b', borderRadius: 16,
    padding: 24, borderWidth: 1, borderColor: '#334155',
  },
  label: { color: '#cbd5e1', fontSize: 13, fontWeight: '500', marginBottom: 4 },
  input: {
    backgroundColor: '#334155', color: '#fff', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 13,
    borderWidth: 1, borderColor: '#475569', marginBottom: 16, fontSize: 15,
  },
  errorText: { color: '#f87171', fontSize: 13, marginBottom: 8 },
  btn: {
    backgroundColor: '#f97316', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
