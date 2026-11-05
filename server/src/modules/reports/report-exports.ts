import { toCsv, type CsvColumn } from '../../common/helpers/csv.helper.js';
import { ITEM_TYPE } from '../../model/business-rules.js';
import type {
  DataModel, ItemBalance, PatrimonyAllocation, PatrimonyPacking, PatrimonyPackingNote, PatrimonyStatus, ProductAllocation,
  ProductPacking, PurchaseOrderItem, StockBalance,
} from '../../model/model.types.js';
import { getPurchasingModel } from '../../model/model.store.js';
import { categoryOf, PATRIMONY_ALLOCATION_SPEC, productAllocationSpec } from './allocations.service.js';
import {
  FIELD_EQUIPMENT_SPEC, groupDetail, sortNewDetail, sortUsedDetail, type FieldEquipmentDetailRow,
} from './field-equipment.service.js';
import { todayIso } from '../../common/helpers/date.helper.js';
import {
  chargedPatrimonySpec, chargedProductSpec, groupChargedProducts, sortChargedPatrimonies, toChargedPatrimonyRow,
  type ChargedPatrimonyRow, type ChargedProductRow,
} from './charged-items.service.js';
import { patrimonyPackingSpec, productPackingSpec } from './packing-lists.service.js';
import {
  filterPurchasing, groupOrderItems, PURCHASING_SPEC, sortBalances, summarizeOrders,
  type PurchaseOrderSummary, type PurchasingSlice,
} from './purchase-orders.service.js';
import { buildPendingTable, PATRIMONY_STATUS_SPEC, type PendingRow } from './patrimony-status.service.js';
import { applyFilters, parseSelection, type FilterSpec } from './report-filter.js';
import { sortAlertRows, stockAlertSpec } from './stock-alerts.service.js';

/**
 * Exportação completa (CSV) das tabelas de detalhe. A tela mostra no máximo
 * 1.000 linhas; o arquivo leva todas as do recorte, com os mesmos filtros e a
 * mesma ordem — e com os títulos de coluna do relatório original.
 */
interface ExportDefinition {
  fileName: string;
  build: (model: DataModel, query: Record<string, unknown>) => string;
}

function exportOf<T>(
  fileName: string,
  specOf: (model: DataModel) => FilterSpec<T>,
  rowsOf: (model: DataModel) => readonly T[],
  sort: (rows: T[]) => T[],
  columns: CsvColumn<T>[] | ((model: DataModel) => CsvColumn<T>[]),
): ExportDefinition {
  return {
    fileName,
    build: (model, query) => {
      const spec = specOf(model);
      const selection = parseSelection(query, spec as FilterSpec<unknown>);
      const { rows } = applyFilters(rowsOf(model), spec, selection);
      return toCsv(typeof columns === 'function' ? columns(model) : columns, sort([...rows]));
    },
  };
}

const STOCK_COLUMNS: CsvColumn<StockBalance>[] = [
  { header: 'CÓDIGO', value: (r) => r.productCode },
  { header: 'CATEGORIA', value: (r) => r.category },
  { header: 'BASE', value: (r) => r.baseAcronym ?? r.baseName },
  { header: 'DESCRIÇÃO', value: (r) => r.description },
  { header: 'UNIDADES', value: (r) => r.units },
  { header: 'ALERTA', value: (r) => r.alertLevel },
  { header: 'MÍNIMO', value: (r) => r.minimumLevel },
  { header: 'STATUS ESTOQUE', value: (r) => r.status },
  { header: 'A RECEBER', value: (r) => r.transferQty },
  { header: 'STATUS PEDIDO', value: (r) => r.purchaseStatus },
  { header: 'DATA PREVISÃO', value: (r) => r.expectedDate },
  { header: 'TOTAL PEDIDO', value: (r) => r.purchaseUnits },
  { header: 'LEAD TIME (DIAS)', value: (r) => r.leadTimeDays },
  { header: 'COMPRADOR RESPONSÁVEL', value: (r) => r.buyer },
  { header: 'PROCESSO EXTERNO', value: (r) => r.externalProcess },
];

/** As tabelas grandes já saem do modelo na ordem do relatório. */
const keepOrder = <T>(rows: T[]): T[] => rows;

/** Tela de equipamentos para campo: as duas tabelas detalhadas, agrupadas como na tela. */
function fieldEquipmentExport(
  fileName: string,
  table: 'newFieldEquipment' | 'usedFieldEquipment',
  sort: (rows: FieldEquipmentDetailRow[]) => FieldEquipmentDetailRow[],
  descriptionHeader: string,
): ExportDefinition {
  return {
    fileName,
    build: (model, query) => {
      const { rows } = applyFilters(model[table], FIELD_EQUIPMENT_SPEC, parseSelection(query, FIELD_EQUIPMENT_SPEC as FilterSpec<unknown>));
      return toCsv<FieldEquipmentDetailRow>([
        { header: 'QTD.', value: (r) => r.count },
        { header: 'DATA', value: (r) => r.date },
        { header: 'EQUIPAMENTO', value: (r) => r.equipment },
        { header: descriptionHeader, value: (r) => r.description },
      ], sort(groupDetail(rows)));
    },
  };
}

/**
 * Tela de Compras: o recorte cruza as duas tabelas (relacionamento por
 * Código), então a exportação passa pelo mesmo `filterPurchasing` da tela, e
 * lê as tabelas ao vivo (fora do modelo horário).
 */
function purchasingExport<T>(fileName: string, rowsOf: (slice: PurchasingSlice) => T[], columns: CsvColumn<T>[]): ExportDefinition {
  return {
    fileName,
    build: (_model, query) => {
      const slice = filterPurchasing(getPurchasingModel(), parseSelection(query, PURCHASING_SPEC));
      return toCsv(columns, rowsOf(slice));
    },
  };
}

export const REPORT_EXPORTS: Record<string, ExportDefinition> = {
  'product-stock-alerts/detail': exportOf(
    'alerta-estoque-produtos',
    (m) => stockAlertSpec(ITEM_TYPE.PRODUCT, m.hasStockControl),
    (m) => m.stockBalances, (rows) => sortAlertRows(rows, ITEM_TYPE.PRODUCT), STOCK_COLUMNS,
  ),
  'patrimony-stock-alerts/detail': exportOf(
    'alerta-estoque-patrimonios',
    () => stockAlertSpec(ITEM_TYPE.PATRIMONY, false),
    (m) => m.stockBalances, (rows) => sortAlertRows(rows, ITEM_TYPE.PATRIMONY), STOCK_COLUMNS,
  ),
  'patrimony-stock-alerts/statuses': exportOf<PatrimonyStatus>(
    'status-patrimonios',
    () => PATRIMONY_STATUS_SPEC,
    (m) => m.patrimonyStatuses,
    keepOrder,
    [
      { header: 'STATUS GERAL', value: (r) => r.generalStatus },
      { header: 'STATUS', value: (r) => r.currentStatus },
      { header: 'PATRIMÔNIO', value: (r) => r.patrimonyTag },
      { header: 'SERIAL', value: (r) => r.serialNumber },
      { header: 'CÓDIGO ITEM', value: (r) => r.productCode },
      { header: 'ITEM', value: (r) => r.product },
      { header: 'BASE', value: (r) => r.baseName },
      { header: 'RESPONSÁVEL', value: (r) => r.responsible },
      { header: 'EQUIPE', value: (r) => r.operationalBase },
      { header: 'TIME (SENIOR)', value: (r) => r.team },
    ],
  ),
  'patrimony-stock-alerts/pending': exportOf<PendingRow>(
    'objetos-pendentes',
    () => ({ lists: [] }),
    (m) => buildPendingTable(m.pendingPatrimonies),
    keepOrder,
    [
      { header: 'NOTA FISCAL', value: (r) => r.invoiceNumber },
      { header: 'DATA ENTRADA', value: (r) => r.entryDate },
      { header: 'CÓDIGO', value: (r) => r.productCode },
      { header: 'ITEM', value: (r) => r.description },
      { header: 'BASE OPERACIONAL', value: (r) => r.base },
      { header: 'TOTAL COMPRADO', value: (r) => r.totalUnits },
      { header: 'PENDENTE/ À PATRIMONIAR', value: (r) => r.pendingUnits },
    ],
  ),
  'patrimony-stock-alerts/packing-history': exportOf<PatrimonyPackingNote>(
    'historico-romaneios-patrimonios',
    () => ({ lists: [] }),
    (m) => m.patrimonyPackingNotes,
    keepOrder,
    [
      { header: 'DATA', value: (r) => r.createdAt },
      { header: 'RESPONSÁVEL', value: (r) => r.responsible },
      { header: 'RECEBIDO POR', value: (r) => r.receivedBy },
      { header: 'DESCRIÇÃO', value: (r) => r.description },
      { header: 'PATRIMÔNIO', value: (r) => r.patrimonyTag },
      { header: 'SERIAL', value: (r) => r.serialNumber },
    ],
  ),
  'patrimony-packing-lists/detail': exportOf<PatrimonyPacking>(
    'romaneio-patrimonios', patrimonyPackingSpec, (m) => m.patrimonyPackings, keepOrder,
    [
      { header: 'ROMANEIO', value: (r) => r.packingNumber },
      { header: 'DATA', value: (r) => r.movedAt },
      { header: 'CÓDIGO', value: (r) => r.productCode },
      { header: 'DESCRIÇÃO', value: (r) => r.product },
      { header: 'PATRIMÔNIO', value: (r) => r.patrimonyTag },
      { header: 'SERIAL', value: (r) => r.serialNumber },
      { header: 'FORNECEDOR', value: (r) => r.supplier },
      { header: 'RECEBEDOR', value: (r) => r.receiver },
      { header: 'BASE DE ORIGEM', value: (r) => r.baseName },
    ],
  ),
  'patrimony-allocations/detail': exportOf<PatrimonyAllocation>(
    'rastreabilidade-patrimonios', () => PATRIMONY_ALLOCATION_SPEC, (m) => m.patrimonyAllocations, keepOrder,
    [
      { header: 'PRODUTO', value: (r) => r.equipment },
      { header: 'PATRIMÔNIO', value: (r) => r.patrimonyTag },
      { header: 'SERIAL', value: (r) => r.serialNumber },
      { header: 'N° PROTOCOLO', value: (r) => r.protocolNumber },
      { header: 'DATA/ HORA', value: (r) => r.outAt },
      { header: 'ÚLTIMO RESPONSÁVEL (DE)', value: (r) => r.allocatedBy },
      { header: 'RESPONSÁVEL ATUAL (PARA)', value: (r) => r.currentHolder },
      { header: 'RETORNO?', value: (r) => r.returned },
      { header: 'DATA RETORNO', value: (r) => r.returnedDate },
      { header: 'CIDADE', value: (r) => r.city },
      { header: 'SITE', value: (r) => r.site },
    ],
  ),
  'product-packing-lists/detail': exportOf<ProductPacking>(
    'romaneio-produtos-cabos', productPackingSpec, (m) => m.productPackings, keepOrder,
    [
      { header: 'ROMANEIO', value: (r) => r.documentNumber },
      { header: 'DATA', value: (r) => r.date },
      { header: 'CÓDIGO', value: (r) => r.productCode },
      { header: 'DESCRIÇÃO', value: (r) => r.product },
      { header: 'FORNECEDOR', value: (r) => r.supplier },
      { header: 'RECEBEDOR', value: (r) => r.receiver },
      { header: 'QTD', value: (r) => r.units },
      { header: 'BASE DE ORIGEM', value: (r) => r.baseName },
    ],
  ),
  'purchase-orders/balances': purchasingExport<ItemBalance>(
    'saldo-de-itens', (s) => sortBalances([...s.balances]),
    [
      { header: 'CÓDIGO', value: (r) => r.productCode },
      { header: 'ITEM', value: (r) => r.item },
      { header: 'BASE', value: (r) => r.base },
      { header: 'QUANTIDADE', value: (r) => r.units },
      { header: 'UNIDADE', value: (r) => r.unitMeasure },
      { header: 'ATUALIZA ESTOQUE', value: (r) => r.updatesStock },
      { header: 'GERA PATRIMÔNIO', value: (r) => r.generatesPatrimony },
    ],
  ),
  'purchase-orders/orders': purchasingExport<PurchaseOrderSummary>(
    'pedidos-de-compra', (s) => summarizeOrders(s.orders),
    [
      { header: 'N° PEDIDO', value: (r) => r.orderNumber },
      { header: 'DATA', value: (r) => r.date },
      { header: 'PREV.ENTREGA', value: (r) => r.expectedDate },
      { header: 'FORNECEDOR', value: (r) => r.supplier },
      { header: 'STATUS', value: (r) => r.status },
      { header: 'BASE', value: (r) => r.base },
    ],
  ),
  'purchase-orders/items': purchasingExport<PurchaseOrderItem>(
    'pedidos-de-compra-itens', (s) => groupOrderItems(s.orders),
    [
      { header: 'DATA', value: (r) => r.date },
      { header: 'N° PEDIDO', value: (r) => r.orderId },
      { header: 'PREV.ENTREGA', value: (r) => r.expectedDate },
      { header: 'FORNECEDOR', value: (r) => r.supplier },
      { header: 'STATUS', value: (r) => r.status },
      { header: 'BASE', value: (r) => r.base },
      { header: 'CÓDIGO', value: (r) => r.productCode },
      { header: 'DESCRIÇÃO ITEM', value: (r) => r.description },
      { header: 'UNIDADE', value: (r) => r.unitMeasure },
      { header: 'QTD.', value: (r) => r.units },
      { header: 'ATUALIZA ESTOQUE', value: (r) => r.updatesStock },
      { header: 'GERA PATRIMÔNIO', value: (r) => r.generatesPatrimony },
      { header: 'VAL. UNITÁRIO', value: (r) => r.unitAmount },
      { header: 'TOTAL PEDIDO', value: (r) => r.orderTotal },
      { header: 'TOTAL COM IMPOSTO', value: (r) => r.totalAmount },
      { header: 'PESSOA', value: (r) => r.requestedBy },
      { header: 'DELETADO', value: (r) => r.deleted },
    ],
  ),
  'charged-patrimonies/detail': {
    fileName: 'patrimonios-em-carga',
    build: (model, query) => {
      const spec = chargedPatrimonySpec(model);
      const { rows } = applyFilters(model.chargedPatrimonies, spec, parseSelection(query, spec as FilterSpec<unknown>));
      const today = todayIso();
      return toCsv<ChargedPatrimonyRow>([
        { header: 'TÉCNICO', value: (r) => r.holder },
        { header: 'BASE', value: (r) => r.base },
        { header: 'CÓD.PRODUTO', value: (r) => r.productCode },
        { header: 'DESCRIÇÃO', value: (r) => r.description },
        { header: 'SERIAL', value: (r) => r.serialNumber },
        { header: 'PATRIMÔNIO', value: (r) => r.patrimonyTag },
        { header: 'DATA', value: (r) => r.movedAt },
        { header: 'TEMPO (DIAS)', value: (r) => r.days },
        { header: 'VALOR DO ITEM', value: (r) => r.value },
      ], sortChargedPatrimonies([...rows]).map((r) => toChargedPatrimonyRow(r, today)));
    },
  },
  'charged-products/detail': {
    fileName: 'produtos-em-carga',
    build: (model, query) => {
      const spec = chargedProductSpec(model);
      const { rows } = applyFilters(model.chargedProducts, spec, parseSelection(query, spec as FilterSpec<unknown>));
      return toCsv<ChargedProductRow>([
        { header: 'TÉCNICO', value: (r) => r.holder },
        { header: 'BASE', value: (r) => r.base },
        { header: 'CÓDIGO', value: (r) => r.productCode },
        { header: 'DESCRIÇÃO', value: (r) => r.description },
        { header: 'QUANTIDADE', value: (r) => r.quantity },
        { header: 'UNIDADE DE MEDIDA', value: (r) => r.unitMeasure },
      ], groupChargedProducts(rows));
    },
  },
  'field-equipment/new-detail': fieldEquipmentExport(
    'equipamentos-novos-enviados-a-campo', 'newFieldEquipment', sortNewDetail, 'DESCRIÇÃO MOVIMENTAÇÃO',
  ),
  'field-equipment/used-detail': fieldEquipmentExport(
    'equipamentos-usados-enviados-a-campo', 'usedFieldEquipment', sortUsedDetail, 'DESCRIÇÃO OCORRÊNCIA',
  ),
  'product-allocations/detail': exportOf<ProductAllocation>(
    'rastreabilidade-produtos-cabos', productAllocationSpec, (m) => m.productAllocations, keepOrder,
    (model) => [
      { header: 'ALOCADO EM', value: (r) => r.createdAt },
      { header: 'N° PROTOCOLO', value: (r) => r.protocolNumber },
      { header: 'NOTA', value: (r) => r.invoiceNumber },
      { header: 'TÉCNICO', value: (r) => r.technician },
      { header: 'BASE', value: (r) => r.baseGroup },
      { header: 'CATEGORIA', value: (r) => categoryOf(model, r) },
      { header: 'CÓDIGO', value: (r) => r.productCode },
      { header: 'PRODUTO', value: (r) => r.product },
      { header: 'QTD', value: (r) => r.units },
      { header: 'MEDIDA', value: (r) => r.unitMeasure },
    ],
  ),
};
