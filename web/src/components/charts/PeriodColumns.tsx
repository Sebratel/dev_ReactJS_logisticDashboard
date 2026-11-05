import { Bar, CartesianGrid, Cell, ComposedChart, LabelList, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import type { KeyValue } from '../../services/types';
import { gradient } from '../../utils/chartColors';
import { int } from '../../utils/format';
import { AutoSizer } from './AutoSizer';
import { ChartTooltip } from './ChartTooltip';

interface PeriodColumnsProps {
  data: KeyValue[];
  name: string;
  labelOf: (key: string) => string;
  tooltipLabelOf?: (key: string) => string;
}

interface LabelProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: number | string;
}

/**
 * Colunas por período (o "lineStackedColumnComboChart" do relatório, que só
 * tinha a série de colunas): gradiente dourado por valor, rótulo em chip
 * escuro, e acima de ~24 colunas os rótulos saem e a leitura fica no tooltip.
 */
export function PeriodColumns({ data, name, labelOf, tooltipLabelOf }: PeriodColumnsProps) {
  const { colors } = useTheme();
  const values = data.map((d) => d.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const dense = data.length > 24;

  const chip = ({ x = 0, y = 0, width = 0, value }: LabelProps) => {
    if (value === undefined || Number(value) === 0) return null;
    const text = int(Number(value));
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
        <ComposedChart width={width} height={height} data={data} margin={{ top: dense ? 12 : 28, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="4 4" />
          <XAxis
            dataKey="key"
            tickFormatter={labelOf}
            tick={{ fontSize: dense ? 9.5 : 11, fontWeight: 700, fill: colors.ink }}
            axisLine={false}
            tickLine={false}
            interval={dense ? Math.ceil(data.length / 20) : 0}
            angle={dense ? -35 : 0}
            textAnchor={dense ? 'end' : 'middle'}
            height={dense ? 42 : 22}
          />
          <YAxis hide domain={[0, (d: number) => d * 1.18]} />
          <Tooltip cursor={{ fill: colors.cursor }} content={<ChartTooltip labelFormatter={tooltipLabelOf ?? labelOf} />} />
          <Bar dataKey="value" name={name} maxBarSize={dense ? 22 : 54} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fill={gradient(d.value, min, max, colors.goldLight, colors.gold)} />
            ))}
            {!dense && <LabelList dataKey="value" content={chip} />}
          </Bar>
        </ComposedChart>
      )}
    </AutoSizer>
  );
}
