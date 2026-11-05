import type { ReactNode } from 'react';
import { ComparisonColumns, seriesColor } from '../charts/ComparisonColumns';
import { Empty } from '../ui/States';
import { Visual } from '../ui/Visual';
import { useTheme } from '../../context/ThemeContext';
import type { Comparison, ComparisonKind, ComparisonReport, SeriesDefinition } from '../../services/types';
import { int, labelMonth, pct, signedPct, signedPoints } from '../../utils/format';

/** Os cinco gráficos de comparação, na ordem e com os títulos do Power BI. */
const KINDS: { kind: ComparisonKind; title: string; className: string }[] = [
  { kind: 'months', title: 'Comparação entre meses', className: 'v-ger' },
  { kind: 'monthsYearAgo', title: 'Comparação entre meses (ano anterior)', className: 'v-ger' },
  { kind: 'years', title: 'Comparação entre anos', className: 'v-ger v-ger-ano' },
  { kind: 'quarters', title: 'Comparação entre trimestres', className: 'v-ger' },
  { kind: 'quartersYearAgo', title: 'Comparação entre trimestres (ano anterior)', className: 'v-ger' },
];

interface ComparisonDashboardProps {
  report: ComparisonReport;
  format?: (value: number) => string;
  /** o que o histórico mostra, por mês (subtítulo) */
  historyNote: string;
  /** nota de rodapé de um gráfico (ex.: o que o do ano tira) */
  notes?: Partial<Record<ComparisonKind, string>>;
  /** texto acima dos gráficos */
  intro?: ReactNode;
}

/** Variação do cartão: verde subindo, vinho caindo (como os cartões do Power BI). */
function ChangeBadge({ value }: { value: number | null }) {
  const tone = value === null ? '' : value > 0 ? ' sobe' : value < 0 ? ' desce' : '';
  return <span className={`variacao${tone}`} title="Variação: atual ÷ anterior − 1">{signedPct(value)}</span>;
}

function Legend({ series, comparison }: { series: SeriesDefinition[]; comparison: Comparison }) {
  const { colors } = useTheme();
  if (series.length < 2) return null;
  const { shares } = comparison;
  return (
    <ul className="ger-legenda">
      {series.map((s, i) => Boolean(shares || comparison.previous.values[s.key] || comparison.current.values[s.key]) && (
        <li key={s.key}>
          <i style={{ background: seriesColor(i, colors) }} />
          <span className="nome">{s.label}</span>
          {shares ? (
            <span className="parte" title={`${comparison.previous.label} → ${comparison.current.label}`}>
              {pct(shares.previous[s.key])} → {pct(shares.current[s.key])}
              <b className={`pp${(shares.change[s.key] ?? 0) > 0 ? ' sobe' : (shares.change[s.key] ?? 0) < 0 ? ' desce' : ''}`}>
                {signedPoints(shares.change[s.key])}
              </b>
            </span>
          ) : (
            <span className="parte">{int(comparison.previous.values[s.key] ?? 0)} → {int(comparison.current.values[s.key] ?? 0)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * As telas Gerencial de comparação (Power BI "LOG - Gerencial"): mês,
 * mês x ano anterior e ano em cima (o do ano ocupa as duas linhas), trimestre
 * e trimestre x ano anterior embaixo, e o histórico mês a mês. Cada gráfico
 * leva o cartão de variação no cabeçalho.
 */
export function ComparisonDashboard({ report, format = int, historyNote, notes = {}, intro }: ComparisonDashboardProps) {
  const { series } = report;
  return (
    <>
      {intro && <p className="ger-intro">{intro}</p>}
      <div className="grid linha-ger">
        {KINDS.map(({ kind, title, className }) => {
          const c = report.comparisons[kind];
          return (
            <Visual
              key={kind}
              title={title}
              subtitle={`${c.previous.label} × ${c.current.label}${notes[kind] ? ` · ${notes[kind]}` : ''}`}
              className={className}
              actions={<ChangeBadge value={c.change} />}
            >
              <div className="ger-grafico">
                <ComparisonColumns data={[c.previous, c.current]} series={series} format={format} />
              </div>
              <Legend series={series} comparison={c} />
            </Visual>
          );
        })}
      </div>
      <Visual title="Histórico" subtitle={historyNote}>
        {report.history.length
          ? <ComparisonColumns data={report.history} series={series} format={format} labelOf={(p) => labelMonth(p.key)} />
          : <Empty />}
      </Visual>
    </>
  );
}
