/**
 * Agregações usadas pelos painéis — o equivalente às medidas e aos visuais
 * agrupados do Power BI, sobre as linhas já filtradas.
 */

export interface KeyValue {
  key: string;
  value: number;
}

export const BLANK_LABEL = '(Em branco)';

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
export const compareText = (a: string, b: string): number => collator.compare(a, b);

export function sortByValueDesc(items: KeyValue[]): KeyValue[] {
  return items.sort((a, b) => b.value - a.value || compareText(a.key, b.key));
}

/** Contagem de linhas por chave (AGG Count do Power BI). */
export function countBy<T>(rows: Iterable<T>, keyOf: (row: T) => string | null): KeyValue[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row) ?? BLANK_LABEL;
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  return sortByValueDesc([...totals].map(([key, value]) => ({ key, value })));
}

/** Soma por chave (AGG Sum). */
export function sumBy<T>(rows: Iterable<T>, keyOf: (row: T) => string | null, valueOf: (row: T) => number): KeyValue[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row) ?? BLANK_LABEL;
    totals.set(key, (totals.get(key) ?? 0) + valueOf(row));
  }
  return sortByValueDesc([...totals].map(([key, value]) => ({ key, value })));
}

/** Contagem distinta (DISTINCTCOUNT) — o vazio não conta, como no DAX com BLANK. */
export function distinctCount<T>(rows: Iterable<T>, keyOf: (row: T) => string | number | null): number {
  const seen = new Set<string | number>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key !== null && key !== '') seen.add(key);
  }
  return seen.size;
}

export function sum<T>(rows: Iterable<T>, valueOf: (row: T) => number): number {
  let total = 0;
  for (const row of rows) total += valueOf(row);
  return total;
}

export interface SeriesPoint {
  key: string;
  total: number;
  series: Record<string, number>;
}

/**
 * Categoria x série (barras empilhadas do Power BI: código x base).
 * Devolve as `limit` maiores categorias; as demais somam numa linha "Outros".
 */
export function stackBy<T>(
  rows: Iterable<T>,
  categoryOf: (row: T) => string | null,
  seriesOf: (row: T) => string | null,
  valueOf: (row: T) => number,
  limit = 25,
): { points: SeriesPoint[]; series: string[]; others: number } {
  const byCategory = new Map<string, SeriesPoint>();
  const seriesTotals = new Map<string, number>();
  for (const row of rows) {
    const category = categoryOf(row) ?? BLANK_LABEL;
    const series = seriesOf(row) ?? BLANK_LABEL;
    const value = valueOf(row);
    let point = byCategory.get(category);
    if (!point) {
      point = { key: category, total: 0, series: {} };
      byCategory.set(category, point);
    }
    point.total += value;
    point.series[series] = (point.series[series] ?? 0) + value;
    seriesTotals.set(series, (seriesTotals.get(series) ?? 0) + value);
  }
  const sorted = [...byCategory.values()].sort((a, b) => b.total - a.total || compareText(a.key, b.key));
  const series = [...seriesTotals].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  return { points: sorted.slice(0, limit), series, others: Math.max(0, sorted.length - limit) };
}

/** Distintos por período (mês 'AAAA-MM' ou dia 'AAAA-MM-DD'). */
export function distinctByPeriod<T>(
  rows: Iterable<T>,
  dateOf: (row: T) => string | null,
  keyOf: (row: T) => string | null,
  granularity: 'month' | 'day',
): KeyValue[] {
  const size = granularity === 'month' ? 7 : 10;
  const sets = new Map<string, Set<string>>();
  for (const row of rows) {
    const date = dateOf(row);
    const key = keyOf(row);
    if (!date || key === null || key === '') continue;
    const period = date.slice(0, size);
    const set = sets.get(period) ?? new Set<string>();
    set.add(key);
    sets.set(period, set);
  }
  return [...sets].map(([key, set]) => ({ key, value: set.size })).sort((a, b) => a.key.localeCompare(b.key));
}
