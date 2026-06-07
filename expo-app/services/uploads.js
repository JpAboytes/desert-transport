import * as ImageManipulator from 'expo-image-manipulator';
import { getPresignUrl } from './solicitudes';

// Comprime/redimensiona la imagen local, pide una URL firmada, sube el binario
// directo a S3 y devuelve la URL pública final (para guardar en la solicitud).
export async function subirFoto(uri) {
  const manip = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  const { data } = await getPresignUrl('image/jpeg');
  const { uploadUrl, fileUrl } = data;

  const blob = await (await fetch(manip.uri)).blob();
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'image/jpeg' },
  });
  if (!put.ok) throw new Error('Falló la subida de la foto');

  return fileUrl;
}

// Sube varias imágenes locales en paralelo y devuelve el arreglo de URLs públicas.
export async function subirFotos(uris) {
  const lista = Array.isArray(uris) ? uris : [];
  return Promise.all(lista.map((uri) => subirFoto(uri)));
}
