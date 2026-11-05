import { useCallback, useState } from 'react';
import { useDismiss } from '../../hooks/useDismiss';
import { labelDate, toIsoDate, todayIso } from '../../utils/format';
import { Icon } from '../ui/Icon';

interface Preset {
  id: string;
  label: string;
  range: () => { startDate?: string; endDate?: string };
}

const today = () => new Date();
const firstOfMonth = (offset: number) => {
  const d = today();
  return toIsoDate(new Date(d.getFullYear(), d.getMonth() + offset, 1));
};
const lastOfMonth = (offset: number) => {
  const d = today();
  return toIsoDate(new Date(d.getFullYear(), d.getMonth() + offset + 1, 0));
};
const daysAgo = (n: number) => {
  const d = today();
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n));
};

export const PERIOD_PRESETS: Preset[] = [
  { id: 'all', label: 'Todo o período', range: () => ({}) },
  { id: 'month', label: 'Este mês', range: () => ({ startDate: firstOfMonth(0), endDate: todayIso() }) },
  { id: 'lastMonth', label: 'Mês passado', range: () => ({ startDate: firstOfMonth(-1), endDate: lastOfMonth(-1) }) },
  { id: '30d', label: 'Últimos 30 dias', range: () => ({ startDate: daysAgo(29), endDate: todayIso() }) },
  { id: '3m', label: 'Últimos 3 meses', range: () => ({ startDate: firstOfMonth(-2), endDate: todayIso() }) },
  { id: 'year', label: 'Este ano', range: () => ({ startDate: `${today().getFullYear()}-01-01`, endDate: todayIso() }) },
];

interface PeriodFilterProps {
  label: string;
  startDate: string;
  endDate: string;
  onChange: (range: { startDate?: string; endDate?: string }) => void;
}

/** Período com atalhos: quase ninguém quer digitar data. */
export function PeriodFilter({ label, startDate, endDate, onChange }: PeriodFilterProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);

  const active = PERIOD_PRESETS.find((p) => {
    const r = p.range();
    return (r.startDate ?? '') === startDate && (r.endDate ?? '') === endDate;
  });
  const summary = active ? active.label : `${startDate ? labelDate(startDate) : '…'} – ${endDate ? labelDate(endDate) : '…'}`;

  return (
    <div className={`filtro${startDate || endDate ? ' ativo' : ''}`} ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`${label}: ${summary}`} aria-expanded={open}>
        <span className="nome">{label}</span>
        <span className="valor">{summary}</span>
        <Icon name="baixo" size={12} className="seta" />
      </button>
      {open && (
        <div className="pop pop-periodo">
          <div className="datas">
            <input type="date" value={startDate} max={endDate || undefined} onChange={(e) => onChange({ startDate: e.target.value, endDate })} aria-label="Data inicial" />
            <span>até</span>
            <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => onChange({ startDate, endDate: e.target.value })} aria-label="Data final" />
          </div>
          <div className="presets">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={active?.id === p.id ? 'on' : ''}
                onClick={() => { onChange(p.range()); setOpen(false); }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
