import { compareText, type KeyValue } from '../../common/helpers/aggregation.helper.js';
import type { ChargedPatrimony, ChargedProduct, DataModel } from '../../model/model.types.js';
import { activityOf } from './packing-lists.service.js';
import { applyFilters, DETAIL_ROW_LIMIT, limitRows, type FilterSelection, type FilterSpec } from './report-filter.js';

/**
 * Telas EM CARGA — réplica das páginas "SALDO PATRIMÔNIO" e "SALDO PRODUTO" do
 * Power BI "LOG - Objetos em Carga": o que está com cada pessoa da empresa.
 *
 * Agregações conferidas no código de cada campo do visual: a QUANTIDADE do
 * patrimônio é contagem DISTINTA do número do patrimônio; a do produto (na
 * tabela por responsável), contagem DISTINTA da descrição; o gráfico de
 * produto soma a quantidade. Por decisão da área (04/11/2026), o valor do
 * patrimônio conta cada patrimônio uma vez e o do produto é quantidade x preço
 * unitário — ver README, "Divergências".
 */

const MS_PER_DAY = 86_400_000;

/** "TEMPO (DIAS)": dias desde a última movimentação até hoje (DATEDIFF em dias). */
export function daysSince(date: string | null, today: string): number | null {
  if (!date) return null;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / MS_PER_DAY);
}

const distinct = <T>(rows: readonly T[], keyOf: (row: T) => unknown): number => new Set(rows.map(keyOf)).size;

const byValueDesc = <T extends { key?: string; holder?: string; value: number }>(a: T, b: T) => b.value - a.value
  || compareText(a.holder ?? a.key ?? '', b.holder ?? b.key ?? '');

// ------------------------------------------------------------------ patrimônio

export const chargedPatrimonySpec = (model: DataModel): FilterSpec<ChargedPatrimony> => ({
  lists: [
    { key: 'base', values: (r) => r.base },
    { key: 'description', values: (r) => r.description },
    { key: 'holder', values: (r) => r.holder },
    // "ATIVO?": casa o nome do responsável com os usuários do Voalle
    { key: 'active', includeBlank: false, values: (r) => activityOf(model, r.holder) },
    { key: 'productCode', values: (r) => r.productCode },
    // cadastro do PATRIMÔNIO no Voalle (p.active / p.deleted)
    { key: 'itemActive', values: (r) => r.active },
    { key: 'itemDeleted', values: (r) => r.deleted },
  ],
});

export interface HolderRow {
  holder: string;
  quantity: number;
  value: number;
}

export interface ChargedPatrimonyRow {
  holder: string;
  base: string;
  productCode: string | null;
  description: string | null;
  serialNumber: string | null;
  patrimonyTag: string | null;
  movedAt: string | null;
  days: number | null;
  value: number | null;
}

/** "VISÃO GERAL": por responsável (A-Z), como o Power BI; depois descrição e patrimônio. */
export const sortChargedPatrimonies = (rows: ChargedPatrimony[]): ChargedPatrimony[] => rows.sort((a, b) => compareText(a.holder, b.holder)
  || compareText(a.description ?? '', b.description ?? '') || compareText(a.patrimonyTag ?? '', b.patrimonyTag ?? ''));

export const toChargedPatrimonyRow = (r: ChargedPatrimony, today: string): ChargedPatrimonyRow => ({
  holder: r.holder,
  base: r.base,
  productCode: r.productCode,
  description: r.description,
  serialNumber: r.serialNumber,
  patrimonyTag: r.patrimonyTag,
  movedAt: r.movedAt,
  days: daysSince(r.movedAt, today),
  value: r.value,
});

export function buildChargedPatrimoniesReport(model: DataModel, selection: FilterSelection, today: string) {
  const { rows, options } = applyFilters(model.chargedPatrimonies, chargedPatrimonySpec(model), selection);

  const byHolderMap = new Map<string, { tags: Set<string | null>; value: number }>();
  const byBaseMap = new Map<string, Set<string | null>>();
  let value = 0;
  for (const r of rows) {
    const h = byHolderMap.get(r.holder) ?? { tags: new Set<string | null>(), value: 0 };
    h.tags.add(r.patrimonyTag);
    h.value += r.value ?? 0;
    byHolderMap.set(r.holder, h);
    const b = byBaseMap.get(r.base) ?? new Set<string | null>();
    b.add(r.patrimonyTag);
    byBaseMap.set(r.base, b);
    value += r.value ?? 0;
  }
  const byHolder: HolderRow[] = [...byHolderMap.entries()]
    .map(([holder, h]) => ({ holder, quantity: h.tags.size, value: h.value }))
    .sort(byValueDesc);
  const byBase: KeyValue[] = [...byBaseMap.entries()]
    .map(([key, tags]) => ({ key, value: tags.size }))
    .sort(byValueDesc);
  // contagem distinta do patrimônio: o "em branco" conta uma vez, como o DISTINCTCOUNT
  const quantity = distinct(rows, (r) => r.patrimonyTag);

  return {
    options,
    kpis: { holders: byHolder.length, value, quantity },
    /** "QUANTIDADE por RESPONSÁVEL": patrimônios distintos e valor, maior valor primeiro */
    byHolder: { rows: byHolder, totals: { quantity, value } },
    /** gráfico por base: patrimônios distintos */
    byBase,
    detail: limitRows(sortChargedPatrimonies([...rows]).map((r) => toChargedPatrimonyRow(r, today)), DETAIL_ROW_LIMIT),
  };
}

// ------------------------------------------------------------------ produto

export const chargedProductSpec = (model: DataModel): FilterSpec<ChargedProduct> => ({
  lists: [
    { key: 'base', values: (r) => r.base },
    { key: 'description', values: (r) => r.description },
    { key: 'holder', values: (r) => r.holder },
    { key: 'active', includeBlank: false, values: (r) => activityOf(model, r.holder) },
    // cadastro do PRODUTO no Voalle (sp.active / sp.deleted)
    { key: 'itemActive', values: (r) => r.active },
    { key: 'itemDeleted', values: (r) => r.deleted },
  ],
});

export interface ChargedProductRow {
  holder: string;
  base: string;
  productCode: string | null;
  description: string | null;
  quantity: number;
  unitMeasure: string | null;
}

/**
 * "VISÃO GERAL" do produto: uma linha por pessoa, produto e unidade, com o
 * saldo somado (os lotes de preços diferentes viram uma linha só).
 */
export function groupChargedProducts(rows: readonly ChargedProduct[]): ChargedProductRow[] {
  const groups = new Map<string, ChargedProductRow>();
  for (const r of rows) {
    const key = JSON.stringify([r.holder, r.productCode, r.description, r.unitMeasure]);
    const current = groups.get(key);
    if (current) current.quantity += r.quantity;
    else {
      groups.set(key, {
        holder: r.holder, base: r.base, productCode: r.productCode, description: r.description, quantity: r.quantity, unitMeasure: r.unitMeasure,
      });
    }
  }
  return [...groups.values()].sort((a, b) => compareText(a.holder, b.holder) || compareText(a.description ?? '', b.description ?? ''));
}

export function buildChargedProductsReport(model: DataModel, selection: FilterSelection) {
  const { rows, options } = applyFilters(model.chargedProducts, chargedProductSpec(model), selection);

  const byHolderMap = new Map<string, { products: Set<string | null>; value: number }>();
  const byBaseMap = new Map<string, number>();
  let value = 0;
  for (const r of rows) {
    const h = byHolderMap.get(r.holder) ?? { products: new Set<string | null>(), value: 0 };
    h.products.add(r.description);
    h.value += r.totalValue;
    byHolderMap.set(r.holder, h);
    byBaseMap.set(r.base, (byBaseMap.get(r.base) ?? 0) + r.quantity);
    value += r.totalValue;
  }
  const byHolder: HolderRow[] = [...byHolderMap.entries()]
    .map(([holder, h]) => ({ holder, quantity: h.products.size, value: h.value }))
    .sort(byValueDesc);
  const byBase: KeyValue[] = [...byBaseMap.entries()].map(([key, v]) => ({ key, value: v })).sort(byValueDesc);

  return {
    options,
    kpis: { holders: byHolder.length, value },
    /** "QUANTIDADE por RESPONSÁVEL": produtos distintos (pela descrição) e valor, maior valor primeiro */
    byHolder: { rows: byHolder, totals: { quantity: distinct(rows, (r) => r.description), value } },
    /** gráfico por base: soma da quantidade */
    byBase,
    detail: limitRows(groupChargedProducts(rows), DETAIL_ROW_LIMIT),
  };
}
