import { int } from '../../utils/format';

interface TooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  fill?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  labelFormatter?: (label: string) => string;
  format?: (value: number) => string;
}

/** Tooltip no estilo do Power BI: escuro, título e uma linha por série. */
export function ChartTooltip({ active, payload, label, labelFormatter, format = int }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value !== null && p.value !== undefined && Number(p.value) !== 0);
  const title = labelFormatter ? labelFormatter(String(label ?? '')) : String(label ?? '');
  return (
    <div className="tooltip-pbi">
      <div className="t">{title}</div>
      {rows.map((p) => (
        <div className="r" key={String(p.dataKey)}>
          <span><i style={{ background: p.color ?? p.fill }} />{p.name}</span>
          <b>{format(Number(p.value))}</b>
        </div>
      ))}
    </div>
  );
}
