import { compareText, countBy, sum } from '../../common/helpers/aggregation.helper.js';
import type { DataModel, PatrimonyStatus, PendingPatrimony } from '../../model/model.types.js';
import { applyFilters, DETAIL_ROW_LIMIT, limitRows, type FilterSelection, type FilterSpec } from './report-filter.js';

/**
 * Parte de baixo da tela de alerta de patrimônios: o status real de cada
 * patrimônio (pizza, tabelas por status, base, tipo, equipe e responsável),
 * os objetos pendentes de patrimoniar e o histórico de romaneios.
 *
 * Os seletores desta parte são os do relatório (patrimônio, serial, item,
 * código, responsável, equipe) e valem só para ela. No Power BI ela ainda era
 * cruzada com o saldo de cima por uma relação código x id de produto, que casa
 * por coincidência em ~90% dos produtos — essa ligação não foi reproduzida.
 */
export const PATRIMONY_STATUS_SPEC: FilterSpec<PatrimonyStatus> = {
  lists: [
    { key: 'statusProduct', values: (r) => r.product },
    { key: 'statusProductCode', values: (r) => r.productCode },
    { key: 'statusResponsible', values: (r) => r.responsible },
    { key: 'statusTeam', values: (r) => r.operationalBase },
    { key: 'generalStatus', values: (r) => r.generalStatus },
    { key: 'currentStatus', values: (r) => r.currentStatus },
    // cadastro do patrimônio no Voalle (p.active / p.deleted)
    { key: 'statusActive', values: (r) => r.active },
    { key: 'statusDeleted', values: (r) => r.deleted },
  ],
  searches: [
    { key: 'patrimonyTag', value: (r) => r.patrimonyTag },
    { key: 'serialNumber', value: (r) => r.serialNumber },
  ],
};

export function buildPatrimonyStatusPanel(model: DataModel, selection: FilterSelection) {
  const { rows, options } = applyFilters(model.patrimonyStatuses, PATRIMONY_STATUS_SPEC, selection);

  // o modelo já guarda o status na ordem da tabela (STATUS GERAL, status, patrimônio)
  const detail = rows;

  // "EM RESPONSABILIDADE DE:" por responsável carrega a equipe ao lado
  const byResponsible = new Map<string, { responsible: string; team: string | null; total: number }>();
  for (const row of rows) {
    const key = `${row.responsible ?? ''}|${row.operationalBase ?? ''}`;
    const item = byResponsible.get(key) ?? { responsible: row.responsible ?? '(Em branco)', team: row.operationalBase, total: 0 };
    item.total += 1;
    byResponsible.set(key, item);
  }

  return {
    options,
    total: rows.length,
    byGeneralStatus: countBy(rows, (r) => r.generalStatus),
    byCurrentStatus: countBy(rows, (r) => r.currentStatus),
    byBase: countBy(rows, (r) => r.baseName),
    byProduct: countBy(rows, (r) => r.product),
    byTeam: countBy(rows, (r) => r.operationalBase),
    byResponsible: [...byResponsible.values()].sort((a, b) => b.total - a.total || compareText(a.responsible, b.responsible)),
    detail: limitRows(detail.map((r) => ({
      generalStatus: r.generalStatus,
      currentStatus: r.currentStatus,
      patrimonyTag: r.patrimonyTag,
      serialNumber: r.serialNumber,
      base: r.baseName,
      responsible: r.responsible,
      team: r.operationalBase,
    })), DETAIL_ROW_LIMIT),
  };
}

export interface PendingRow {
  invoiceNumber: string | null;
  entryDate: string | null;
  productCode: string | null;
  description: string | null;
  base: string | null;
  totalUnits: number;
  pendingUnits: number;
}

/** "OBJETOS PENDENTES - VISÃO DETALHADA": agrupada como a tabela do Power BI. */
export function buildPendingTable(rows: PendingPatrimony[]): PendingRow[] {
  const groups = new Map<string, PendingRow>();
  for (const r of rows) {
    const key = [r.invoiceNumber, r.entryDate, r.productCode, r.description, r.baseName].join('|');
    const group = groups.get(key) ?? {
      invoiceNumber: r.invoiceNumber, entryDate: r.entryDate, productCode: r.productCode,
      description: r.description, base: r.baseName, totalUnits: 0, pendingUnits: 0,
    };
    group.totalUnits += r.totalUnits;
    group.pendingUnits += r.pendingUnits;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (b.entryDate ?? '').localeCompare(a.entryDate ?? ''));
}

export function buildPackingHistory(model: DataModel) {
  return limitRows(model.patrimonyPackingNotes, DETAIL_ROW_LIMIT);
}

export const pendingTotal = (rows: PendingPatrimony[]) => sum(rows, (r) => r.pendingUnits);
