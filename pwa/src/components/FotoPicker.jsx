import { useMemo, useEffect } from 'react';

// Selector de varias fotos. `fotos` = arreglo de File; reporta el nuevo arreglo vía onChange.
export default function FotoPicker({ fotos = [], onChange, disabled, max = 7 }) {
  const previews = useMemo(() => fotos.map((f) => URL.createObjectURL(f)), [fotos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const restantes = max - fotos.length;

  const agregar = (e) => {
    const nuevos = Array.from(e.target.files ?? []);
    onChange([...fotos, ...nuevos].slice(0, max));
    e.target.value = ''; // permite volver a elegir el mismo archivo
  };
  const quitar = (idx) => onChange(fotos.filter((_, i) => i !== idx));

  return (
    <div>
      {fotos.length > 0 && (
        <div className="foto-grid">
          {previews.map((src, i) => (
            <div key={i} className="foto-grid__item">
              <img src={src} alt={`foto ${i + 1}`} />
              <button type="button" className="foto-grid__remove" onClick={() => quitar(i)} disabled={disabled}>×</button>
            </div>
          ))}
        </div>
      )}

      {restantes > 0 && (
        <div className="foto-picker__acciones">
          {/* Cámara: `capture` abre la cámara directo en móvil */}
          <label className={`foto-picker__btn${disabled ? ' is-disabled' : ''}`}>
            Cámara
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              hidden
              disabled={disabled}
              onChange={agregar}
            />
          </label>
          {/* Galería: sin `capture` → abre la galería / selector de archivos */}
          <label className={`foto-picker__btn${disabled ? ' is-disabled' : ''}`}>
            Galería
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={disabled}
              onChange={agregar}
            />
          </label>
        </div>
      )}
      <span className="foto-picker__contador">{fotos.length}/{max} fotos</span>
    </div>
  );
}
