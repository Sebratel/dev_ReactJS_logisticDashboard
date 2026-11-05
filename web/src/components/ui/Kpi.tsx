interface KpiProps {
  value: string;
  label: string;
  description?: string;
  tone?: 'default' | 'alerta' | 'minimo';
  title?: string;
}

/**
 * Cartão de número. `description` diz o que o número mede quando o nome não
 * basta — "média 3 meses" de quê, contada como? Indicador ambíguo vira número
 * errado em apresentação.
 */
export function Kpi({ value, label, description, tone = 'default', title }: KpiProps) {
  return (
    <div className={`kpi${tone === 'default' ? '' : ` ${tone}`}`} title={title}>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
      {description && <div className="desc">{description}</div>}
    </div>
  );
}
