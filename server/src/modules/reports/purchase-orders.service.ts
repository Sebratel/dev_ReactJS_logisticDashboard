import { BLANK_LABEL, compareText } from '../../common/helpers/aggregation.helper.js';
import type { ItemBalance, PurchaseOrderItem, PurchasingModel } from '../../model/model.types.js';
import { applyFilters, DETAIL_ROW_LIMIT, limitRows, type FilterSelection, type FilterSpec } from './report-filter.js';

/**
 * Tela de COMPRAS · LANÇAMENTO E SALDOS — réplica da página "RECEBIMENTO" do
 * Power BI "CMP - Lançamento e Saldos".
 *
 * O modelo do Power BI tinha duas tabelas ligadas por Código, com filtro nos
 * DOIS sentidos:
 *  - filtro do saldo (código, item, base) restringe os pedidos aos itens que
 *    sobraram no saldo;
 *  - filtro do pedido (fornecedor, status, nº, pessoa, sim/não) restringe o
 *    saldo aos itens que aparecem nos pedidos filtrados.
 * Sem filtro de um lado, o outro não é restringido (o Power BI não filtra por
 * uma tabela que não tem filtro nenhum).
 *
 * Nas três tabelas do Power BI as colunas eram SEM RESUMIR (o nome "Sum(...)"
 * que ficou gravado no visual é antigo): cada tabela agrupa pelas colunas que
 * mostra, e só a coluna "." é agregada, e é a única com valor na linha de
 * total. No saldo ela conta os códigos (contagem de não vazios); nas duas
 * tabelas de pedido é a CONTAGEM DISTINTA do Nº (código 2 do Power BI): 1 em
 * cada linha, e o total é o número de pedidos.
 */

export const ITEM_BALANCE_SPEC: FilterSpec<ItemBalance> = {
  lists: [
    { key: 'productCode', values: (r) => r.productCode },
    { key: 'item', values: (r) => r.item },
    { key: 'base', values: (r) => r.base },
  ],
};

export const PURCHASE_ORDER_SPEC: FilterSpec<PurchaseOrderItem> = {
  lists: [
    { key: 'supplier', values: (r) => r.supplier },
    { key: 'status', values: (r) => r.status },
    { key: 'orderNumber', values: (r) => String(r.orderId) },
    { key: 'requestedBy', values: (r) => r.requestedBy },
    { key: 'updatesStock', values: (r) => r.updatesStock },
    { key: 'generatesPatrimony', values: (r) => r.generatesPatrimony },
    { key: 'deleted', values: (r) => r.deleted },
  ],
};

/** Todos os campos da tela, para validar a query string de uma vez. */
export const PURCHASING_SPEC: FilterSpec<unknown> = {
  lists: [...ITEM_BALANCE_SPEC.lists, ...PURCHASE_ORDER_SPEC.lists] as FilterSpec<unknown>['lists'],
};

const hasSelection = (spec: FilterSpec<never>, selection: FilterSelection): boolean => (
  spec.lists.some((f) => (selection.lists[f.key]?.length ?? 0) > 0)
);

function codesOf(rows: readonly { productCode: string | null }[]): Set<string> {
  const out = new Set<string>();
  for (const r of rows) if (r.productCode !== null) out.add(r.productCode);
  return out;
}

/** O relacionamento por Código: linha sem código não casa com nada. */
const byCodes = (codes: Set<string>) => (row: { productCode: string | null }) => row.productCode !== null && codes.has(row.productCode);

export interface PurchasingSlice {
  balances: ItemBalance[];
  orders: PurchaseOrderItem[];
  options: Record<string, string[]>;
}

export function filterPurchasing(model: Pick<PurchasingModel, 'itemBalances' | 'purchaseOrders'>, selection: FilterSelection): PurchasingSlice {
  const balanceFiltered = hasSelection(ITEM_BALANCE_SPEC as FilterSpec<never>, selection);
  const orderFiltered = hasSelection(PURCHASE_ORDER_SPEC as FilterSpec<never>, selection);

  const codesFromBalances = balanceFiltered ? codesOf(applyFilters(model.itemBalances, ITEM_BALANCE_SPEC, selection).rows) : null;
  const codesFromOrders = orderFiltered ? codesOf(applyFilters(model.purchaseOrders, PURCHASE_ORDER_SPEC, selection).rows) : null;

  // as opções de cada slicer já saem com o filtro do outro lado aplicado (os slicers se filtram entre si)
  const balances = applyFilters(
    model.itemBalances,
    codesFromOrders ? { ...ITEM_BALANCE_SPEC, page: byCodes(codesFromOrders) } : ITEM_BALANCE_SPEC,
    selection,
  );
  const orders = applyFilters(
    model.purchaseOrders,
    codesFromBalances ? { ...PURCHASE_ORDER_SPEC, page: byCodes(codesFromBalances) } : PURCHASE_ORDER_SPEC,
    selection,
  );

  const options = { ...balances.options, ...orders.options };
  // Nº PEDIDO: o slicer do Power BI listava do mais novo para o mais antigo
  if (options.orderNumber) {
    options.orderNumber = [...options.orderNumber].sort((a, b) => {
      if (a === BLANK_LABEL || b === BLANK_LABEL) return a === BLANK_LABEL ? 1 : -1;
      return Number(b) - Number(a);
    });
  }
  return { balances: balances.rows, orders: orders.rows, options };
}

// ------------------------------------------------------------------ tabelas

/** "SALDO DE ITENS": código ascendente (a primeira coluna agrupada), e base. */
export function sortBalances(rows: ItemBalance[]): ItemBalance[] {
  return rows.sort((a, b) => compareText(a.productCode ?? '', b.productCode ?? '') || compareText(a.base ?? '', b.base ?? ''));
}

/** Os dois "PEDIDO DE COMPRA": Nº do pedido decrescente, e os itens na ordem do pedido. */
export function sortOrderItems(rows: PurchaseOrderItem[]): PurchaseOrderItem[] {
  return rows.sort((a, b) => b.orderId - a.orderId || (a.itemId ?? 0) - (b.itemId ?? 0));
}

/** As colunas da tabela "PEDIDO DE COMPRA" de itens — o agrupamento do Power BI. */
const itemGroupKey = (r: PurchaseOrderItem): string => JSON.stringify([
  r.date, r.orderId, r.expectedDate, r.supplier, r.status, r.base, r.productCode, r.description, r.unitMeasure,
  r.units, r.updatesStock, r.generatesPatrimony, r.unitAmount, r.orderTotal, r.totalAmount, r.requestedBy,
]);

/**
 * Um item por linha — e o mesmo item repetido igualzinho no mesmo pedido
 * (produto, quantidade e valores iguais) numa linha só, como o Power BI
 * mostrava (a tabela agrupa pelas colunas). Mantém a ordem de `sortOrderItems`.
 */
export function groupOrderItems(rows: readonly PurchaseOrderItem[]): PurchaseOrderItem[] {
  const groups = new Map<string, PurchaseOrderItem>();
  for (const r of sortOrderItems([...rows])) {
    const key = itemGroupKey(r);
    if (!groups.has(key)) groups.set(key, r);
  }
  return [...groups.values()];
}

/** Coluna "." das tabelas de pedido: contagem DISTINTA do Nº — o número de pedidos. */
export const distinctOrders = (rows: readonly PurchaseOrderItem[]): number => new Set(rows.map((r) => r.orderId)).size;

export interface PurchaseOrderSummary {
  orderNumber: number;
  date: string | null;
  expectedDate: string | null;
  supplier: string | null;
  status: string | null;
  base: string | null;
}

/** Um pedido por linha (data, nº, previsão, fornecedor, status e base são do pedido). */
export function summarizeOrders(rows: readonly PurchaseOrderItem[]): PurchaseOrderSummary[] {
  const byOrder = new Map<number, PurchaseOrderSummary>();
  for (const r of rows) {
    if (byOrder.has(r.orderId)) continue;
    byOrder.set(r.orderId, {
      orderNumber: r.orderId,
      date: r.date,
      expectedDate: r.expectedDate,
      supplier: r.supplier,
      status: r.status,
      base: r.base,
    });
  }
  return [...byOrder.values()].sort((a, b) => b.orderNumber - a.orderNumber);
}

export interface ItemBalanceRow {
  productCode: string | null;
  item: string;
  base: string | null;
  units: number;
  unitMeasure: string | null;
  updatesStock: string | null;
  generatesPatrimony: string | null;
}

export interface PurchaseOrderItemRow {
  key: string;
  orderNumber: number;
  date: string | null;
  expectedDate: string | null;
  supplier: string | null;
  status: string | null;
  base: string | null;
  productCode: string | null;
  description: string | null;
  unitMeasure: string | null;
  units: number | null;
  updatesStock: string | null;
  generatesPatrimony: string | null;
  unitAmount: number | null;
  orderTotal: number | null;
  totalAmount: number | null;
  requestedBy: string | null;
}

const toBalanceRow = (r: ItemBalance): ItemBalanceRow => ({
  productCode: r.productCode,
  item: r.item,
  base: r.base,
  units: r.units,
  unitMeasure: r.unitMeasure,
  updatesStock: r.updatesStock,
  generatesPatrimony: r.generatesPatrimony,
});

const toItemRow = (r: PurchaseOrderItem): PurchaseOrderItemRow => ({
  key: `${r.orderId}|${r.itemId ?? '-'}`,
  orderNumber: r.orderId,
  date: r.date,
  expectedDate: r.expectedDate,
  supplier: r.supplier,
  status: r.status,
  base: r.base,
  productCode: r.productCode,
  description: r.description,
  unitMeasure: r.unitMeasure,
  units: r.units,
  updatesStock: r.updatesStock,
  generatesPatrimony: r.generatesPatrimony,
  unitAmount: r.unitAmount,
  orderTotal: r.orderTotal,
  totalAmount: r.totalAmount,
  requestedBy: r.requestedBy,
});

export function buildPurchaseOrdersReport(model: PurchasingModel, selection: FilterSelection, readAt: string | null) {
  const { balances, orders, options } = filterPurchasing(model, selection);
  const summary = summarizeOrders(orders);
  const items = groupOrderItems(orders);
  // a linha de total do Power BI só tinha a coluna "."; nas tabelas de pedido ela é a contagem distinta do Nº
  const orderCount = { orders: distinctOrders(orders) };

  return {
    options,
    /** a leitura mais antiga das duas fontes — o "Atualizado:" do Power BI */
    readAt,
    balances: {
      ...limitRows(sortBalances([...balances]).map(toBalanceRow), DETAIL_ROW_LIMIT),
      totals: { items: balances.filter((r) => r.productCode !== null).length },
    },
    orders: { ...limitRows(summary, DETAIL_ROW_LIMIT), totals: orderCount },
    items: { ...limitRows(items.map(toItemRow), DETAIL_ROW_LIMIT), totals: orderCount },
  };
}
