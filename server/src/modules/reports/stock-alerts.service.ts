import { compareText } from '../../common/helpers/aggregation.helper.js';
import { ITEM_TYPE, STOCK_STATUS, type ItemType } from '../../model/business-rules.js';
import type { DataModel, StockBalance } from '../../model/model.types.js';
import { applyFilters, limitRows, type FilterSelection, type FilterSpec } from './report-filter.js';

/** Sem o cadastro a tela de produtos lista o saldo inteiro (~16 mil linhas): o CSV leva tudo. */
const ALERT_ROW_LIMIT = 2000;

/**
 * Parte de cima das duas telas de ALERTA DE ESTOQUE (produtos e patrimônios):
 * a tabela do "Saldo Voalle" com mínimo/alerta do cadastro e os pedidos de
 * compra em aberto, mais os cartões de itens em alerta e no mínimo.
 */
export function stockAlertSpec(itemType: ItemType, requireControl: boolean): FilterSpec<StockBalance> {
  return {
    // Produtos: filtro de página BASES[BASE DE ORIGEM] não vazio = só o que está
    // no cadastro de controle de estoque. Patrimônios: a página não tinha esse filtro.
    page: (row) => row.itemType === itemType && (!requireControl || row.isControlled),
    lists: [
      { key: 'productCode', values: (r) => r.productCode },
      { key: 'category', values: (r) => r.category },
      { key: 'base', values: (r) => r.baseName },
      { key: 'description', values: (r) => r.description },
      { key: 'status', values: (r) => r.status },
      // Ativo?/Deletado? do cadastro do PRODUTO (a view de saldo já não traz
      // produto deletado). Só em produtos: em patrimônios os filtros são do
      // cadastro de cada patrimônio e ficam no status real (patrimony-status).
      ...(itemType === ITEM_TYPE.PRODUCT ? [
        { key: 'active', values: (r: StockBalance) => r.active },
        { key: 'deleted', values: (r: StockBalance) => r.deleted },
      ] : []),
    ],
  };
}

export interface StockAlertRow {
  productCode: string;
  description: string;
  category: string | null;
  base: string | null;
  units: number;
  alertLevel: number | null;
  minimumLevel: number | null;
  transferQty: number;
  purchaseStatus: string | null;
  expectedDate: string | null;
  purchaseUnits: number | null;
  leadTimeDays: number | null;
  buyer: string | null;
  externalProcess: string | null;
  status: string;
}

const toAlertRow = (r: StockBalance): StockAlertRow => ({
  productCode: r.productCode,
  description: r.description,
  category: r.category,
  base: r.baseAcronym ?? r.baseName,
  units: r.units,
  alertLevel: r.alertLevel,
  minimumLevel: r.minimumLevel,
  transferQty: r.transferQty,
  purchaseStatus: r.purchaseStatus,
  expectedDate: r.expectedDate,
  purchaseUnits: r.purchaseUnits,
  leadTimeDays: r.leadTimeDays,
  buyer: r.buyer,
  externalProcess: r.externalProcess,
  status: r.status,
});

/** Ordem da tabela: produtos por descrição (A-Z); patrimônios por saldo (maior primeiro). */
export function sortAlertRows(rows: StockBalance[], itemType: ItemType): StockBalance[] {
  return itemType === ITEM_TYPE.PRODUCT
    ? rows.sort((a, b) => compareText(a.description, b.description) || compareText(a.baseAcronym ?? '', b.baseAcronym ?? ''))
    : rows.sort((a, b) => b.units - a.units || compareText(a.description, b.description));
}

/** Saldo sem a repetição do merge com pedidos: uma vez por produto+base. */
function distinctUnits(rows: StockBalance[]): number {
  const seen = new Set<string>();
  let total = 0;
  for (const row of rows) {
    const key = `${row.productCode}|${row.baseName ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    total += row.units;
  }
  return total;
}

export function buildStockAlerts(model: DataModel, itemType: ItemType, selection: FilterSelection) {
  // sem cadastro não existe "controlado": em vez de esvaziar a tela de
  // produtos, mostra tudo e a tela avisa que mínimo e alerta estão faltando
  const requireControl = itemType === ITEM_TYPE.PRODUCT && model.hasStockControl;
  const { rows, options } = applyFilters(model.stockBalances, stockAlertSpec(itemType, requireControl), selection);
  const sorted = sortAlertRows([...rows], itemType);

  return {
    options,
    stockControlAvailable: model.hasStockControl,
    kpis: {
      alertItems: rows.filter((r) => r.status === STOCK_STATUS.ALERT).length,
      minimumItems: rows.filter((r) => r.status === STOCK_STATUS.MINIMUM).length,
      availableUnits: distinctUnits(rows),
    },
    table: limitRows(sorted.map(toAlertRow), ALERT_ROW_LIMIT),
  };
}
