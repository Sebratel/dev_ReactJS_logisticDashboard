import type { ItemType, StockStatus } from './business-rules.js';

/**
 * Tabelas do modelo em memória — o equivalente às tabelas do modelo semântico do
 * Power BI, já com as colunas calculadas (DAX) resolvidas na carga.
 *
 * Datas ficam como texto ISO local ('AAAA-MM-DD' ou 'AAAA-MM-DD HH:mm:ss'): é
 * o que o Voalle grava e o que o Power BI mostrava, sem conversão de fuso.
 */

/** "Saldo Voalle" x "Controle Estoque" x "Pedidos Compra" — uma linha por produto, base e pedido em aberto. */
export interface StockBalance {
  productCode: string;
  productNumber: number | null;
  description: string;
  itemType: ItemType;
  baseName: string | null;
  baseAcronym: string | null;
  /** o produto+base está no cadastro de controle de estoque */
  isControlled: boolean;
  /** cadastro do PRODUTO no Voalle: ativo? e deletado? (filtros do alerta de produtos) */
  active: YesNo;
  deleted: YesNo;
  category: string | null;
  units: number;
  /** ESTOQUE MÍNIMO do cadastro do produto no Voalle (base do excesso/déficit) */
  voalleMinimum: number;
  /** ALERTA ESTOQUE e ESTOQUE MÍNIMO do cadastro (base do STATUS2) */
  alertLevel: number | null;
  minimumLevel: number | null;
  status: StockStatus;
  excess: number;
  deficit: number;
  transferQty: number;
  leadTimeDays: number | null;
  buyer: string | null;
  externalProcess: string | null;
  requestedBy: string | null;
  expectedDate: string | null;
  purchaseUnits: number | null;
  purchaseStatus: string | null;
}

/** "Objetos Pendentes" — comprado e ainda não patrimoniado. */
export interface PendingPatrimony {
  invoiceNumber: string | null;
  entryDate: string | null;
  productCode: string | null;
  description: string | null;
  baseName: string | null;
  totalUnits: number;
  pendingUnits: number;
}

/** "Consumo Produtos" — produto/cabo alocado em protocolo. */
export interface ProductAllocation {
  id: number;
  technician: string | null;
  productCode: string | null;
  productNumber: number | null;
  product: string | null;
  units: number;
  unitMeasure: string | null;
  invoiceNumber: string | null;
  createdAt: string | null;
  issueDate: string | null;
  protocolNumber: string | null;
  baseGroup: string;
  isCable: boolean;
}

/** "Consumo Patrimônios" — saída de patrimônio em atendimento. */
export interface PatrimonyAllocation {
  protocolNumber: string | null;
  equipment: string | null;
  patrimonyTag: string | null;
  serialNumber: string | null;
  outAt: string | null;
  returned: string;
  returnedDate: string | null;
  allocatedBy: string | null;
  currentHolder: string | null;
  city: string | null;
  site: string | null;
}

/** "Romaneio Produtos/ Cabos". */
export interface ProductPacking {
  movementId: number;
  documentNumber: string | null;
  units: number;
  productCode: string | null;
  product: string | null;
  baseName: string | null;
  date: string | null;
  receiver: string | null;
  supplier: string | null;
  isCable: boolean;
}

/** "Romaneio de Patrimônios". */
export interface PatrimonyPacking {
  movedAt: string | null;
  productCode: string | null;
  product: string | null;
  baseName: string | null;
  patrimonyId: number | null;
  serialNumber: string | null;
  patrimonyTag: string | null;
  packingNumber: string | null;
  supplier: string | null;
  receiver: string | null;
}

/** "Status Real Patrimonio" + base/equipe da Senior. */
export interface PatrimonyStatus {
  patrimonyId: number;
  productCode: string | null;
  product: string | null;
  baseName: string | null;
  serialNumber: string | null;
  patrimonyTag: string | null;
  currentStatus: string;
  generalStatus: string;
  responsible: string | null;
  operationalBase: string | null;
  team: string | null;
  /** cadastro do PATRIMÔNIO no Voalle (patrimonies.active / .deleted) */
  active: YesNo;
  deleted: YesNo;
}

/** "Notas Romaneio Patrimônios" (já com os filtros do visual aplicados na consulta). */
export interface PatrimonyPackingNote {
  createdAt: string | null;
  responsible: string | null;
  receivedBy: string | null;
  description: string | null;
  patrimonyTag: string | null;
  serialNumber: string | null;
}

/**
 * Uma saída de equipamento para campo (Power BI "CTR"): "PRIMEIRO VÍNCULO"
 * (novo) ou "ÚLTIMO VÍNCULO" (usado, depois de passar pelo laboratório).
 */
export interface FieldEquipmentDispatch {
  patrimonyId: number;
  /** AAAA-MM-DD (o Power BI tirava a hora) */
  date: string;
  equipment: string | null;
  /** texto da ocorrência ("Enviado em Romaneio Nº … Sob Responsabilidade de …") */
  description: string | null;
}

/** "Objetos em Carga" · saldo patrimônio: um patrimônio com o seu responsável. */
export interface ChargedPatrimony {
  patrimonyId: number;
  patrimonyTag: string | null;
  serialNumber: string | null;
  description: string | null;
  productCode: string | null;
  /** valor de compra do patrimônio (uma vez — ver charged_patrimonies.sql) */
  value: number | null;
  holder: string;
  /** base pela cidade do responsável (`HOLDER_CITY_BASES`) */
  base: string;
  /** última movimentação do patrimônio, sem a hora */
  movedAt: string | null;
  /** cadastro do PATRIMÔNIO no Voalle (patrimonies.active / .deleted) */
  active: YesNo;
  deleted: YesNo;
}

/** "Objetos em Carga" · saldo produto: um produto com uma pessoa, a um preço unitário. */
export interface ChargedProduct {
  holder: string;
  base: string;
  productCode: string | null;
  description: string | null;
  unitMeasure: string | null;
  unitValue: number | null;
  quantity: number;
  /** quantidade x preço unitário */
  totalValue: number;
  /** cadastro do PRODUTO no Voalle (service_products.active / .deleted) */
  active: YesNo;
  deleted: YesNo;
}

/** Sim/Não dos campos do produto; null quando a linha não tem produto. */
export type YesNo = 'Sim' | 'Não' | null;

/** "Produtos" do Power BI CMP — saldo disponível somado por produto e base (todas as bases da empresa 1). */
export interface ItemBalance {
  productCode: string | null;
  item: string;
  base: string | null;
  units: number;
  unitMeasure: string | null;
  updatesStock: YesNo;
  generatesPatrimony: YesNo;
}

/** "Pedido de Compra" do Power BI CMP — um item de pedido de aquisição. */
export interface PurchaseOrderItem {
  orderId: number;
  itemId: number | null;
  date: string | null;
  expectedDate: string | null;
  supplier: string | null;
  requestedBy: string | null;
  status: string | null;
  deleted: 'Deletado' | 'Não' | null;
  /** total do PEDIDO (repete em cada item dele) */
  orderTotal: number | null;
  base: string | null;
  productCode: string | null;
  description: string | null;
  unitMeasure: string | null;
  units: number | null;
  unitAmount: number | null;
  itemAmount: number | null;
  totalAmount: number | null;
  updatesStock: YesNo;
  generatesPatrimony: YesNo;
}

// ------------------------------------------------------------------ gerencial

/** Valor por dia (AAAA-MM-DD), em ordem de data. */
export interface DailyValue {
  day: string;
  value: number;
}

/** Voltas de ONU ZTE do laboratório ao almoxarifado, por dia, modelo e origem. */
export interface ZteReturnDaily {
  day: string;
  model: string;
  origin: string;
  returns: number;
}

/** Patrimônios enviados num romaneio (descrição da ocorrência) por quem lançou, no mês AAAA-MM. */
export interface PackingProductivityRow {
  name: string;
  month: string;
  description: string | null;
  patrimonies: number;
}

/**
 * As tabelas da tela de Compras. Ficam FORA do `DataModel`, com versão
 * própria: são relidas a cada minuto, e misturá-las ao modelo grande
 * invalidaria o cache de respostas de TODAS as telas a cada minuto.
 */
export interface PurchasingModel {
  version: number;
  builtAt: string;
  itemBalances: ItemBalance[];
  purchaseOrders: PurchaseOrderItem[];
}

export interface SourceStatus {
  key: string;
  label: string;
  origin: 'VOALLE' | 'MARIADB' | 'APP';
  rows: number | null;
  durationMs: number | null;
  updatedAt: string | null;
  error: string | null;
}

export interface DataModel {
  version: number;
  builtAt: string;
  stockBalances: StockBalance[];
  pendingPatrimonies: PendingPatrimony[];
  productAllocations: ProductAllocation[];
  patrimonyAllocations: PatrimonyAllocation[];
  productPackings: ProductPacking[];
  patrimonyPackings: PatrimonyPacking[];
  patrimonyStatuses: PatrimonyStatus[];
  patrimonyPackingNotes: PatrimonyPackingNote[];
  newFieldEquipment: FieldEquipmentDispatch[];
  usedFieldEquipment: FieldEquipmentDispatch[];
  chargedPatrimonies: ChargedPatrimony[];
  chargedProducts: ChargedProduct[];
  /** seção Gerencial (Power BI "LOG - Gerencial") */
  createdObjects: DailyValue[];
  flatConsumption: DailyValue[];
  zteDispatches: DailyValue[];
  zteReturns: ZteReturnDaily[];
  /** primeira data de cada serial do depósito de rádio, em ordem (o acumulado é a contagem até a data) */
  obsoleteFirstDays: string[];
  packingProductivity: PackingProductivityRow[];
  /** nome do usuário do Voalle -> situações encontradas ('Ativo'/'Desativado') */
  userActivity: Map<string, Set<string>>;
  /**
   * Categoria (SITUAÇÃO do cadastro de controle de estoque) por código de
   * produto. Fica fora das tabelas de movimento de propósito: assim uma
   * alteração no cadastro vale na hora sem remontar 700 mil linhas.
   */
  categoryByProduct: Map<number, string>;
  /** o cadastro de controle de estoque foi lido e tem itens */
  hasStockControl: boolean;
}
