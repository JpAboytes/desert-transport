import { useState } from 'react';
import { TouchableOpacity, Image, Modal, StyleSheet } from 'react-native';

const INK = '#0a0a0a';

// Miniatura que abre la foto completa en un modal al tocarla.
export default function FotoThumb({ url, size = 56 }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Image source={{ uri: url }} style={[styles.thumb, { width: size, height: size }]} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <Image source={{ uri: url }} style={styles.full} resizeMode="contain" />
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  thumb: { borderWidth: 1, borderColor: INK, backgroundColor: '#eee' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  full: { width: '100%', height: '100%' },
});
