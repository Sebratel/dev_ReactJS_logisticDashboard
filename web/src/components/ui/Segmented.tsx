interface SegmentedProps<T extends string> {
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
  title?: string;
}

/** Alternador no cabeçalho do visual (ex.: produtos/cabos). */
export function Segmented<T extends string>({ value, options, onChange, title }: SegmentedProps<T>) {
  return (
    <span className="seg" title={title}>
      {options.map((o) => (
        <button key={o.id} type="button" className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </span>
  );
}
