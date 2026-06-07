import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const INK = '#0a0a0a';
const INK_LIGHT = '#888888';
const RULE = '#bbbbbb';
const PAPER = '#ffffff';
const sans = Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif';

// Selector de foto (cámara o galería). Reporta el uri local vía onChange.
export default function FotoPicker({ uri, onChange, disabled }) {
  const pick = async (fromCamera) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!res.canceled && res.assets?.[0]) onChange(res.assets[0].uri);
  };

  if (uri) {
    return (
      <View style={styles.previewWrap}>
        <Image source={{ uri }} style={styles.preview} />
        <TouchableOpacity onPress={() => onChange(null)} disabled={disabled} style={styles.removeBtn} activeOpacity={0.7}>
          <Text style={styles.removeText}>Quitar foto</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.btn} onPress={() => pick(true)} disabled={disabled} activeOpacity={0.7}>
        <Text style={styles.btnText}>Cámara</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={() => pick(false)} disabled={disabled} activeOpacity={0.7}>
        <Text style={styles.btnText}>Galería</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, borderWidth: 1, borderColor: INK, paddingVertical: 11, alignItems: 'center', backgroundColor: PAPER },
  btnText: { fontFamily: sans, fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: INK },
  previewWrap: { borderWidth: 1, borderColor: RULE, padding: 8, alignItems: 'flex-start' },
  preview: { width: '100%', height: 180, resizeMode: 'cover', borderWidth: 1, borderColor: RULE },
  removeBtn: { marginTop: 8 },
  removeText: { fontFamily: sans, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: INK_LIGHT, textDecorationLine: 'underline' },
});
