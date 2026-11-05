import { appConfig } from '../config/env.config.js';
import { queryMaria } from '../database/maria.client.js';
import { loadSql } from '../database/sql-loader.js';
import { queryVoalle } from '../database/voalle.client.js';
import {
  FIELD_EQUIPMENT_MODELS, FLAT_EXCLUDED_DAY, FLAT_EXCLUDED_DAY_RECEIVERS, FLAT_PRODUCT_CODE, MANAGEMENT_SINCE, OBSOLETE_EQUIPMENT_HOLDER,
  PACKING_NOTES_EXCLUDED_RECEIVERS, PACKING_NOTES_RESPONSIBLES, WAREHOUSE_SUPPLIERS, ZTE_MOVEMENT_MODELS,
} from '../model/business-rules.js';
import { productivityMonths } from '../modules/management/period-comparison.js';
import type {
  ChargedPatrimonySourceRow, ChargedProductSourceRow, CreatedObjectsSourceRow, FlatConsumptionSourceRow, ObsoleteEquipmentSourceRow,
  PackingProductivitySourceRow, ZteDispatchSourceRow, ZteReturnSourceRow, FieldEquipmentSourceRow, ItemBalanceSourceRow, PatrimonyAllocationSourceRow, PatrimonyPackingNoteSourceRow, PatrimonyPackingSourceRow,
  PatrimonyStatusSourceRow, PendingPatrimonySourceRow, ProductAllocationSourceRow,
  ProductPackingSourceRow, PurchaseOrderItemSourceRow, PurchaseRequestSourceRow, SeniorCollaboratorSourceRow,
  StockBalanceSourceRow, UserSourceRow,
} from './source.types.js';

/**
 * As fontes do modelo — uma por tabela do modelo semântico do Power BI.
 *
 * `phase` separa o que é cadastro/saldo (rápido, e de que outras tabelas
 * dependem) do que é movimento (pesado). A carga roda primeiro todas as de
 * cadastro e só depois as de movimento, para a base da Senior já estar pronta
 * quando o status dos patrimônios for montado.
 *
 * `LIVE` são as fontes da tela de Compras (lançamento e saldos): ficam FORA
 * da carga horária e são lidas a cada minuto (`live-refresh.job.ts`).
 *
 * O cadastro de controle de estoque não está aqui: é dado do próprio app
 * (`modules/stock-controls`), lido do disco a cada carga e a cada alteração.
 */
export interface SourceDefinition<T> {
  key: string;
  label: string;
  origin: 'VOALLE' | 'MARIADB';
  phase: 'MASTER' | 'ACTIVITY' | 'LIVE';
  load: () => Promise<T[]>;
}

const voalle = <T extends object>(name: string, params: unknown[] = [], timeoutMs?: number) => () => (
  queryVoalle<T & Record<string, unknown>>(loadSql(name), params, timeoutMs) as Promise<T[]>
);

/**
 * Teto das consultas ao vivo: levam ~1 s; se o banco travar, a leitura falha
 * antes da próxima rodada em vez de empilhar conexões presas.
 */
const LIVE_QUERY_TIMEOUT_MS = 45_000;

export const SOURCES = {
  stockBalances: {
    key: 'stockBalances',
    label: 'Saldo de estoque',
    origin: 'VOALLE',
    phase: 'MASTER',
    load: voalle<StockBalanceSourceRow>('stock_balances'),
  } satisfies SourceDefinition<StockBalanceSourceRow>,
  purchaseRequests: {
    key: 'purchaseRequests',
    label: 'Pedidos de compra',
    origin: 'VOALLE',
    phase: 'MASTER',
    load: voalle<PurchaseRequestSourceRow>('purchase_requests'),
  } satisfies SourceDefinition<PurchaseRequestSourceRow>,
  pendingPatrimonies: {
    key: 'pendingPatrimonies',
    label: 'Objetos pendentes',
    origin: 'VOALLE',
    phase: 'MASTER',
    load: voalle<PendingPatrimonySourceRow>('pending_patrimonies'),
  } satisfies SourceDefinition<PendingPatrimonySourceRow>,
  users: {
    key: 'users',
    label: 'Usuários',
    origin: 'VOALLE',
    phase: 'MASTER',
    load: voalle<UserSourceRow>('users'),
  } satisfies SourceDefinition<UserSourceRow>,
  senior: {
    key: 'senior',
    label: 'Colaboradores (Senior)',
    origin: 'MARIADB',
    phase: 'MASTER',
    load: () => queryMaria<SeniorCollaboratorSourceRow>(loadSql('senior_collaborators')),
  } satisfies SourceDefinition<SeniorCollaboratorSourceRow>,
  productAllocations: {
    key: 'productAllocations',
    label: 'Alocação de produtos',
    origin: 'VOALLE',
    phase: 'ACTIVITY',
    load: () => voalle<ProductAllocationSourceRow>('product_allocations', [appConfig.since.consumption])(),
  } satisfies SourceDefinition<ProductAllocationSourceRow>,
  patrimonyAllocations: {
    key: 'patrimonyAllocations',
    label: 'Alocação de patrimônios',
    origin: 'VOALLE',
    phase: 'ACTIVITY',
    load: () => voalle<PatrimonyAllocationSourceRow>('patrimony_allocations', [appConfig.since.consumption])(),
  } satisfies SourceDefinition<PatrimonyAllocationSourceRow>,
  productPackings: {
    key: 'productPackings',
    label: 'Romaneio de produtos/cabos',
    origin: 'VOALLE',
    phase: 'ACTIVITY',
    load: () => voalle<ProductPackingSourceRow>('product_packing_lists', [appConfig.since.productPacking, [...WAREHOUSE_SUPPLIERS]])(),
  } satisfies SourceDefinition<ProductPackingSourceRow>,
  patrimonyPackings: {
    key: 'patrimonyPackings',
    label: 'Romaneio de patrimônios',
    origin: 'VOALLE',
    phase: 'ACTIVITY',
    load: () => voalle<PatrimonyPackingSourceRow>('patrimony_packing_lists', [appConfig.since.patrimonyPacking, [...WAREHOUSE_SUPPLIERS]])(),
  } satisfies SourceDefinition<PatrimonyPackingSourceRow>,
  patrimonyStatuses: {
    key: 'patrimonyStatuses',
    label: 'Status real dos patrimônios',
    origin: 'VOALLE',
    phase: 'ACTIVITY',
    load: voalle<PatrimonyStatusSourceRow>('patrimony_statuses'),
  } satisfies SourceDefinition<PatrimonyStatusSourceRow>,
  patrimonyPackingNotes: {
    key: 'patrimonyPackingNotes',
    label: 'Histórico de romaneios de patrimônio',
    origin: 'VOALLE',
    phase: 'ACTIVITY',
    load: () => voalle<PatrimonyPackingNoteSourceRow>('patrimony_packing_notes', [
      appConfig.since.patrimonyNotes, [...PACKING_NOTES_RESPONSIBLES], [...PACKING_NOTES_EXCLUDED_RECEIVERS],
    ])(),
  } satisfies SourceDefinition<PatrimonyPackingNoteSourceRow>,
  newFieldEquipment: {
    key: 'newFieldEquipment',
    label: 'Equipamentos novos enviados a campo',
    origin: 'VOALLE',
    phase: 'ACTIVITY',
    load: () => voalle<FieldEquipmentSourceRow>('field_equipment_new', [[...FIELD_EQUIPMENT_MODELS], appConfig.since.fieldEquipment])(),
  } satisfies SourceDefinition<FieldEquipmentSourceRow>,
  usedFieldEquipment: {
    key: 'usedFieldEquipment',
    label: 'Equipamentos usados enviados a campo',
    origin: 'VOALLE',
    phase: 'ACTIVITY',
    load: () => voalle<FieldEquipmentSourceRow>('field_equipment_used', [[...FIELD_EQUIPMENT_MODELS], appConfig.since.fieldEquipment])(),
  } satisfies SourceDefinition<FieldEquipmentSourceRow>,
  chargedPatrimonies: {
    key: 'chargedPatrimonies',
    label: 'Patrimônios em carga',
    origin: 'VOALLE',
    phase: 'ACTIVITY',
    load: voalle<ChargedPatrimonySourceRow>('charged_patrimonies'),
  } satisfies SourceDefinition<ChargedPatrimonySourceRow>,
  chargedProducts: {
    key: 'chargedProducts',
    label: 'Produtos em carga',
    origin: 'VOALLE',
    phase: 'ACTIVITY',
    load: voalle<ChargedProductSourceRow>('charged_products'),
  } satisfies SourceDefinition<ChargedProductSourceRow>,
  // ---- seção Gerencial (Power BI "LOG - Gerencial"): de 0,1 s a ~16 s cada
  createdObjects: {
    key: 'createdObjects',
    label: 'Objetos criados',
    origin: 'VOALLE',
    phase: 'ACTIVITY',
    load: () => voalle<CreatedObjectsSourceRow>('management_created_objects', [MANAGEMENT_SINCE.createdObjects])(),
  } satisfies SourceDefinition<CreatedObjectsSourceRow>,
  flatConsumption: {
    key: 'flatConsumption',
    label: 'Consumo de flat',
    origin: 'VOALLE',
    phase: 'ACTIVITY',
    load: () => voalle<FlatConsumptionSourceRow>('management_flat_consumption', [
      MANAGEMENT_SINCE.flatConsumption, FLAT_PRODUCT_CODE, FLAT_EXCLUDED_DAY, [...FLAT_EXCLUDED_DAY_RECEIVERS],
    ])(),
  } satisfies SourceDefinition<FlatConsumptionSourceRow>,
  zteDispatches: {
    key: 'zteDispatches',
    label: 'ONUs ZTE novas',
    origin: 'VOALLE',
    phase: 'ACTIVITY',
    load: () => voalle<ZteDispatchSourceRow>('management_zte_dispatches', [[...ZTE_MOVEMENT_MODELS]])(),
  } satisfies SourceDefinition<ZteDispatchSourceRow>,
  zteReturns: {
    key: 'zteReturns',
    label: 'ONUs ZTE usadas (voltas do laboratório)',
    origin: 'VOALLE',
    phase: 'ACTIVITY',
    load: () => voalle<ZteReturnSourceRow>('management_zte_returns', [[...ZTE_MOVEMENT_MODELS]])(),
  } satisfies SourceDefinition<ZteReturnSourceRow>,
  obsoleteEquipment: {
    key: 'obsoleteEquipment',
    label: 'Equipamentos obsoletos',
    origin: 'VOALLE',
    phase: 'ACTIVITY',
    load: () => voalle<ObsoleteEquipmentSourceRow>('management_obsolete_equipment', [OBSOLETE_EQUIPMENT_HOLDER])(),
  } satisfies SourceDefinition<ObsoleteEquipmentSourceRow>,
  packingProductivity: {
    key: 'packingProductivity',
    label: 'Produtividade do almoxarifado',
    origin: 'VOALLE',
    phase: 'ACTIVITY',
    // os dois últimos meses fechados, contados a partir do dia da carga
    load: () => {
      const { from, to } = productivityMonths();
      return voalle<PackingProductivitySourceRow>('management_packing_productivity', [from, to])();
    },
  } satisfies SourceDefinition<PackingProductivitySourceRow>,
  itemBalances: {
    key: 'itemBalances',
    label: 'Saldo de itens (compras)',
    origin: 'VOALLE',
    phase: 'LIVE',
    load: voalle<ItemBalanceSourceRow>('item_balances', [], LIVE_QUERY_TIMEOUT_MS),
  } satisfies SourceDefinition<ItemBalanceSourceRow>,
  purchaseOrders: {
    key: 'purchaseOrders',
    label: 'Pedidos de compra lançados',
    origin: 'VOALLE',
    phase: 'LIVE',
    load: () => voalle<PurchaseOrderItemSourceRow>('purchase_order_items', [appConfig.since.purchaseOrders], LIVE_QUERY_TIMEOUT_MS)(),
  } satisfies SourceDefinition<PurchaseOrderItemSourceRow>,
};

export type SourceKey = keyof typeof SOURCES;

/** Fontes da seção Gerencial: só aparecem em /data-sources para quem tem acesso a ela. */
export const MANAGEMENT_SOURCE_KEYS: readonly string[] = [
  SOURCES.createdObjects.key, SOURCES.flatConsumption.key, SOURCES.zteDispatches.key,
  SOURCES.zteReturns.key, SOURCES.obsoleteEquipment.key, SOURCES.packingProductivity.key,
];
