import { NO, ORDER_DELETED, PURCHASE_ORDER_STATUS, YES } from '../business-rules.js';
import type { ItemBalance, PurchaseOrderItem, YesNo } from '../model.types.js';
import type { ItemBalanceSourceRow, PurchaseOrderItemSourceRow } from '../../sources/source.types.js';

/**
 * Tabelas da tela de Compras ("CMP - Lançamento e Saldos"), com as trocas que
 * o Power Query fazia: status numérico -> nome, booleanos -> Sim/Não, e o
 * "deletado" do pedido -> Deletado/Não.
 */

const text = (v: string | null | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Campo booleano ausente (linha sem produto) fica em branco, como o Power BI mostrava. */
export const yesNo = (v: boolean | null | undefined): YesNo => (v === null || v === undefined ? null : v ? YES : NO);

export function purchaseOrderStatus(code: number | null | undefined): string | null {
  if (code === null || code === undefined) return null;
  return PURCHASE_ORDER_STATUS[code] ?? String(code);
}

export function buildItemBalances(rows: readonly ItemBalanceSourceRow[]): ItemBalance[] {
  return rows.map((r) => ({
    productCode: text(r.product_code),
    item: r.product_title,
    base: text(r.base_name),
    units: num(r.available_units) ?? 0,
    unitMeasure: text(r.unit_measure),
    updatesStock: yesNo(r.updates_stock),
    generatesPatrimony: yesNo(r.generates_patrimony),
  }));
}

export function buildPurchaseOrders(rows: readonly PurchaseOrderItemSourceRow[]): PurchaseOrderItem[] {
  return rows.map((r) => ({
    orderId: r.order_id,
    itemId: r.item_id ?? null,
    date: r.order_date ? r.order_date.slice(0, 10) : null,
    expectedDate: r.expected_date ? r.expected_date.slice(0, 10) : null,
    supplier: text(r.supplier),
    requestedBy: text(r.requested_by),
    status: purchaseOrderStatus(r.status_code),
    deleted: r.deleted === null || r.deleted === undefined ? null : r.deleted ? ORDER_DELETED : NO,
    orderTotal: num(r.order_total),
    base: text(r.base_name),
    productCode: text(r.product_code),
    description: text(r.product_title),
    unitMeasure: text(r.unit_measure),
    units: num(r.units),
    unitAmount: num(r.unit_amount),
    itemAmount: num(r.item_amount),
    totalAmount: num(r.total_amount),
    updatesStock: yesNo(r.updates_stock),
    generatesPatrimony: yesNo(r.generates_patrimony),
  }));
}
