import { normalizeKey } from '../../common/helpers/text.helper.js';
import type { StockControlEntity } from '../../modules/stock-controls/stock-control.entity.js';

/** Item do cadastro de controle de estoque como o modelo usa. */
export interface StockControlEntry {
  productNumber: number;
  baseName: string;
  category: string;
  alertLevel: number;
  minimumLevel: number;
  buyer: string | null;
  leadTimeDays: number | null;
  externalProcess: string | null;
}

export interface StockControlIndex {
  /** chave produto+base — a CHAVE_PRODUTO_BASE do Power BI */
  byProductBase: Map<string, StockControlEntry>;
  /** categoria (SITUAÇÃO) por código, para as tabelas que casam só pelo código */
  categoryByProduct: Map<number, string>;
  duplicatedKeys: number;
  size: number;
}

export function stockControlKey(productNumber: number | null, baseName: string | null): string {
  return `${productNumber ?? ''}|${normalizeKey(baseName)}`;
}

export function buildStockControlIndex(items: readonly StockControlEntity[]): StockControlIndex {
  const byProductBase = new Map<string, StockControlEntry>();
  const categories = new Map<number, Set<string>>();
  let duplicatedKeys = 0;

  for (const item of items) {
    const entry: StockControlEntry = {
      productNumber: item.code,
      baseName: item.baseName,
      category: item.category,
      alertLevel: item.alertLevel,
      minimumLevel: item.minimumLevel,
      buyer: item.buyer,
      leadTimeDays: item.leadTimeDays,
      externalProcess: item.externalProcess,
    };

    // o cadastro recusa código+base repetido; a contagem fica para o caso de
    // alguém editar o arquivo à mão (vale a primeira linha, como antes)
    const key = stockControlKey(entry.productNumber, entry.baseName);
    if (byProductBase.has(key)) duplicatedKeys += 1;
    else byProductBase.set(key, entry);

    const set = categories.get(entry.productNumber) ?? new Set<string>();
    set.add(entry.category);
    categories.set(entry.productNumber, set);
  }

  const categoryByProduct = new Map<number, string>();
  for (const [productNumber, set] of categories) categoryByProduct.set(productNumber, [...set].sort().join(' / '));

  return { byProductBase, categoryByProduct, duplicatedKeys, size: byProductBase.size };
}
