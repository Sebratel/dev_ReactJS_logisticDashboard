import { PRODUCT_PACKING_EXCLUDED_RECEIVERS } from '../../model/business-rules.js';
import type { DataModel, PatrimonyPacking, ProductPacking } from '../../model/model.types.js';
import {
  buildPackingPanel, quantityByCodeAndBase, quantityByReceiver, type PackingAccessors,
} from './packing-summary.js';
import { applyFilters, DETAIL_ROW_LIMIT, limitRows, type FilterSelection, type FilterSpec } from './report-filter.js';

/** "COLABORADOR ATIVO?": casa o nome com os usuários do Voalle (relação Usuários.name). */
export const activityOf = (model: DataModel, name: string | null): readonly string[] | null => {
  const set = name ? model.userActivity.get(name) : undefined;
  return set ? [...set] : null;
};

// ---------------------------------------------------------------- produtos/cabos

const EXCLUDED_PRODUCT_RECEIVERS = new Set<string>(PRODUCT_PACKING_EXCLUDED_RECEIVERS);

export function productPackingSpec(model: DataModel): FilterSpec<ProductPacking> {
  return {
    // filtro de página: recebedores que são contas internas, não técnicos
    page: (r) => !r.receiver || !EXCLUDED_PRODUCT_RECEIVERS.has(r.receiver),
    date: (r) => r.date,
    lists: [
      { key: 'productCode', values: (r) => r.productCode },
      { key: 'product', values: (r) => r.product },
      { key: 'base', values: (r) => r.baseName },
      { key: 'supplier', values: (r) => r.supplier },
      { key: 'receiver', values: (r) => r.receiver },
      { key: 'active', includeBlank: false, values: (r) => activityOf(model, r.receiver) },
    ],
  };
}

const PRODUCT_ACCESSORS: PackingAccessors<ProductPacking> = {
  date: (r) => r.date,
  quantity: (r) => r.units,
  packing: (r) => r.documentNumber,
  productCode: (r) => r.productCode,
  product: (r) => r.product,
  base: (r) => r.baseName,
  receiver: (r) => r.receiver,
};

export function buildProductPackingReport(model: DataModel, selection: FilterSelection) {
  const spec = productPackingSpec(model);
  const { rows, options } = applyFilters(model.productPackings, spec, selection);
  const hasPeriod = Boolean(selection.startDate || selection.endDate);
  const allPeriod = hasPeriod ? applyFilters(model.productPackings, spec, { ...selection, startDate: undefined, endDate: undefined }).rows : rows;

  const cables = rows.filter((r) => r.isCable);
  const products = rows.filter((r) => !r.isCable);
  const detail = rows; // já na ordem do relatório (romaneio mais recente primeiro)

  return {
    options,
    ...buildPackingPanel(rows, allPeriod, PRODUCT_ACCESSORS, selection.endDate),
    cables: { stacked: quantityByCodeAndBase(cables, PRODUCT_ACCESSORS), byReceiver: quantityByReceiver(cables, PRODUCT_ACCESSORS) },
    products: { stacked: quantityByCodeAndBase(products, PRODUCT_ACCESSORS), byReceiver: quantityByReceiver(products, PRODUCT_ACCESSORS) },
    detail: limitRows(detail.map((r) => ({
      documentNumber: r.documentNumber,
      date: r.date,
      productCode: r.productCode,
      description: r.product,
      supplier: r.supplier,
      receiver: r.receiver,
      units: r.units,
      base: r.baseName,
    })), DETAIL_ROW_LIMIT),
  };
}

// ---------------------------------------------------------------- patrimônios

export function patrimonyPackingSpec(model: DataModel): FilterSpec<PatrimonyPacking> {
  return {
    date: (r) => r.movedAt,
    lists: [
      { key: 'productCode', values: (r) => r.productCode },
      { key: 'product', values: (r) => r.product },
      { key: 'base', values: (r) => r.baseName },
      { key: 'supplier', values: (r) => r.supplier },
      { key: 'receiver', values: (r) => r.receiver },
      { key: 'active', includeBlank: false, values: (r) => activityOf(model, r.receiver) },
    ],
  };
}

const PATRIMONY_ACCESSORS: PackingAccessors<PatrimonyPacking> = {
  date: (r) => r.movedAt,
  // RomaneiosITENS_PAT = COUNT(produto_titulo): cada linha é um patrimônio enviado
  quantity: (r) => (r.product ? 1 : 0),
  packing: (r) => r.packingNumber,
  productCode: (r) => r.productCode,
  product: (r) => r.product,
  base: (r) => r.baseName,
  receiver: (r) => r.receiver,
};

export function buildPatrimonyPackingReport(model: DataModel, selection: FilterSelection) {
  const spec = patrimonyPackingSpec(model);
  const { rows, options } = applyFilters(model.patrimonyPackings, spec, selection);
  const hasPeriod = Boolean(selection.startDate || selection.endDate);
  const allPeriod = hasPeriod ? applyFilters(model.patrimonyPackings, spec, { ...selection, startDate: undefined, endDate: undefined }).rows : rows;
  const detail = rows;

  return {
    options,
    ...buildPackingPanel(rows, allPeriod, PATRIMONY_ACCESSORS, selection.endDate),
    stacked: quantityByCodeAndBase(rows, PATRIMONY_ACCESSORS),
    byReceiver: quantityByReceiver(rows, PATRIMONY_ACCESSORS),
    detail: limitRows(detail.map((r) => ({
      packingNumber: r.packingNumber,
      movedAt: r.movedAt,
      productCode: r.productCode,
      description: r.product,
      patrimonyTag: r.patrimonyTag,
      serialNumber: r.serialNumber,
      supplier: r.supplier,
      receiver: r.receiver,
      base: r.baseName,
    })), DETAIL_ROW_LIMIT),
  };
}
