import { compareText } from '../../common/helpers/aggregation.helper.js';
import { USED_EQUIPMENT_MATRIX_MODELS } from '../../model/business-rules.js';
import type { DataModel, FieldEquipmentDispatch } from '../../model/model.types.js';
import { applyFilters, DETAIL_ROW_LIMIT, limitRows, type FilterSelection, type FilterSpec } from './report-filter.js';
import {
  buildMatrix, byKeyNumber, byLabelDesc, byTotalDesc, type MatrixLevel,
} from './matrix.js';

export { buildMatrix } from './matrix.js';

/**
 * Tela EQUIPAMENTOS PARA CAMPO — réplica da página "Movimentação Equipamentos"
 * do Power BI "CTR - Movimentação Equipamentos para Campo".
 *
 * Duas tabelas: NOVOS (o primeiro envio em romaneio de cada patrimônio) e
 * USADOS (saída do almoxarifado depois de passar pelo laboratório). O slicer
 * de data (ano/mês/dia) e o de equipamento valem para as duas.
 *
 * As matrizes do Power BI agrupavam as colunas de data pela hierarquia do
 * calendário SEM o ano (o mês de 2025 e o de 2026 somavam juntos quando os
 * dois anos estavam marcados) — reproduzido aqui: as colunas são o mês do ano
 * e o dia do mês.
 */

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

const monthNumber = (date: string): number => Number(date.slice(5, 7));
const monthName = (date: string): string => MONTH_NAMES[monthNumber(date) - 1] ?? date.slice(5, 7);
const monthIndex = (name: string): number => MONTH_NAMES.indexOf(name as (typeof MONTH_NAMES)[number]);

/** O slicer "DATA DE ENVIO" (ano > mês > dia) vira ano, mês e período; "EQUIPAMENTOS", equipamento. */
export const FIELD_EQUIPMENT_SPEC: FilterSpec<FieldEquipmentDispatch> = {
  date: (r) => r.date,
  lists: [
    { key: 'year', values: (r) => r.date.slice(0, 4) },
    { key: 'month', values: (r) => monthName(r.date) },
    { key: 'equipment', values: (r) => r.equipment },
  ],
};

// ------------------------------------------------------------------ tela

type Tagged = FieldEquipmentDispatch & { kind: 'novos' | 'usados' };

const KIND_LABEL: Record<string, string> = { novos: 'QTD. NOVOS', usados: 'QTD. USADOS' };
const kindSort = (a: string, b: string) => (a === b ? 0 : a === 'novos' ? -1 : 1);
const numberSort = (a: string, b: string) => Number(a) - Number(b);
const yearLevel: MatrixLevel<FieldEquipmentDispatch> = { key: (r) => r.date.slice(0, 4), sort: byKeyNumber };
const monthLevel: MatrixLevel<FieldEquipmentDispatch> = {
  key: (r) => String(monthNumber(r.date)),
  label: (k) => MONTH_NAMES[Number(k) - 1] ?? k,
  sort: byKeyNumber,
};
const dayLevel: MatrixLevel<FieldEquipmentDispatch> = { key: (r) => String(Number(r.date.slice(8, 10))), sort: byKeyNumber };
const equipmentLevel = (sort?: MatrixLevel<FieldEquipmentDispatch>['sort']): MatrixLevel<FieldEquipmentDispatch> => ({
  key: (r) => r.equipment ?? '(Em branco)', sort,
});
const occurrenceLevel: MatrixLevel<FieldEquipmentDispatch> = { key: (r) => r.description ?? '(Em branco)' };

export interface FieldEquipmentDetailRow {
  /** coluna "Qtd." do Power BI: patrimônios na mesma data, modelo e ocorrência */
  count: number;
  date: string;
  equipment: string | null;
  description: string | null;
}

/** As duas tabelas detalhadas agrupam por data, modelo e ocorrência (colunas sem resumir do Power BI). */
export function groupDetail(rows: readonly FieldEquipmentDispatch[]): FieldEquipmentDetailRow[] {
  const groups = new Map<string, FieldEquipmentDetailRow>();
  for (const r of rows) {
    const key = `${r.date}|${r.equipment ?? ''}|${r.description ?? ''}`;
    const current = groups.get(key);
    if (current) current.count += 1;
    else groups.set(key, { count: 1, date: r.date, equipment: r.equipment, description: r.description });
  }
  return [...groups.values()];
}

/** Novos: por modelo (A-Z), como o Power BI; depois data e ocorrência. */
export const sortNewDetail = (rows: FieldEquipmentDetailRow[]) => rows.sort((a, b) => compareText(a.equipment ?? '', b.equipment ?? '')
  || compareText(a.date, b.date) || compareText(a.description ?? '', b.description ?? ''));
/** Usados: por data (mais antiga primeiro), como o Power BI; depois modelo e ocorrência. */
export const sortUsedDetail = (rows: FieldEquipmentDetailRow[]) => rows.sort((a, b) => compareText(a.date, b.date)
  || compareText(a.equipment ?? '', b.equipment ?? '') || compareText(a.description ?? '', b.description ?? ''));

export interface FieldEquipmentSlice {
  news: FieldEquipmentDispatch[];
  used: FieldEquipmentDispatch[];
  options: Record<string, string[]>;
}

export function filterFieldEquipment(model: Pick<DataModel, 'newFieldEquipment' | 'usedFieldEquipment'>, selection: FilterSelection): FieldEquipmentSlice {
  const news = applyFilters(model.newFieldEquipment, FIELD_EQUIPMENT_SPEC, selection);
  const used = applyFilters(model.usedFieldEquipment, FIELD_EQUIPMENT_SPEC, selection);
  const options: Record<string, string[]> = {};
  for (const key of ['year', 'month', 'equipment']) {
    options[key] = [...new Set([...(news.options[key] ?? []), ...(used.options[key] ?? [])])].sort(compareText);
  }
  options.month = (options.month ?? []).sort((a, b) => monthIndex(a) - monthIndex(b));
  return { news: news.rows, used: used.rows, options };
}

const sumCounts = (rows: FieldEquipmentDetailRow[]) => rows.reduce((s, r) => s + r.count, 0);

export function buildFieldEquipmentReport(model: DataModel, selection: FilterSelection) {
  const { news, used, options } = filterFieldEquipment(model, selection);
  const tagged: Tagged[] = [
    ...news.map((r) => ({ ...r, kind: 'novos' as const })),
    ...used.map((r) => ({ ...r, kind: 'usados' as const })),
  ];
  const kindColumn = (r: Tagged) => r.kind;
  const kindLabel = (k: string) => KIND_LABEL[k] ?? k;
  // os dois visuais de usados por mês/dia mostram 7 dos 9 modelos (filtro do visual no Power BI)
  const matrixModels = new Set(USED_EQUIPMENT_MATRIX_MODELS);
  const usedInMatrix = used.filter((r) => r.equipment !== null && matrixModels.has(r.equipment));
  const day = (r: FieldEquipmentDispatch) => String(Number(r.date.slice(8, 10)));
  const month = (r: FieldEquipmentDispatch) => String(monthNumber(r.date));
  const monthColumnLabel = (k: string) => MONTH_NAMES[Number(k) - 1] ?? k;

  const newDetail = sortNewDetail(groupDetail(news));
  const usedDetail = sortUsedDetail(groupDetail(used));

  return {
    options,
    /** "QTD. EQUIPAMENTOS ENVIADOS A CAMPO": ano > mês > dia, novos, usados e o total */
    byDate: buildMatrix<Tagged>(tagged, [yearLevel, monthLevel, dayLevel], kindColumn, kindLabel, kindSort),
    /** "QTD. NOVOS x USADOS" */
    pie: [{ key: 'Novos', value: news.length }, { key: 'Usados', value: used.length }],
    /** "QTD. EQUIPAMENTOS ENVIADOS A CAMPO - POR TIPO": ano > modelo */
    byType: buildMatrix<Tagged>(tagged, [yearLevel, equipmentLevel()], kindColumn, kindLabel, kindSort),
    /** "Equipamentos Novos enviados a campo": modelo x mês (mais enviados primeiro) */
    newByMonth: buildMatrix(news, [equipmentLevel(byTotalDesc)], month, monthColumnLabel, numberSort),
    /** "Equipamentos Usados enviados a campo": modelo (Z-A, como o Power BI) > ocorrência x mês */
    usedByMonth: buildMatrix(usedInMatrix, [equipmentLevel(byLabelDesc), occurrenceLevel], month, monthColumnLabel, numberSort),
    /** "Relatório Movimentações Equipamentos Novos - Dia a Dia": mês > modelo x dia */
    newDaily: buildMatrix(news, [monthLevel, equipmentLevel()], day, (k) => k, numberSort),
    /** "Relatório Movimentações Equipamentos Usados - Dia a Dia": mês > modelo > ocorrência x dia */
    usedDaily: buildMatrix(usedInMatrix, [monthLevel, equipmentLevel(), occurrenceLevel], day, (k) => k, numberSort),
    newDetail: { ...limitRows(newDetail, DETAIL_ROW_LIMIT), totals: { count: sumCounts(newDetail) } },
    usedDetail: { ...limitRows(usedDetail, DETAIL_ROW_LIMIT), totals: { count: sumCounts(usedDetail) } },
  };
}
