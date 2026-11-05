import { z } from 'zod';
import { BLANK_LABEL, compareText } from '../../common/helpers/aggregation.helper.js';
import { isWithin } from '../../common/helpers/date.helper.js';
import { normalizeKey } from '../../common/helpers/text.helper.js';

/**
 * Motor de filtros das telas — o papel dos slicers do Power BI.
 *
 * Duas regras do Power BI que precisam valer aqui também:
 *
 *  1. Os slicers se filtram entre si: a lista de opções de um campo mostra só o
 *     que existe dado o que está marcado nos OUTROS campos.
 *  2. Um slicer não filtra a si mesmo: marcar "CANOAS" não pode fazer as outras
 *     bases sumirem da lista de bases, senão não há como trocar de base.
 *
 * As duas saem de UMA passada pelas linhas: uma linha que falha só no campo X
 * ainda conta para as opções de X, e só para elas.
 */

/** Campo com lista de opções (slicer de lista). */
export interface ListField<T> {
  key: string;
  /** valor(es) da linha neste campo; null é o "(Em branco)" do Power BI */
  values: (row: T) => string | null | readonly string[];
  /** false para campo sem lista na tela (alta cardinalidade): só aceita seleção */
  withOptions?: boolean;
  /**
   * false quando "sem valor" não é opção do slicer. No "colaborador ativo?" o
   * Power BI listava só os valores da tabela Usuários: nome que não casa com
   * nenhum usuário não vira "(Em branco)", só deixa de aparecer ao filtrar.
   */
  includeBlank?: boolean;
}

/** Campo de busca por texto (slicer de lista grande demais para listar). */
export interface SearchField<T> {
  key: string;
  value: (row: T) => string | null;
}

export interface FilterSpec<T> {
  lists: ListField<T>[];
  searches?: SearchField<T>[];
  /** data usada pelo filtro de período */
  date?: (row: T) => string | null;
  /**
   * Outros recortes de data, além do período principal (`date`): cada um vem
   * na query como `<key>From` / `<key>To` (AAAA-MM-DD).
   */
  ranges?: { key: string; value: (row: T) => string | null }[];
  /** filtro de página (sempre aplicado) */
  page?: (row: T) => boolean;
}

export interface FilterSelection {
  lists: Record<string, string[]>;
  searches: Record<string, string>;
  startDate?: string;
  endDate?: string;
  /** recortes de `FilterSpec.ranges` que vieram preenchidos */
  ranges?: Record<string, { from?: string; to?: string }>;
}

export interface FilterResult<T> {
  rows: T[];
  options: Record<string, string[]>;
}

const MAX_VALUES_PER_FIELD = 300;
const MAX_VALUE_LENGTH = 300;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato AAAA-MM-DD');

/**
 * Valida a query string contra os campos da tela. Campo de lista vem repetido
 * (`?base=A&base=B`) — não separado por vírgula, porque há valores do Voalle com
 * vírgula dentro (ex.: a região "São Leopoldo (Manutenção),").
 */
export function parseSelection(query: Record<string, unknown>, spec: FilterSpec<unknown>): FilterSelection {
  const listValue = z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]))
    .pipe(z.array(z.string().max(MAX_VALUE_LENGTH)).max(MAX_VALUES_PER_FIELD));
  const searchValue = z.string().max(100).optional();

  // um objeto só, para o erro de validação dizer QUAL campo veio errado
  const schema = z.object({
    ...Object.fromEntries(spec.lists.map((f) => [f.key, listValue])),
    ...Object.fromEntries((spec.searches ?? []).map((f) => [f.key, searchValue])),
    ...Object.fromEntries((spec.ranges ?? []).flatMap((r) => [[`${r.key}From`, isoDate.optional()], [`${r.key}To`, isoDate.optional()]])),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
  });
  const rangeKeys = (spec.ranges ?? []).flatMap((r) => [`${r.key}From`, `${r.key}To`]);
  const parsed = schema.parse({
    ...query,
    ...Object.fromEntries(rangeKeys.map((k) => [k, query[k] || undefined])),
    startDate: query.startDate || undefined,
    endDate: query.endDate || undefined,
  }) as Record<string, string[] | string | undefined>;

  const lists: Record<string, string[]> = {};
  for (const field of spec.lists) {
    const values = ((parsed[field.key] as string[] | undefined) ?? []).filter((v) => v !== '');
    if (values.length) lists[field.key] = [...new Set(values)];
  }
  const searches: Record<string, string> = {};
  for (const field of spec.searches ?? []) {
    const value = (parsed[field.key] as string | undefined)?.trim();
    if (value) searches[field.key] = value;
  }
  const ranges: Record<string, { from?: string; to?: string }> = {};
  for (const range of spec.ranges ?? []) {
    const from = parsed[`${range.key}From`] as string | undefined;
    const to = parsed[`${range.key}To`] as string | undefined;
    if (from || to) ranges[range.key] = { from, to };
  }
  return {
    lists,
    searches,
    startDate: parsed.startDate as string | undefined,
    endDate: parsed.endDate as string | undefined,
    ...(Object.keys(ranges).length ? { ranges } : {}),
  };
}

const BLANK: readonly string[] = [BLANK_LABEL];
const NONE: readonly string[] = [];

function valuesOf<T>(field: ListField<T>, row: T): readonly string[] {
  const raw = field.values(row);
  if (typeof raw === 'string') return [raw];
  if (raw !== null && raw.length) return raw;
  return field.includeBlank === false ? NONE : BLANK;
}

export function applyFilters<T>(rows: readonly T[], spec: FilterSpec<T>, selection: FilterSelection): FilterResult<T> {
  const active = spec.lists
    .filter((f) => selection.lists[f.key]?.length)
    .map((f) => ({ field: f, selected: new Set(selection.lists[f.key]) }));
  const searches = (spec.searches ?? [])
    .filter((f) => selection.searches[f.key])
    .map((f) => ({ field: f, term: normalizeKey(selection.searches[f.key]) }));
  const withOptions = spec.lists.filter((f) => f.withOptions !== false);
  const optionSets = new Map<string, Set<string>>(withOptions.map((f) => [f.key, new Set<string>()]));
  const { startDate, endDate } = selection;
  const hasPeriod = Boolean(spec.date && (startDate || endDate));
  const ranges = (spec.ranges ?? [])
    .filter((r) => selection.ranges?.[r.key])
    .map((r) => ({ value: r.value, from: selection.ranges?.[r.key]?.from, to: selection.ranges?.[r.key]?.to }));

  const out: T[] = [];
  for (const row of rows) {
    if (spec.page && !spec.page(row)) continue;
    if (hasPeriod && spec.date && !isWithin(spec.date(row), startDate, endDate)) continue;
    if (ranges.length && ranges.some((r) => !isWithin(r.value(row), r.from, r.to))) continue;
    let searchOk = true;
    for (const s of searches) {
      if (!normalizeKey(s.field.value(row)).includes(s.term)) {
        searchOk = false;
        break;
      }
    }
    if (!searchOk) continue;

    let failures = 0;
    let failedKey = '';
    for (const { field, selected } of active) {
      if (!valuesOf(field, row).some((v) => selected.has(v))) {
        failures += 1;
        failedKey = field.key;
        if (failures > 1) break;
      }
    }

    if (failures === 0) {
      out.push(row);
      for (const field of withOptions) {
        const set = optionSets.get(field.key);
        for (const v of valuesOf(field, row)) set?.add(v);
      }
    } else if (failures === 1) {
      const set = optionSets.get(failedKey);
      if (set) {
        const field = spec.lists.find((f) => f.key === failedKey);
        if (field) for (const v of valuesOf(field, row)) set.add(v);
      }
    }
  }

  const options: Record<string, string[]> = {};
  for (const [key, set] of optionSets) {
    // o que está marcado continua na lista mesmo que tenha sumido do recorte:
    // senão a pessoa não teria como desmarcar
    for (const v of selection.lists[key] ?? []) set.add(v);
    options[key] = [...set].sort(compareText);
  }
  return { rows: out, options };
}

/** Recorta a amostra que vai para a tela; a exportação CSV leva tudo. */
export function limitRows<T>(rows: T[], limit: number): { rows: T[]; total: number; truncated: boolean } {
  return { rows: rows.slice(0, limit), total: rows.length, truncated: rows.length > limit };
}

export const DETAIL_ROW_LIMIT = 1000;
