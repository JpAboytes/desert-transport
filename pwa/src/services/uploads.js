import imageCompression from 'browser-image-compression';
import { getPresignUrl } from './api';

// Comprime la imagen en el navegador, pide una URL firmada, sube el binario
// directo a S3 y devuelve la URL pública final (para guardar en la solicitud).
export async function subirFoto(file) {
  const comprimida = await imageCompression(file, {
    maxWidthOrHeight: 1280,
    maxSizeMB: 0.5,
    useWebWorker: true,
    fileType: 'image/jpeg',
  });

  const { data } = await getPresignUrl('image/jpeg');
  const { uploadUrl, fileUrl } = data;

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    body: comprimida,
    headers: { 'Content-Type': 'image/jpeg' },
  });
  if (!put.ok) throw new Error('Falló la subida de la foto');

  return fileUrl;
}
