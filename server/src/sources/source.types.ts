/**
 * Formato das linhas como chegam das consultas (nomes das colunas = aliases
 * dos arquivos .sql). O modelo converte isto nas tabelas de `model.types.ts`.
 */

export interface StockBalanceSourceRow {
  product_code: string | null;
  product_id: number;
  product_title: string;
  base_name: string | null;
  available_units: number | null;
  minimum_inventory: number | null;
  item_type: 'PRODUCT' | 'PATRIMONY';
  /** service_products.active / .deleted */
  is_active: boolean | null;
  is_deleted: boolean | null;
}

export interface PurchaseRequestSourceRow {
  request_id: number;
  product_code: string | null;
  product_title: string | null;
  request_date: string | null;
  requested_by: string | null;
  expected_date: string | null;
  units: number | null;
  observation: string | null;
  base_name: string;
}

export interface PendingPatrimonySourceRow {
  invoice_number: number | string | null;
  entry_date: string | null;
  product_code: string | null;
  product_title: string | null;
  total_units: number | null;
  pending_units: number | null;
  base_name: string | null;
}

export interface UserSourceRow {
  name: string;
  active: boolean | null;
}

export interface ProductAllocationSourceRow {
  allocation_id: number;
  technician: string | null;
  product_code: string | null;
  product_title: string | null;
  allocated_units: number | null;
  unit_measure: string | null;
  invoice_number: number | string | null;
  created_at: string | null;
  issue_date: string | null;
  protocol_number: string | null;
  region: string | null;
}

export interface PatrimonyAllocationSourceRow {
  protocol_number: number | string | null;
  equipment: string | null;
  patrimony_tag: string | null;
  serial_number: string | null;
  out_at: string | null;
  returned: number | boolean | null;
  returned_date: string | null;
  allocated_by: string | null;
  current_holder: string | null;
  site: string | null;
  city: string | null;
}

export interface ProductPackingSourceRow {
  movement_id: number;
  document_number: number | string | null;
  units: number | null;
  product_code: string | null;
  product_id: number | null;
  product_title: string | null;
  base_name: string | null;
  created_at: string | null;
  receiver: string | null;
  supplier: string | null;
}

export interface PatrimonyPackingSourceRow {
  moved_at: string | null;
  product_code: string | null;
  product_title: string | null;
  base_name: string | null;
  patrimony_id: number | null;
  serial_number: string | null;
  patrimony_tag: string | null;
  packing_number: string | null;
  supplier: string | null;
  receiver: string | null;
}

export interface PatrimonyStatusSourceRow {
  product_id: number | null;
  product_code: string | null;
  product_title: string | null;
  patrimony_title: string | null;
  responsible: string | null;
  base_name: string | null;
  patrimony_id: number;
  serial_number: string | null;
  patrimony_tag: string | null;
  /** patrimonies.active / .deleted */
  is_active: boolean | null;
  is_deleted: boolean | null;
  current_status: string;
}

export interface PatrimonyPackingNoteSourceRow {
  responsible: string | null;
  created_at: string | null;
  holder: string | null;
  occurrence_id: number;
  patrimony_id: number | null;
  serial_number: string | null;
  patrimony_tag: string | null;
  description: string | null;
  moved_date: string | null;
  received_by: string | null;
}

/** "Produtos" do CMP — saldo somado por produto e base. */
export interface ItemBalanceSourceRow {
  product_code: string | null;
  product_title: string;
  base_name: string | null;
  available_units: number | null;
  unit_measure: string | null;
  updates_stock: boolean | null;
  generates_patrimony: boolean | null;
}

/** "Pedido de Compra" do CMP — um item de pedido de aquisição. */
export interface PurchaseOrderItemSourceRow {
  order_id: number;
  order_date: string | null;
  expected_date: string | null;
  supplier: string | null;
  requested_by: string | null;
  status_code: number | null;
  deleted: boolean | null;
  order_total: number | null;
  base_name: string | null;
  item_id: number | null;
  product_code: string | null;
  product_title: string | null;
  unit_measure: string | null;
  units: number | null;
  unit_amount: number | null;
  item_amount: number | null;
  total_amount: number | null;
  updates_stock: boolean | null;
  generates_patrimony: boolean | null;
}

/** "PRIMEIRO VÍNCULO" e "ÚLTIMO VÍNCULO" do CTR — uma saída de equipamento para campo. */
export interface FieldEquipmentSourceRow {
  patrimony_id: number;
  created_at: string;
  equipment: string | null;
  description: string | null;
}

/** "DASH_ATUAL_TECNICOS" do Power BI "Objetos em Carga" — patrimônio com um responsável. */
export interface ChargedPatrimonySourceRow {
  patrimony_id: number;
  patrimony_tag: string | null;
  serial_number: string | null;
  description: string | null;
  product_code: string | null;
  item_value: number | null;
  holder: string;
  holder_city: string | null;
  moved_at: string | null;
  /** patrimonies.active / .deleted */
  is_active: boolean | null;
  is_deleted: boolean | null;
}

/** "DASH_ATUAL_CONSUMOS" do Power BI "Objetos em Carga" — saldo de produto com uma pessoa. */
export interface ChargedProductSourceRow {
  holder: string | null;
  holder_city: string | null;
  product_code: string | null;
  description: string | null;
  balance: number | null;
  unit_measure: string | null;
  unit_value: number | null;
  movement_id: number | null;
  /** service_products.active / .deleted */
  is_active: boolean | null;
  is_deleted: boolean | null;
}

export interface SeniorCollaboratorSourceRow {
  name: string;
  registration: number | null;
  operational_base: string | null;
  team: string | null;
}

// ------------------------------------------------------------------ gerencial (Power BI "LOG - Gerencial")

/** "OBJETOS CRIADOS": patrimônios criados por dia. */
export interface CreatedObjectsSourceRow {
  day: string;
  objects: number;
}

/** "Consumo Voalle" (página CONSUMO DE FLAT): metros de flat por dia, recebedor e quem entregou. */
export interface FlatConsumptionSourceRow {
  day: string;
  receiver: string | null;
  supplier: string | null;
  units: number | null;
}

/** "PRIMEIRO VÍNCULO": ONUs ZTE novas (primeiro romaneio) por dia. */
export interface ZteDispatchSourceRow {
  day: string;
  dispatches: number;
}

/** "ÚLTIMO VÍNCULO" + "USADOS CLASSIFICADO": voltas do laboratório ao almoxarifado por dia, modelo e origem. */
export interface ZteReturnSourceRow {
  day: string;
  model: string;
  origin: string;
  returns: number;
}

/** "EQUIPAMENTO OBSOLETOS": primeira data de cada serial sob o depósito de rádio. */
export interface ObsoleteEquipmentSourceRow {
  serial_number: string | null;
  first_day: string | null;
}

/** "QuantidadeRomaneios": patrimônios enviados em romaneio por quem lançou, mês e romaneio. */
export interface PackingProductivitySourceRow {
  name: string | null;
  month: string;
  description: string | null;
  patrimonies: number;
}

// ------------------------------------------------------------------ laboratório (Power BI "LAB - Produtividade Laboratório")

/** "general": um evento do patrimônio no laboratório — as colunas da consulta original. */
export interface LabEventSourceRow {
  data_movimento: string;
  data: string;
  tipo_evento: string;
  motivo_entrada: string | null;
  laboratorio_entrada: string | null;
  base_lab: string | null;
  almoxarifado: string | null;
  motivo: string | null;
  patrimonio_id: number;
  patrimonio: string | null;
  serial: string | null;
  produto_codigo: string | null;
  produto_titulo: string | null;
  base_descricao: string | null;
  ciclo: number | string;
  data_entrada_ciclo: string | null;
  dias_no_laboratorio: number | string | null;
  nota_romaneio: string | null;
  fornecedor: string | null;
}

/** "backlog": patrimônio no laboratório agora, sem saída registrada — as colunas da consulta original. */
export interface LabBacklogSourceRow {
  patrimony_id: number;
  laboratorio_atual: string | null;
  data_entrada_lab: string | null;
  dias_em_aberto: number | string | null;
  status_backlog_90: string | null;
}
