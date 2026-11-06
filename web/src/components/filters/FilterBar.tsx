import type { ReactNode } from 'react';
import type { UrlFilters } from '../../hooks/useUrlFilters';
import type { FilterOptions } from '../../services/types';
import { labelDate } from '../../utils/format';
import { Icon } from '../ui/Icon';
import { ListFilter } from './ListFilter';
import { PeriodFilter } from './PeriodFilter';
import { SearchFilter } from './SearchFilter';

export type FilterField =
  | { type: 'list'; key: string; label: string }
  | { type: 'search'; key: string; label: string }
  /**
   * Período (data inicial e final). Sem chaves, usa `startDate`/`endDate` (o
   * período principal da tela); uma tela com duas datas dá chaves próprias à
   * segunda (`<campo>From`/`<campo>To`, ver `ranges` em report-filter.ts).
   */
  | { type: 'period'; label: string; startKey?: string; endKey?: string };

type PeriodField = Extract<FilterField, { type: 'period' }>;
const periodKeys = (f: PeriodField) => ({ start: f.startKey ?? 'startDate', end: f.endKey ?? 'endDate' });

interface FilterBarProps {
  fields: FilterField[];
  filters: UrlFilters;
  options: FilterOptions | undefined;
  /** campos que só existem como clique num visual (aparecem nos chips) */
  extraKeys?: { key: string; label: string; format?: (value: string) => string }[];
  /** barra de uma seção da tela: não gruda no topo e não conta na altura útil */
  section?: boolean;
  label?: string;
  children?: ReactNode;
}

const MAX_CHIPS = 12;

/**
 * Barra de filtros numa linha, grudada abaixo da navegação. Os chips dizem o
 * que está filtrando AGORA, um por valor — inclusive o que veio de clique num
 * gráfico, que não tem botão na barra. Filtro que soma mas não se mostra é o
 * caminho mais curto para alguém apresentar número recortado como total.
 */
export function FilterBar({
  fields, filters, options, extraKeys = [], section = false, label = 'Filtros', children,
}: FilterBarProps) {
  const listFields = fields.filter((f): f is Extract<FilterField, { type: 'list' }> => f.type === 'list');
  const periodFields = fields.filter((f): f is PeriodField => f.type === 'period');
  const labels: Record<string, string> = Object.fromEntries([
    ...fields.filter((f) => f.type !== 'period').map((f) => [(f as { key: string }).key, f.label]),
    ...periodFields.map((f) => [periodKeys(f).start, f.label]),
    ...extraKeys.map((e) => [e.key, e.label]),
  ]);
  const listKeys = [...listFields.map((f) => f.key), ...extraKeys.map((e) => e.key)];
  const formats: Record<string, ((value: string) => string) | undefined> = Object.fromEntries(extraKeys.map((e) => [e.key, e.format]));
  const searchKeys = fields.filter((f) => f.type === 'search').map((f) => (f as { key: string }).key);

  const chips: { key: string; value: string; text: string; remove: () => void }[] = [];
  for (const key of listKeys) {
    for (const value of filters.getList(key)) {
      chips.push({ key, value, text: formats[key]?.(value) ?? value, remove: () => filters.toggle(key, value) });
    }
  }
  for (const key of searchKeys) {
    const value = filters.getValue(key);
    if (value) chips.push({ key, value, text: `contém "${value}"`, remove: () => filters.setValues({ [key]: undefined }) });
  }
  for (const field of periodFields) {
    const { start, end } = periodKeys(field);
    const from = filters.getValue(start);
    const to = filters.getValue(end);
    if (!from && !to) continue;
    chips.push({
      key: start,
      value: `${from}-${to}`,
      text: `${from ? labelDate(from) : '…'} – ${to ? labelDate(to) : '…'}`,
      remove: () => filters.setValues({ [start]: undefined, [end]: undefined }),
    });
  }
  const allKeys = [...listKeys, ...searchKeys, ...periodFields.flatMap((f) => Object.values(periodKeys(f)))];

  return (
    <div className={`filtros${section ? ' secao' : ''}`}>
      <span className="rotulo">{label}</span>
      {fields.map((field) => {
        if (field.type === 'period') {
          const { start, end } = periodKeys(field);
          return (
            <PeriodFilter
              key={`period:${start}`}
              label={field.label}
              startDate={filters.getValue(start)}
              endDate={filters.getValue(end)}
              onChange={(r) => filters.setValues({ [start]: r.startDate, [end]: r.endDate })}
            />
          );
        }
        if (field.type === 'search') {
          return (
            <SearchFilter
              key={field.key}
              label={field.label}
              value={filters.getValue(field.key)}
              onChange={(v) => filters.setValues({ [field.key]: v || undefined })}
            />
          );
        }
        return (
          <ListFilter
            key={field.key}
            label={field.label}
            options={options?.[field.key] ?? []}
            value={filters.getList(field.key)}
            onChange={(values) => filters.setList(field.key, values)}
          />
        );
      })}
      {children}
      {chips.length > 0 && (
        <button type="button" className="limpar" onClick={() => filters.clear(allKeys)}>
          <Icon name="fechar" size={12} /> limpar {chips.length} filtro{chips.length > 1 ? 's' : ''}
        </button>
      )}
      {chips.length > 0 && (
        <div className="chips">
          <span className="chips-rotulo">Filtrando por</span>
          {chips.slice(0, MAX_CHIPS).map((c) => (
            <button key={`${c.key}:${c.value}`} type="button" className="chip" onClick={c.remove} title={`Remover ${labels[c.key] ?? 'Período'}: ${c.text}`}>
              <span className="chip-campo">{labels[c.key] ?? 'Período'}</span>
              <span className="chip-valor">{c.text}</span>
              <Icon name="fechar" size={10} />
            </button>
          ))}
          {chips.length > MAX_CHIPS && (
            <span className="chip" title={chips.slice(MAX_CHIPS).map((c) => `${labels[c.key] ?? 'Período'}: ${c.text}`).join('\n')}>
              +{chips.length - MAX_CHIPS}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
