import type { DataModel, PurchasingModel, SourceStatus } from './model.types.js';

/**
 * O modelo publicado. Cada carga monta tabelas NOVAS e troca a referência de
 * uma vez: quem está no meio de uma requisição continua lendo o modelo antigo,
 * inteiro, e nunca uma mistura dos dois.
 *
 * `version` entra na chave do cache de respostas — carga nova invalida o cache
 * sozinha, sem ninguém precisar lembrar de limpar.
 */
function emptyModel(): DataModel {
  return {
    version: 0,
    builtAt: new Date(0).toISOString(),
    stockBalances: [],
    pendingPatrimonies: [],
    productAllocations: [],
    patrimonyAllocations: [],
    productPackings: [],
    patrimonyPackings: [],
    patrimonyStatuses: [],
    patrimonyPackingNotes: [],
    newFieldEquipment: [],
    usedFieldEquipment: [],
    chargedPatrimonies: [],
    chargedProducts: [],
    createdObjects: [],
    flatConsumption: [],
    zteDispatches: [],
    zteReturns: [],
    obsoleteFirstDays: [],
    packingProductivity: [],
    userActivity: new Map(),
    categoryByProduct: new Map(),
    hasStockControl: false,
  };
}

let current: DataModel = emptyModel();

export function getModel(): DataModel {
  return current;
}

export function publishModel(changes: Partial<Omit<DataModel, 'version' | 'builtAt'>>): void {
  current = { ...current, ...changes, version: current.version + 1, builtAt: new Date().toISOString() };
}

/** Tabelas da tela de Compras: mesma troca de referência, versão própria (ver `PurchasingModel`). */
let purchasing: PurchasingModel = {
  version: 0,
  builtAt: new Date(0).toISOString(),
  itemBalances: [],
  purchaseOrders: [],
};

export function getPurchasingModel(): PurchasingModel {
  return purchasing;
}

export function publishPurchasing(changes: Partial<Pick<PurchasingModel, 'itemBalances' | 'purchaseOrders'>>): void {
  purchasing = { ...purchasing, ...changes, version: purchasing.version + 1, builtAt: new Date().toISOString() };
}

const statuses = new Map<string, SourceStatus>();

export function setSourceStatus(status: SourceStatus): void {
  statuses.set(status.key, status);
}

export function getSourceStatuses(): SourceStatus[] {
  return [...statuses.values()];
}
