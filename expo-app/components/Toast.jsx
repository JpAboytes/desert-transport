import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Platform } from 'react-native';

const INK   = '#0a0a0a';
const PAPER = '#ffffff';
const sans  = Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif';

export default function Toast({ message, type = 'success', onDismiss }) {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (!message) return;

    opacity.setValue(0);
    translateY.setValue(16);

    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 16, duration: 180, useNativeDriver: true }),
      ]).start(() => onDismiss?.());
    }, 2800);

    return () => clearTimeout(t);
  }, [message]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!message) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        type === 'success' ? styles.success : styles.error,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={[styles.text, type === 'success' ? styles.textSuccess : styles.textError]}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    zIndex: 9999,
  },
  success: { backgroundColor: INK },
  error:   { backgroundColor: PAPER, borderWidth: 2, borderColor: INK },
  text: {
    fontFamily: sans,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  textSuccess: { color: PAPER },
  textError:   { color: INK },
});
