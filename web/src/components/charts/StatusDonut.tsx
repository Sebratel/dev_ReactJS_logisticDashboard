import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import type { KeyValue } from '../../services/types';
import { int } from '../../utils/format';
import { Empty } from '../ui/States';
import { AutoSizer } from './AutoSizer';
import { ChartTooltip } from './ChartTooltip';

interface StatusDonutProps {
  data: KeyValue[];
  colorOf: (key: string) => string;
  onSelect?: (key: string) => void;
  selected?: string[];
}

/** Pizza do STATUS GERAL (disponível x indisponível), com o percentual na legenda. */
export function StatusDonut({ data, colorOf, onSelect, selected = [] }: StatusDonutProps) {
  const { colors } = useTheme();
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <Empty />;
  const hasSelection = selected.length > 0;

  return (
    <>
      <AutoSizer minHeight={200}>
        {({ width, height }) => {
          const radius = Math.max(60, Math.min(width, height) / 2 - 12);
          return (
            <PieChart width={width} height={height}>
              <Tooltip content={<ChartTooltip />} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="key"
                innerRadius={radius * 0.55}
                outerRadius={radius}
                stroke={colors.grid}
                strokeWidth={1}
                isAnimationActive={false}
                cursor={onSelect ? 'pointer' : undefined}
                onClick={onSelect ? (entry: { key?: string }) => { if (entry.key) onSelect(entry.key); } : undefined}
              >
                {data.map((d) => (
                  <Cell key={d.key} fill={colorOf(d.key)} fillOpacity={hasSelection && !selected.includes(d.key) ? 0.32 : 1} />
                ))}
              </Pie>
            </PieChart>
          );
        }}
      </AutoSizer>
      <div className="legend">
        {data.map((d) => (
          <span key={d.key}>
            <i style={{ background: colorOf(d.key) }} />
            {d.key}: <b>{int(d.value)}</b> ({Math.round((d.value / total) * 100)}%)
          </span>
        ))}
      </div>
    </>
  );
}
