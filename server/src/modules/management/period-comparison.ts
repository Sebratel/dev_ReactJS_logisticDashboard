import { todayIso } from '../../common/helpers/date.helper.js';

/**
 * Os períodos das telas Gerencial — as colunas DAX do `Calendario` do Power BI
 * "LOG - Gerencial", que marcavam com 1 (atual) e 2 (anterior) as datas de
 * cada comparação:
 *
 *  - MES_ATUAL_ANTERIOR            último mês FECHADO x o mês antes dele;
 *  - MES_ATUAL_ANTERIOR_ANO        último mês fechado x o mesmo mês do ano anterior;
 *  - TRIMESTRE_ATUAL_ANTERIOR      último trimestre fechado x o trimestre antes dele;
 *  - TRIMESTRE_ATUAL_ANTERIOR_ANO  último trimestre fechado x o mesmo trimestre do ano anterior;
 *  - ANO_ATUAL_ANTERIOR            ano corrente (até hoje) x o ano anterior inteiro.
 *    No Power BI os anos estavam escritos na fórmula (2026 e 2025); aqui saem da data.
 *
 * Datas como texto AAAA-MM-DD, intervalos fechados.
 */
export interface Period {
  key: string;
  label: string;
  from: string;
  to: string;
}

export interface PeriodPair {
  previous: Period;
  current: Period;
}

export type ComparisonKind = 'months' | 'monthsYearAgo' | 'quarters' | 'quartersYearAgo' | 'years';
export const COMPARISON_KINDS: readonly ComparisonKind[] = ['months', 'monthsYearAgo', 'quarters', 'quartersYearAgo', 'years'];

const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const pad = (n: number) => String(n).padStart(2, '0');
const lastDayOf = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

interface YearMonth { year: number; month: number }

/** Soma `delta` meses (pode virar o ano). `month` de 1 a 12. */
export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export const monthKey = ({ year, month }: YearMonth) => `${year}-${pad(month)}`;
export const monthLabel = ({ year, month }: YearMonth) => `${MONTH_LABELS[month - 1]}/${year}`;

export function monthPeriod(ym: YearMonth): Period {
  return {
    key: monthKey(ym),
    label: monthLabel(ym),
    from: `${monthKey(ym)}-01`,
    to: `${monthKey(ym)}-${pad(lastDayOf(ym.year, ym.month))}`,
  };
}

function quarterPeriod(year: number, quarter: number): Period {
  const last = quarter * 3;
  return {
    key: `${year}-T${quarter}`,
    label: `${quarter}º tri/${year}`,
    from: `${year}-${pad(last - 2)}-01`,
    to: `${year}-${pad(last)}-${pad(lastDayOf(year, last))}`,
  };
}

const yearPeriod = (year: number): Period => ({ key: String(year), label: String(year), from: `${year}-01-01`, to: `${year}-12-31` });

const parse = (today: string): YearMonth => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });

export function comparisonPeriods(today: string = todayIso()): Record<ComparisonKind, PeriodPair> {
  const now = parse(today);
  const lastMonth = shiftMonth(now, -1);
  const quarterNow = Math.ceil(now.month / 3);
  const lastQuarter = quarterNow === 1 ? { year: now.year - 1, quarter: 4 } : { year: now.year, quarter: quarterNow - 1 };
  const quarterBefore = lastQuarter.quarter === 1
    ? { year: lastQuarter.year - 1, quarter: 4 }
    : { year: lastQuarter.year, quarter: lastQuarter.quarter - 1 };
  return {
    months: { previous: monthPeriod(shiftMonth(now, -2)), current: monthPeriod(lastMonth) },
    monthsYearAgo: { previous: monthPeriod({ year: lastMonth.year - 1, month: lastMonth.month }), current: monthPeriod(lastMonth) },
    quarters: { previous: quarterPeriod(quarterBefore.year, quarterBefore.quarter), current: quarterPeriod(lastQuarter.year, lastQuarter.quarter) },
    quartersYearAgo: {
      previous: quarterPeriod(lastQuarter.year - 1, lastQuarter.quarter),
      current: quarterPeriod(lastQuarter.year, lastQuarter.quarter),
    },
    years: { previous: yearPeriod(now.year - 1), current: yearPeriod(now.year) },
  };
}

/**
 * Os meses de um histórico, do mês de `from` até o mês corrente (inclusive).
 * Cada um com o intervalo cortado em `from` e em `today`.
 */
export function historyMonths(from: string, today: string = todayIso()): Period[] {
  const out: Period[] = [];
  const end = parse(today);
  for (let ym = parse(from); ym.year * 12 + ym.month <= end.year * 12 + end.month; ym = shiftMonth(ym, 1)) {
    const period = monthPeriod(ym);
    out.push({ ...period, from: period.from < from ? from : period.from, to: period.to > today ? today : period.to });
  }
  return out;
}

/**
 * "PRODUTIVIDADE ALMOX": os dois últimos meses fechados (o filtro relativo
 * dos gráficos do Power BI). `from`/`to` são o intervalo da consulta, com o
 * fim exclusivo (1º dia do mês corrente).
 */
export function productivityMonths(today: string = todayIso()) {
  const now = parse(today);
  const months = [monthPeriod(shiftMonth(now, -2)), monthPeriod(shiftMonth(now, -1))] as const;
  return { months, from: months[0].from, to: `${monthKey(now)}-01` };
}

/** "Variação %": atual ÷ anterior − 1. Sem valor anterior não há variação (o Power BI mostrava −100%). */
export function percentChange(current: number, previous: number): number | null {
  return previous ? current / previous - 1 : null;
}
