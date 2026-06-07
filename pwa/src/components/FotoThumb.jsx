import { useState } from 'react';

// Miniatura que abre la foto completa en un modal al hacer click.
export default function FotoThumb({ url, size = 56 }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;

  return (
    <>
      <img
        src={url}
        alt="foto"
        loading="lazy"
        width={size}
        height={size}
        className="foto-thumb"
        onClick={() => setOpen(true)}
      />
      {open && (
        <div className="foto-modal" onClick={() => setOpen(false)}>
          <img src={url} alt="foto" className="foto-modal__img" />
        </div>
      )}
    </>
  );
}
