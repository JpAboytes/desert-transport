import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const INK = '#0a0a0a';
const INK_LIGHT = '#888888';
const RULE = '#bbbbbb';
const PAPER = '#ffffff';
const sans = Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif';

// Selector de varias fotos (cámara o galería). `fotos` = arreglo de uris locales.
export default function FotoPicker({ fotos = [], onChange, disabled, max = 7 }) {
  const restantes = max - fotos.length;

  const agregar = (uris) => onChange([...fotos, ...uris].slice(0, max));
  const quitar = (uri) => onChange(fotos.filter((u) => u !== uri));

  const tomar = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!res.canceled && res.assets?.[0]) agregar([res.assets[0].uri]);
  };

  const elegir = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: restantes,
    });
    if (!res.canceled && res.assets?.length) agregar(res.assets.map((a) => a.uri));
  };

  return (
    <View>
      {fotos.length > 0 && (
        <View style={styles.grid}>
          {fotos.map((uri) => (
            <View key={uri} style={styles.thumbWrap}>
              <Image source={{ uri }} style={styles.thumb} />
              <TouchableOpacity onPress={() => quitar(uri)} disabled={disabled} style={styles.quitar} activeOpacity={0.7}>
                <Text style={styles.quitarText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {restantes > 0 && (
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={tomar} disabled={disabled} activeOpacity={0.7}>
            <Text style={styles.btnText}>Cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={elegir} disabled={disabled} activeOpacity={0.7}>
            <Text style={styles.btnText}>Galería</Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={styles.contador}>{fotos.length}/{max} fotos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, borderWidth: 1, borderColor: INK, paddingVertical: 11, alignItems: 'center', backgroundColor: PAPER },
  btnText: { fontFamily: sans, fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: INK },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 64, height: 64, borderWidth: 1, borderColor: RULE },
  quitar: {
    position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: 11,
    backgroundColor: INK, alignItems: 'center', justifyContent: 'center',
  },
  quitarText: { color: PAPER, fontSize: 14, lineHeight: 16, fontWeight: '700' },
  contador: { fontFamily: sans, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: INK_LIGHT, marginTop: 6 },
});
