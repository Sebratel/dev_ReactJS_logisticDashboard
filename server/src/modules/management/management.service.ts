import { compareText } from '../../common/helpers/aggregation.helper.js';
import { MANAGEMENT_HISTORY_FROM, ZTE_CLASSIFIED_MODELS, ZTE_ORIGIN_OUT_OF_SCOPE } from '../../model/business-rules.js';
import type { DailyValue, DataModel, ZteReturnDaily } from '../../model/model.types.js';
import {
  COMPARISON_KINDS, comparisonPeriods, historyMonths, monthPeriod, percentChange, productivityMonths, shiftMonth,
  type ComparisonKind, type Period,
} from './period-comparison.js';

/**
 * Telas da seção GERENCIAL — réplica do Power BI "LOG - Gerencial".
 *
 * Cinco das seis telas têm o mesmo desenho: o valor de cada período em
 * cinco comparações (mês, mês x ano anterior, trimestre, trimestre x ano
 * anterior e ano — ver `period-comparison.ts`), o cartão de variação de cada
 * uma e o histórico mês a mês. Muda só o que se mede e se há mais de uma série
 * (novos x usados, origem do retorno). A sexta é a produtividade por pessoa.
 */

export interface SeriesDefinition {
  key: string;
  label: string;
}

/** O valor de um período: total e por série. */
export interface PeriodValues {
  key: string;
  label: string;
  total: number;
  values: Record<string, number>;
}

export interface Comparison {
  previous: PeriodValues;
  current: PeriodValues;
  /** "Variação %": atual ÷ anterior − 1 (null sem valor anterior) */
  change: number | null;
  /** com mais de uma série: participação de cada uma em cada período e a diferença em pontos percentuais */
  shares?: { previous: Record<string, number | null>; current: Record<string, number | null>; change: Record<string, number | null> };
}

export interface ComparisonReport {
  series: SeriesDefinition[];
  comparisons: Record<ComparisonKind, Comparison>;
  history: PeriodValues[];
}

type ValuesOf = (period: Period) => Record<string, number>;

const total = (values: Record<string, number>) => Object.values(values).reduce((s, v) => s + v, 0);
const periodValues = (period: Period, values: Record<string, number>): PeriodValues => ({
  key: period.key, label: period.label, total: total(values), values,
});

/** Soma de uma série diária (em ordem) num intervalo fechado. */
export function sumBetween(rows: readonly DailyValue[], from: string, to: string): number {
  let sum = 0;
  for (const row of rows) {
    if (row.day < from) continue;
    if (row.day > to) break;
    sum += row.value;
  }
  return sum;
}

/** Quantos dias de uma lista em ordem vêm até `to` (inclusive) — o acumulado. */
export function countUntil(days: readonly string[], to: string): number {
  let lo = 0;
  let hi = days.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((days[mid] as string) <= to) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function shareOf(values: Record<string, number>, series: readonly SeriesDefinition[]): Record<string, number | null> {
  const sum = total(values);
  return Object.fromEntries(series.map((s) => [s.key, sum ? (values[s.key] ?? 0) / sum : null]));
}

interface BuildOptions {
  series: SeriesDefinition[];
  today: string;
  valuesOf: ValuesOf;
  historyFrom: string;
  /** valores do gráfico diferentes dos do cartão de variação (ex.: o ano dos ZTE usados) */
  chartValuesOf?: Partial<Record<ComparisonKind | 'history', ValuesOf>>;
}

function buildComparisonReport({ series, today, valuesOf, historyFrom, chartValuesOf = {} }: BuildOptions): ComparisonReport {
  const periods = comparisonPeriods(today);
  const comparisons = {} as Record<ComparisonKind, Comparison>;
  for (const kind of COMPARISON_KINDS) {
    const { previous, current } = periods[kind];
    const chart = chartValuesOf[kind] ?? valuesOf;
    const card = { previous: valuesOf(previous), current: valuesOf(current) };
    const comparison: Comparison = {
      previous: periodValues(previous, chart(previous)),
      current: periodValues(current, chart(current)),
      change: percentChange(total(card.current), total(card.previous)),
    };
    if (series.length > 1) {
      const before = shareOf(card.previous, series);
      const after = shareOf(card.current, series);
      comparison.shares = {
        previous: before,
        current: after,
        change: Object.fromEntries(series.map((s) => {
          const a = after[s.key];
          const b = before[s.key];
          return [s.key, a === null || a === undefined || b === null || b === undefined ? null : a - b];
        })),
      };
    }
    comparisons[kind] = comparison;
  }
  const historyOf = chartValuesOf.history ?? valuesOf;
  return { series, comparisons, history: historyMonths(historyFrom, today).map((p) => periodValues(p, historyOf(p))) };
}

// ------------------------------------------------------------------ as telas

/** "OBJETOS CRIADOS": patrimônios criados no Voalle. */
export function buildCreatedObjectsReport(model: DataModel, today: string): ComparisonReport {
  return buildComparisonReport({
    series: [{ key: 'objects', label: 'Objetos criados' }],
    today,
    historyFrom: MANAGEMENT_HISTORY_FROM,
    valuesOf: (p) => ({ objects: sumBetween(model.createdObjects, p.from, p.to) }),
  });
}

/** "CONSUMO DE FLAT": metros do cabo flat entregues pelo almoxarifado. */
export function buildFlatConsumptionReport(model: DataModel, today: string): ComparisonReport {
  return buildComparisonReport({
    series: [{ key: 'meters', label: 'Metros' }],
    today,
    historyFrom: MANAGEMENT_HISTORY_FROM,
    valuesOf: (p) => ({ meters: sumBetween(model.flatConsumption, p.from, p.to) }),
  });
}

const sumReturns = (rows: readonly ZteReturnDaily[], from: string, to: string, keep: (row: ZteReturnDaily) => boolean = () => true) => {
  let sum = 0;
  for (const row of rows) {
    if (row.day < from) continue;
    if (row.day > to) break;
    if (keep(row)) sum += row.returns;
  }
  return sum;
};

/** "MOVIMENTAÇÕES ZTE": ONUs novas (primeiro romaneio) x usadas (voltas do laboratório). */
export function buildZteMovementsReport(model: DataModel, today: string): ComparisonReport {
  return buildComparisonReport({
    series: [{ key: 'used', label: 'Usados' }, { key: 'new', label: 'Novos' }],
    today,
    historyFrom: MANAGEMENT_HISTORY_FROM,
    valuesOf: (p) => ({ used: sumReturns(model.zteReturns, p.from, p.to), new: sumBetween(model.zteDispatches, p.from, p.to) }),
  });
}

/** Ordem das origens no gráfico (as que não aparecem nos dados ficam de fora). */
const ORIGIN_ORDER = ['CANCELAMENTO', 'MANUTENÇÃO', ZTE_ORIGIN_OUT_OF_SCOPE, 'SEM ORIGEM IDENTIFICADA'];
const CLASSIFIED_MODELS: ReadonlySet<string> = new Set(ZTE_CLASSIFIED_MODELS);

/**
 * "ZTE - USADOS": as voltas do laboratório por origem, só dos modelos da
 * consulta "USADOS CLASSIFICADO". Como no Power BI, o conserto interno
 * ("fora do escopo") sai dos gráficos de ANO e HISTÓRICO, mas não dos de mês e
 * trimestre nem dos cartões de variação (inclusive o do ano).
 */
export function buildZteUsedReport(model: DataModel, today: string): ComparisonReport {
  const rows = model.zteReturns.filter((r) => CLASSIFIED_MODELS.has(r.model));
  const present = new Set(rows.map((r) => r.origin));
  const series = [...ORIGIN_ORDER.filter((o) => present.has(o)), ...[...present].filter((o) => !ORIGIN_ORDER.includes(o)).sort(compareText)]
    .map((origin) => ({ key: origin, label: origin }));
  const byOrigin = (keep: (origin: string) => boolean): ValuesOf => (p) => Object.fromEntries(
    series.filter((s) => keep(s.key)).map((s) => [s.key, sumReturns(rows, p.from, p.to, (r) => r.origin === s.key)]),
  );
  const inScope = byOrigin((o) => o !== ZTE_ORIGIN_OUT_OF_SCOPE);
  const report = buildComparisonReport({
    series,
    today,
    historyFrom: MANAGEMENT_HISTORY_FROM,
    valuesOf: byOrigin(() => true),
    chartValuesOf: { years: inScope, history: inScope },
  });
  // a participação de cada origem não existia no Power BI desta página
  for (const kind of COMPARISON_KINDS) delete report.comparisons[kind].shares;
  return report;
}

/**
 * "EQUIPAMENTOS OBSOLETOS": seriais DISTINTOS acumulados até o fim de cada
 * período (a medida AcumuladoSeriaisAteMesSelecionado). Histórico dos
 * últimos dois anos (o filtro relativo do visual).
 */
export function buildObsoleteEquipmentReport(model: DataModel, today: string): ComparisonReport {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  // "Inicio do Mes" entre hoje + 1 dia − 2 anos e hoje: o primeiro mês que começa nesse intervalo
  const lower = new Date(Date.UTC(y - 2, m - 1, d + 1)).toISOString().slice(0, 10);
  const firstMonth = lower.endsWith('-01') ? lower.slice(0, 7) : monthPeriod(shiftMonth({ year: Number(lower.slice(0, 4)), month: Number(lower.slice(5, 7)) }, 1)).key;
  return buildComparisonReport({
    series: [{ key: 'serials', label: 'Seriais acumulados' }],
    today,
    historyFrom: `${firstMonth}-01`,
    valuesOf: (p) => ({ serials: countUntil(model.obsoleteFirstDays, p.to > today ? today : p.to) }),
  });
}

// ------------------------------------------------------------------ produtividade

export interface ProductivityMonth {
  /** romaneios: descrições DISTINTAS da ocorrência */
  packings: number;
  /** patrimônios: ocorrências "Enviado em Romaneio" */
  patrimonies: number;
}

export interface ProductivityPerson {
  name: string;
  months: ProductivityMonth[];
  packingsChange: number | null;
  patrimoniesChange: number | null;
  /** média dos dois meses ("Média ... por Pessoa (Últimos 2 meses)" com uma pessoa só) */
  averagePackings: number;
  averagePatrimonies: number;
}

export interface ProductivityReport {
  months: { key: string; label: string }[];
  people: ProductivityPerson[];
  total: {
    months: ProductivityMonth[];
    packingsChange: number | null;
    patrimoniesChange: number | null;
    /** média por pessoa de cada mês (só quem enviou algo no mês), e a média dos dois meses */
    averagePackingsPerPerson: number;
    averagePatrimoniesPerPerson: number;
  };
}

/**
 * "PRODUTIVIDADE ALMOX": os dois últimos meses fechados de quem está na lista
 * (editável na Administração). Romaneio = descrição distinta da ocorrência;
 * no total, distinta entre todas as pessoas.
 */
export function buildProductivityReport(model: DataModel, staff: readonly string[], today: string): ProductivityReport {
  const { months } = productivityMonths(today);
  const keys = months.map((p) => p.key);
  const names = new Set(staff);
  const per = new Map<string, { descriptions: Set<string | null>; patrimonies: number }[]>();
  const all = keys.map(() => ({ descriptions: new Set<string | null>(), patrimonies: 0 }));
  for (const name of names) per.set(name, keys.map(() => ({ descriptions: new Set<string | null>(), patrimonies: 0 })));
  for (const row of model.packingProductivity) {
    const i = keys.indexOf(row.month);
    const slots = per.get(row.name);
    if (i < 0 || !slots) continue;
    const slot = slots[i]!;
    slot.descriptions.add(row.description);
    slot.patrimonies += row.patrimonies;
    all[i]!.descriptions.add(row.description);
    all[i]!.patrimonies += row.patrimonies;
  }
  const monthsOf = (slots: { descriptions: Set<string | null>; patrimonies: number }[]): ProductivityMonth[] => (
    slots.map((s) => ({ packings: s.descriptions.size, patrimonies: s.patrimonies }))
  );
  const people = [...per].map(([name, slots]): ProductivityPerson => {
    const ms = monthsOf(slots);
    const [a, b] = ms as [ProductivityMonth, ProductivityMonth];
    return {
      name,
      months: ms,
      packingsChange: percentChange(b.packings, a.packings),
      patrimoniesChange: percentChange(b.patrimonies, a.patrimonies),
      averagePackings: (a.packings + b.packings) / 2,
      averagePatrimonies: (a.patrimonies + b.patrimonies) / 2,
    };
  }).sort((x, y) => (y.months[1]?.patrimonies ?? 0) - (x.months[1]?.patrimonies ?? 0) || compareText(x.name, y.name));

  // AVERAGEX ignora quem não tem valor no mês: a média é só entre quem enviou algo
  const averageOf = (i: number, pick: (m: ProductivityMonth) => number) => {
    const values = people.map((p) => pick(p.months[i]!)).filter((v) => v > 0);
    return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  };
  const totalMonths = monthsOf(all);
  const [ta, tb] = totalMonths as [ProductivityMonth, ProductivityMonth];
  return {
    months: months.map((p) => ({ key: p.key, label: p.label })),
    people,
    total: {
      months: totalMonths,
      packingsChange: percentChange(tb.packings, ta.packings),
      patrimoniesChange: percentChange(tb.patrimonies, ta.patrimonies),
      averagePackingsPerPerson: (averageOf(0, (m) => m.packings) + averageOf(1, (m) => m.packings)) / 2,
      averagePatrimoniesPerPerson: (averageOf(0, (m) => m.patrimonies) + averageOf(1, (m) => m.patrimonies)) / 2,
    },
  };
}
