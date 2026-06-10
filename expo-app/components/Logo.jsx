import { Image } from 'react-native';

// El logo se carga desde  expo-app/assets/logo.png
// Para cambiarlo, reemplaza ESE archivo (mismo nombre y extensión).
const LOGO = require('../assets/logo.png');

export default function Logo({ size = 40 }) {
  return <Image source={LOGO} style={{ width: size, height: size }} resizeMode="contain" />;
}
