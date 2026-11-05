import { compareText, distinctByPeriod, stackBy, sumBy, type KeyValue } from '../../common/helpers/aggregation.helper.js';
import { addDays, datePart, isWithin, lastThreeClosedMonths } from '../../common/helpers/date.helper.js';

/**
 * Medidas comuns às duas telas de ROMANEIO (produtos/cabos e patrimônios).
 *
 * As medidas do Power BI, e o que cada uma vira aqui:
 *   - total enviado ......... SUM(unidades) / COUNT(itens de patrimônio)
 *   - média mensal .......... AVERAGEX(VALUES(AnoMes), total) = total / meses com movimento
 *   - média 3 meses ......... total nos 3 meses FECHADOS anteriores / 3
 *   - romaneios ............. DISTINCTCOUNT(número do romaneio)
 *   - média mensal romaneios  romaneios / meses com movimento
 *
 * A média de 3 meses ignora o filtro de período (é o ALL(data) da medida):
 * ela responde "quanto sai por mês ultimamente", com ou sem recorte de data.
 * No Power BI o slicer de data ainda vazava para dentro dela pela tabela de
 * datas automática, e a média zerava ao escolher um mês fora da janela.
 */
export interface PackingAccessors<T> {
  date: (row: T) => string | null;
  quantity: (row: T) => number;
  packing: (row: T) => string | null;
  productCode: (row: T) => string | null;
  product: (row: T) => string | null;
  base: (row: T) => string | null;
  receiver: (row: T) => string | null;
}

export interface PackingKpis {
  total: number;
  monthlyAverage: number;
  threeMonthAverage: number;
  packings: number;
  monthlyPackings: number;
}

export interface PackingProductRow extends PackingKpis {
  productCode: string | null;
  description: string | null;
}

const monthOf = (date: string | null): string | null => (date ? date.slice(0, 7) : null);

function kpisOf<T>(rows: T[], allPeriodRows: T[], a: PackingAccessors<T>): PackingKpis {
  const months = new Set<string>();
  const packings = new Set<string>();
  let total = 0;
  for (const row of rows) {
    total += a.quantity(row);
    const month = monthOf(a.date(row));
    if (month) months.add(month);
    const packing = a.packing(row);
    if (packing) packings.add(packing);
  }
  const window = lastThreeClosedMonths();
  let lastThree = 0;
  for (const row of allPeriodRows) {
    if (isWithin(a.date(row), window.start, window.end)) lastThree += a.quantity(row);
  }
  return {
    total,
    monthlyAverage: months.size ? total / months.size : 0,
    threeMonthAverage: lastThree / 3,
    packings: packings.size,
    monthlyPackings: months.size ? packings.size / months.size : 0,
  };
}

/** "RESUMO POR PRODUTO/PATRIMÔNIO": as mesmas medidas, por produto. */
function byProduct<T>(rows: T[], allPeriodRows: T[], a: PackingAccessors<T>): PackingProductRow[] {
  const keyOf = (row: T) => `${a.productCode(row) ?? ''}|${a.product(row) ?? ''}`;
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const list = groups.get(keyOf(row)) ?? [];
    list.push(row);
    groups.set(keyOf(row), list);
  }
  const allGroups = new Map<string, T[]>();
  for (const row of allPeriodRows) {
    const list = allGroups.get(keyOf(row)) ?? [];
    list.push(row);
    allGroups.set(keyOf(row), list);
  }
  const out: PackingProductRow[] = [];
  for (const [key, list] of groups) {
    const first = list[0] as T;
    out.push({
      productCode: a.productCode(first),
      description: a.product(first),
      ...kpisOf(list, allGroups.get(key) ?? [], a),
    });
  }
  return out.sort((x, y) => y.total - x.total || compareText(x.description ?? '', y.description ?? ''));
}

/**
 * Coluna diária: mostra os últimos 31 dias do recorte. Dois anos de dias
 * viram ~700 barras de altura 1, que ninguém lê — o mês fica no outro gráfico.
 */
function lastDays(series: KeyValue[], endDate: string | undefined, days = 31): { points: KeyValue[]; from: string | null; to: string | null } {
  if (!series.length) return { points: [], from: null, to: null };
  const to = endDate ?? series[series.length - 1]?.key ?? null;
  if (!to) return { points: [], from: null, to: null };
  const from = addDays(to, -(days - 1));
  return { points: series.filter((p) => p.key >= from && p.key <= to), from, to };
}

export function buildPackingPanel<T>(rows: T[], allPeriodRows: T[], a: PackingAccessors<T>, endDate?: string) {
  const daily = distinctByPeriod(rows, (r) => datePart(a.date(r)), a.packing, 'day');
  return {
    kpis: kpisOf(rows, allPeriodRows, a),
    byProduct: byProduct(rows, allPeriodRows, a),
    monthly: distinctByPeriod(rows, a.date, a.packing, 'month'),
    daily: lastDays(daily, endDate),
  };
}

/** "QTD ENVIADA EM ROMANEIO PARA:" — quantidade por recebedor. */
export const quantityByReceiver = <T>(rows: T[], a: PackingAccessors<T>) => sumBy(rows, a.receiver, a.quantity);

/** Barras empilhadas código x base de origem. */
export const quantityByCodeAndBase = <T>(rows: T[], a: PackingAccessors<T>) => stackBy(rows, a.productCode, a.base, a.quantity, 25);
