import { cleanText, toNumber, toProductNumber } from '../../common/helpers/text.helper.js';
import {
  BASE_ACRONYMS, ITEM_TYPE, PURCHASE_STATUS_AWAITING, STOCK_STATUS, type StockStatus,
} from '../business-rules.js';
import type { StockBalance } from '../model.types.js';
import type { PurchaseRequestSourceRow, StockBalanceSourceRow } from '../../sources/source.types.js';
import { yesNo } from './purchasing.builder.js';
import { stockControlKey, type StockControlIndex } from './stock-control.builder.js';

/**
 * Coluna DAX STATUS2. O mínimo e o alerta vêm do CADASTRO; sem cadastro o
 * LOOKUPVALUE devolve BLANK, que o DAX compara como zero — então um item sem
 * cadastro só fica "MÍNIMO" quando o saldo é zero ou negativo.
 */
export function stockStatus(units: number, minimumLevel: number | null, alertLevel: number | null): StockStatus {
  if (units <= (minimumLevel ?? 0)) return STOCK_STATUS.MINIMUM;
  if (units <= (alertLevel ?? 0)) return STOCK_STATUS.ALERT;
  return STOCK_STATUS.ABOVE;
}

/** Colunas DAX "% EXCESSO" e "% DEFICIT" — sobre o estoque mínimo do CADASTRO do Voalle. */
export function stockExcess(units: number, voalleMinimum: number): number {
  return units > voalleMinimum * 1.25 ? units * 0.25 : 0;
}
export function stockDeficit(units: number, voalleMinimum: number): number {
  return units < voalleMinimum ? voalleMinimum - units : 0;
}

/**
 * "Saldo Voalle" com os dois merges do Power Query (cadastro por código+base e
 * pedidos de compra por código+base) e as colunas calculadas do modelo.
 *
 * O merge com pedidos é LEFT JOIN de verdade: um produto com dois pedidos em
 * aberto na mesma base vira duas linhas, como na tabela do Power BI.
 */
export function buildStockBalances(
  balances: StockBalanceSourceRow[],
  control: StockControlIndex | null,
  purchases: PurchaseRequestSourceRow[],
): StockBalance[] {
  const purchasesByKey = new Map<string, PurchaseRequestSourceRow[]>();
  for (const purchase of purchases) {
    const key = stockControlKey(toProductNumber(purchase.product_code), purchase.base_name);
    const list = purchasesByKey.get(key) ?? [];
    list.push(purchase);
    purchasesByKey.set(key, list);
  }

  const rows: StockBalance[] = [];
  for (const balance of balances) {
    const productNumber = toProductNumber(balance.product_code);
    const baseName = cleanText(balance.base_name);
    const key = stockControlKey(productNumber, baseName);
    const entry = control?.byProductBase.get(key) ?? null;
    const units = toNumber(balance.available_units);
    const voalleMinimum = toNumber(balance.minimum_inventory);

    const base: Omit<StockBalance, 'requestedBy' | 'expectedDate' | 'purchaseUnits' | 'purchaseStatus'> = {
      productCode: cleanText(balance.product_code) ?? '',
      productNumber,
      description: balance.product_title,
      itemType: balance.item_type === ITEM_TYPE.PATRIMONY ? ITEM_TYPE.PATRIMONY : ITEM_TYPE.PRODUCT,
      baseName,
      baseAcronym: baseName ? BASE_ACRONYMS[baseName] ?? null : null,
      isControlled: entry !== null,
      active: yesNo(balance.is_active),
      deleted: yesNo(balance.is_deleted),
      category: entry?.category ?? null,
      units,
      voalleMinimum,
      alertLevel: entry?.alertLevel ?? null,
      minimumLevel: entry?.minimumLevel ?? null,
      status: stockStatus(units, entry?.minimumLevel ?? null, entry?.alertLevel ?? null),
      excess: stockExcess(units, voalleMinimum),
      deficit: stockDeficit(units, voalleMinimum),
      transferQty: 0,
      leadTimeDays: entry?.leadTimeDays ?? null,
      buyer: entry?.buyer ?? null,
      externalProcess: entry?.externalProcess ?? null,
    };

    const requests = purchasesByKey.get(key);
    if (!requests?.length) {
      rows.push({ ...base, requestedBy: null, expectedDate: null, purchaseUnits: null, purchaseStatus: null });
      continue;
    }
    for (const request of requests) {
      rows.push({
        ...base,
        requestedBy: cleanText(request.requested_by),
        expectedDate: request.expected_date ? request.expected_date.slice(0, 10) : null,
        purchaseUnits: request.units === null ? null : toNumber(request.units),
        purchaseStatus: PURCHASE_STATUS_AWAITING,
      });
    }
  }

  // "% QTD TRANFERIR" (exibida como A RECEBER): excesso somado do mesmo código
  // em TODAS as linhas da tabela, quando cobre o déficit desta linha
  const excessByProduct = new Map<number, number>();
  for (const row of rows) {
    if (row.productNumber === null) continue;
    excessByProduct.set(row.productNumber, (excessByProduct.get(row.productNumber) ?? 0) + row.excess);
  }
  for (const row of rows) {
    if (row.productNumber === null || row.deficit <= 0) continue;
    const available = excessByProduct.get(row.productNumber) ?? 0;
    row.transferQty = available >= row.deficit ? Math.round(available) : 0;
  }

  return rows;
}
