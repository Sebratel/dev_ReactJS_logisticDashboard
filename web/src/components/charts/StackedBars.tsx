import { Bar, CartesianGrid, Cell, ComposedChart, LabelList, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import type { StackedSeries } from '../../services/types';
import { baseColor } from '../../utils/chartColors';
import { int } from '../../utils/format';
import { Empty } from '../ui/States';
import { AutoSizer } from './AutoSizer';
import { ChartTooltip } from './ChartTooltip';

interface StackedBarsProps {
  data: StackedSeries;
  onSelect?: (category: string) => void;
  selected?: string[];
}

interface LabelProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  index?: number;
}

/**
 * Barras horizontais empilhadas código x base (o "barChart" do relatório).
 * A cor de cada base é fixa (ver `baseColor`): um filtro que tira uma base do
 * gráfico não repinta as outras. Clicar numa barra filtra a tela pelo código
 * e a barra escolhida fica destacada, sem as outras sumirem.
 */
export function StackedBars({ data, onSelect, selected = [] }: StackedBarsProps) {
  const { colors } = useTheme();
  if (!data.points.length) return <Empty />;
  const rows = data.points.map((p) => ({ key: p.key, total: p.total, ...p.series }));
  const hasSelection = selected.length > 0;
  const last = data.series.length - 1;

  const totalLabel = ({ x = 0, y = 0, width = 0, height = 0, index = 0 }: LabelProps) => (
    <text
      x={Number(x) + Number(width) + 6}
      y={Number(y) + Number(height) / 2}
      dominantBaseline="central"
      fontSize={10.5}
      fontWeight={700}
      fill={colors.ink}
      pointerEvents="none"
    >
      {int(rows[index]?.total ?? 0)}
    </text>
  );

  return (
    <>
      <div className="legend">
        {data.series.map((s) => (
          <span key={s}><i style={{ background: baseColor(s, colors) }} />{s}</span>
        ))}
      </div>
      <AutoSizer minHeight={Math.max(160, rows.length * 18 + 20)}>
        {({ width, height }) => {
          const barSize = Math.max(7, Math.min(16, (height - 20) / rows.length - 4));
          return (
            <ComposedChart width={width} height={height} data={rows} layout="vertical" margin={{ top: 2, right: 52, bottom: 2, left: 2 }}>
              <CartesianGrid horizontal={false} stroke={colors.grid} strokeDasharray="4 4" />
              <XAxis type="number" hide domain={[0, (d: number) => d * 1.08]} />
              <YAxis
                type="category"
                dataKey="key"
                width={62}
                tick={{ fontSize: 10.5, fontWeight: 700, fill: colors.ink }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <Tooltip cursor={{ fill: colors.cursor }} content={<ChartTooltip labelFormatter={(k) => `Código ${k}`} />} />
              {data.series.map((s, i) => (
                <Bar
                  key={s}
                  dataKey={s}
                  name={s}
                  stackId="base"
                  fill={baseColor(s, colors)}
                  isAnimationActive={false}
                  barSize={barSize}
                  radius={i === last ? [0, 4, 4, 0] : 0}
                  cursor={onSelect ? 'pointer' : undefined}
                  onClick={onSelect ? (entry: { key?: string }) => { if (entry.key) onSelect(entry.key); } : undefined}
                >
                  {rows.map((r) => (
                    <Cell
                      key={r.key}
                      fill={baseColor(s, colors)}
                      fillOpacity={hasSelection && !selected.includes(r.key) ? 0.32 : 1}
                    />
                  ))}
                  {i === last && <LabelList dataKey={s} content={totalLabel} />}
                </Bar>
              ))}
            </ComposedChart>
          );
        }}
      </AutoSizer>
    </>
  );
}
