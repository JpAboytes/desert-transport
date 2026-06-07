import { useMemo, useEffect } from 'react';

// Selector de foto (archivo o cámara en móvil). Reporta el File vía onChange.
export default function FotoPicker({ file, onChange, disabled }) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (file) {
    return (
      <div className="foto-picker__preview">
        <img src={preview} alt="vista previa" />
        <button type="button" className="foto-picker__remove" onClick={() => onChange(null)} disabled={disabled}>
          Quitar foto
        </button>
      </div>
    );
  }

  return (
    <label className={`foto-picker__btn${disabled ? ' is-disabled' : ''}`}>
      Seleccionar foto
      <input
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        disabled={disabled}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
