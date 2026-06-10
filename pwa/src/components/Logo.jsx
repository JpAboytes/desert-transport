// El logo se carga desde  pwa/public/logo.png
// Para cambiarlo, reemplaza ESE archivo (mismo nombre y extensión).
export default function Logo({ size = 'sm', className = '' }) {
  return (
    <img
      src="/logo.png"
      alt="Desert Transport Service Center"
      className={`logo-img logo-img--${size} ${className}`}
    />
  );
}
