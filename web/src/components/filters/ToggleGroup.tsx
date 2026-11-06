interface ToggleGroupProps {
  label: string;
  options: { value: string; label: string; color?: string }[];
  value: string[];
  onChange: (values: string[]) => void;
  /** mostra o nome do filtro na frente dos botões (quando há mais de um grupo lado a lado) */
  showLabel?: boolean;
}

/**
 * Botões liga/desliga — os três slicers "Basic" de STATUS2 do relatório
 * (ACIMA / ALERTA / MÍNIMO), um ao lado do outro.
 */
export function ToggleGroup({ label, options, value, onChange, showLabel = false }: ToggleGroupProps) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="alternador" role="group" aria-label={label}>
      {showLabel && <span className="alternador-rotulo">{label}</span>}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value.includes(o.value) ? 'on' : ''}
          aria-pressed={value.includes(o.value)}
          onClick={() => toggle(o.value)}
        >
          {o.color && <i style={{ background: o.color }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
