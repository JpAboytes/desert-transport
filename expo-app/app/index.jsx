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
import Logo from '../components/Logo';

const INK       = '#0a0a0a';
const BRAND     = '#046738';
const BROWN     = '#553111';
const INK_MID   = '#444444';
const INK_LIGHT = '#888888';
const RULE      = '#bbbbbb';
const PAPER     = '#ffffff';
const PAPER_TINT = '#f2f1ee';

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const sans  = Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif';
const mono  = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

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
        {/* Logo (placeholder) */}
        <View style={styles.logoWrap}>
          <Logo size={120} />
        </View>

        {/* Cabecera editorial */}
        <View style={styles.loginHead}>
          <Text style={styles.loginTitle}>{'DESERT TRANSPORT'}</Text>
          <View style={styles.thinRule} />
          <Text style={styles.loginSub}>SERVICE CENTER — LOGIN</Text>
        </View>

        {/* Formulario */}
        <View style={styles.form}>
          <Text style={styles.label}>Usuario</Text>
          <TextInput
            style={styles.input}
            value={form.usuario}
            onChangeText={(v) => setForm((p) => ({ ...p, usuario: v }))}
            placeholder="usuario"
            placeholderTextColor={INK_LIGHT}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            value={form.password}
            onChangeText={(v) => setForm((p) => ({ ...p, password: v }))}
            placeholder="contraseña"
            placeholderTextColor={INK_LIGHT}
            secureTextEntry
          />

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading
              ? <ActivityIndicator color={PAPER} />
              : <Text style={styles.btnText}>Iniciar sesión</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },

  logoWrap: { alignItems: 'center', marginBottom: 28 },

  loginHead: {
    alignItems: 'center',
    marginBottom: 32,
  },
  loginTitle: {
    fontFamily: serif,
    fontSize: 22,
    fontWeight: '700',
    color: INK,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    lineHeight: 28,
    textAlign: 'center',
  },
  thinRule: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: BRAND,
    marginTop: 12,
    marginBottom: 10,
  },
  loginSub: {
    fontFamily: sans,
    fontSize: 10,
    color: BROWN,
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  form: { width: '100%' },
  label: {
    fontFamily: sans,
    fontSize: 10,
    fontWeight: '700',
    color: INK,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: PAPER_TINT,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: mono,
    fontSize: 15,
    color: INK,
    marginBottom: 20,
  },

  errorBox: {
    borderLeftWidth: 3,
    borderLeftColor: INK,
    borderRadius: 12,
    backgroundColor: PAPER_TINT,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  errorText: {
    fontFamily: sans,
    fontSize: 13,
    color: INK,
  },

  btn: {
    backgroundColor: BRAND,
    paddingVertical: 15,
    alignItems: 'center',
    borderRadius: 14,
    shadowColor: INK,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  btnDisabled: { backgroundColor: INK_LIGHT },
  btnText: {
    fontFamily: sans,
    color: PAPER,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
});
