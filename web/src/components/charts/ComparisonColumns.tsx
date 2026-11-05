import { Bar, CartesianGrid, ComposedChart, LabelList, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import type { PeriodValues, SeriesDefinition } from '../../services/types';
import type { ChartColors } from '../../utils/chartColors';
import { int } from '../../utils/format';
import { AutoSizer } from './AutoSizer';
import { ChartTooltip } from './ChartTooltip';

interface ComparisonColumnsProps {
  data: PeriodValues[];
  series: SeriesDefinition[];
  /** rótulo do eixo (o padrão é o `label` do período, já pronto no servidor) */
  labelOf?: (period: PeriodValues) => string;
  format?: (value: number) => string;
}

interface LabelProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: number | string;
}

/** Cor de cada série, na ordem: dourado, vinho, laranja, cinza (a primeira é a da marca). */
export const seriesColor = (index: number, colors: ChartColors): string => (
  [colors.gold, colors.primary, colors.orange, colors.neutral][index % 4] as string
);

/**
 * Colunas por período, empilhadas quando há mais de uma série (o
 * "lineStackedColumnComboChart" das telas Gerencial). O total vai num chip
 * escuro em cima da pilha; acima de ~24 colunas o chip sai e a leitura fica
 * no tooltip.
 */
export function ComparisonColumns({ data, series, labelOf = (p) => p.label, format = int }: ComparisonColumnsProps) {
  const { colors } = useTheme();
  const dense = data.length > 24;
  const rows = data.map((p) => ({ key: p.key, label: labelOf(p), total: p.total, ...p.values }));

  const chip = ({ x = 0, y = 0, width = 0, value }: LabelProps) => {
    if (value === undefined || Number(value) === 0) return null;
    const text = format(Number(value));
    const w = Math.max(text.length * 6.7 + 10, 22);
    const cx = Number(x) + Number(width) / 2;
    const cy = Number(y) - 12;
    return (
      <g pointerEvents="none">
        <rect x={cx - w / 2} y={cy - 9} width={w} height={18} rx={3} fill={colors.chipFill} opacity={0.92} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={colors.chipText} fontSize={11} fontWeight={600}>
          {text}
        </text>
      </g>
    );
  };

  return (
    <AutoSizer>
      {({ width, height }) => (
        <ComposedChart width={width} height={height} data={rows} margin={{ top: dense ? 12 : 28, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="4 4" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: dense ? 9.5 : 11.5, fontWeight: 700, fill: colors.ink }}
            axisLine={false}
            tickLine={false}
            interval={dense ? Math.ceil(rows.length / 20) : 0}
            angle={dense ? -35 : 0}
            textAnchor={dense ? 'end' : 'middle'}
            height={dense ? 42 : 22}
          />
          <YAxis hide domain={[0, (d: number) => d * 1.18]} />
          <Tooltip cursor={{ fill: colors.cursor }} content={<ChartTooltip format={format} />} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="periodo"
              fill={seriesColor(i, colors)}
              maxBarSize={dense ? 22 : 72}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
              isAnimationActive={false}
            >
              {!dense && i === series.length - 1 && <LabelList dataKey="total" content={chip} />}
            </Bar>
          ))}
        </ComposedChart>
      )}
    </AutoSizer>
  );
}
