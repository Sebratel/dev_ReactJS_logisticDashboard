import { countBy, stackBy, sumBy } from '../../common/helpers/aggregation.helper.js';
import { PRODUCT_ALLOCATION_EXCLUDED_TECHNICIANS } from '../../model/business-rules.js';
import type { DataModel, PatrimonyAllocation, ProductAllocation } from '../../model/model.types.js';
import { applyFilters, DETAIL_ROW_LIMIT, limitRows, type FilterSelection, type FilterSpec } from './report-filter.js';

/**
 * As duas telas de RASTREABILIDADE (alocação em protocolo): produtos & cabos e
 * patrimônios.
 */

// ---------------------------------------------------------------- produtos & cabos

const EXCLUDED_TECHNICIANS = new Set<string>(PRODUCT_ALLOCATION_EXCLUDED_TECHNICIANS);

/** Categoria do cadastro de controle de estoque — consultada na hora, não gravada na linha. */
export const categoryOf = (model: DataModel, r: ProductAllocation): string | null => (
  r.productNumber === null ? null : model.categoryByProduct.get(r.productNumber) ?? null
);

export function productAllocationSpec(model: DataModel): FilterSpec<ProductAllocation> {
  return {
    // filtro de página: contas de almoxarifado/laboratório não são técnicos
    page: (r) => !r.technician || !EXCLUDED_TECHNICIANS.has(r.technician),
    date: (r) => r.issueDate,
    lists: [
      { key: 'productCode', values: (r) => r.productCode },
      { key: 'product', values: (r) => r.product },
      { key: 'category', values: (r) => categoryOf(model, r) },
      { key: 'technician', values: (r) => r.technician },
      { key: 'baseGroup', values: (r) => r.baseGroup },
      {
        key: 'active',
        includeBlank: false,
        values: (r) => {
          const set = r.technician ? model.userActivity.get(r.technician) : undefined;
          return set ? [...set] : null;
        },
      },
    ],
    searches: [
      { key: 'invoiceNumber', value: (r) => r.invoiceNumber },
      { key: 'protocolNumber', value: (r) => r.protocolNumber },
    ],
  };
}

export function buildProductAllocationReport(model: DataModel, selection: FilterSelection) {
  const { rows, options } = applyFilters(model.productAllocations, productAllocationSpec(model), selection);
  const cables = rows.filter((r) => r.isCable);
  const products = rows.filter((r) => !r.isCable);
  // a tabela do modelo já vem na ordem do relatório (mais recente primeiro)
  const detail = rows;
  const units = (r: ProductAllocation) => r.units;

  return {
    options,
    totals: { units: products.reduce((s, r) => s + r.units, 0), cableUnits: cables.reduce((s, r) => s + r.units, 0), rows: rows.length },
    products: {
      stacked: stackBy(products, (r) => r.productCode, (r) => r.baseGroup, units, 25),
      byTechnician: sumBy(products, (r) => r.technician, units),
    },
    cables: {
      stacked: stackBy(cables, (r) => r.productCode, (r) => r.baseGroup, units, 25),
      byTechnician: sumBy(cables, (r) => r.technician, units),
    },
    detail: limitRows(detail.map((r) => ({
      createdAt: r.createdAt,
      protocolNumber: r.protocolNumber,
      invoiceNumber: r.invoiceNumber,
      technician: r.technician,
      baseGroup: r.baseGroup,
      category: categoryOf(model, r),
      productCode: r.productCode,
      product: r.product,
      units: r.units,
      unitMeasure: r.unitMeasure,
    })), DETAIL_ROW_LIMIT),
  };
}

// ---------------------------------------------------------------- patrimônios

/**
 * Patrimônio, serial, protocolo e cliente têm centenas de milhares de valores:
 * no Power BI eram listas com busca; aqui são campos de busca direto.
 */
export const PATRIMONY_ALLOCATION_SPEC: FilterSpec<PatrimonyAllocation> = {
  date: (r) => r.outAt,
  lists: [
    { key: 'equipment', values: (r) => r.equipment },
    { key: 'allocatedBy', values: (r) => r.allocatedBy },
    { key: 'returned', values: (r) => r.returned },
  ],
  searches: [
    { key: 'patrimonyTag', value: (r) => r.patrimonyTag },
    { key: 'serialNumber', value: (r) => r.serialNumber },
    { key: 'protocolNumber', value: (r) => r.protocolNumber },
    { key: 'currentHolder', value: (r) => r.currentHolder },
  ],
};

export function buildPatrimonyAllocationReport(model: DataModel, selection: FilterSelection) {
  const { rows, options } = applyFilters(model.patrimonyAllocations, PATRIMONY_ALLOCATION_SPEC, selection);
  const detail = rows;

  // "MOVIMENTOS DOS PATRIMÔNIOS": patrimônio + equipamento. Map aninhado em vez de
  // chave concatenada: são ~570 mil linhas e montar uma string por linha custava ~0,5 s
  const byTag = new Map<string | null, Map<string | null, number>>();
  for (const r of rows) {
    let inner = byTag.get(r.patrimonyTag);
    if (!inner) {
      inner = new Map();
      byTag.set(r.patrimonyTag, inner);
    }
    inner.set(r.equipment, (inner.get(r.equipment) ?? 0) + 1);
  }
  const byPatrimony: { patrimonyTag: string; equipment: string; total: number }[] = [];
  for (const [tag, inner] of byTag) {
    for (const [equipment, total] of inner) {
      byPatrimony.push({ patrimonyTag: tag ?? '(Em branco)', equipment: equipment ?? '(Em branco)', total });
    }
  }
  byPatrimony.sort((a, b) => b.total - a.total);

  return {
    options,
    total: rows.length,
    byEquipment: countBy(rows, (r) => r.equipment),
    byPatrimony: byPatrimony.slice(0, 500),
    detail: limitRows(detail.map((r) => ({
      equipment: r.equipment,
      patrimonyTag: r.patrimonyTag,
      serialNumber: r.serialNumber,
      protocolNumber: r.protocolNumber,
      outAt: r.outAt,
      allocatedBy: r.allocatedBy,
      currentHolder: r.currentHolder,
      returned: r.returned,
      returnedDate: r.returnedDate,
      city: r.city,
      site: r.site,
    })), DETAIL_ROW_LIMIT),
  };
}
