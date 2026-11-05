/**
 * Contratos da API (espelham os retornos dos serviços do servidor).
 */

export interface KeyValue {
  key: string;
  value: number;
}

export interface LimitedRows<T> {
  rows: T[];
  total: number;
  truncated: boolean;
}

export type FilterOptions = Record<string, string[]>;

/** Permissões (tela de Administração): Padrão < Edição < Admin. */
export type UserRole = 'VIEWER' | 'EDITOR' | 'ADMIN';
export const ROLE_LABELS: Record<UserRole, string> = { VIEWER: 'Padrão', EDITOR: 'Edição', ADMIN: 'Admin' };
export const ROLE_ORDER: UserRole[] = ['VIEWER', 'EDITOR', 'ADMIN'];

export interface SessionUser {
  email: string;
  name: string;
  picture: string | null;
  role: UserRole;
  /** vê a seção Gerencial (admin sempre vê) */
  managementAccess: boolean;
}

export interface AuthConfig {
  enabled: boolean;
  clientId: string;
  allowedDomain: string;
}

export interface SourceInfo {
  key: string;
  label: string;
  origin: 'VOALLE' | 'MARIADB' | 'APP';
  rows: number | null;
  durationMs: number | null;
  updatedAt: string | null;
  failed: boolean;
  /** de quanto em quanto tempo a fonte é relida (null: cadastro do app, muda na hora) */
  intervalMs: number | null;
}

export interface DataSourcesState {
  builtAt: string | null;
  /** leitura bem-sucedida mais antiga entre as fontes — a idade real do dado */
  dataAsOf: string | null;
  modelVersion: number;
  /** o cadastro de controle de estoque foi lido e tem itens */
  stockControlAvailable: boolean;
  refresh: { running: boolean; lastStartedAt: string | null; nextRunAt: string | null; intervalMs: number };
  /** carga ao vivo da tela de Compras (a cada minuto); `version` muda só quando o dado mudou */
  live: { running: boolean; lastStartedAt: string | null; nextRunAt: string | null; intervalMs: number; version: number };
  sources: SourceInfo[];
}

// ------------------------------------------------------------ alerta de estoque

export interface StockAlertRow {
  productCode: string;
  description: string;
  category: string | null;
  base: string | null;
  units: number;
  alertLevel: number | null;
  minimumLevel: number | null;
  transferQty: number;
  purchaseStatus: string | null;
  expectedDate: string | null;
  purchaseUnits: number | null;
  leadTimeDays: number | null;
  buyer: string | null;
  externalProcess: string | null;
  status: 'MÍNIMO' | 'ALERTA' | 'ACIMA';
}

export interface StockAlertReport {
  options: FilterOptions;
  stockControlAvailable: boolean;
  kpis: { alertItems: number; minimumItems: number; availableUnits: number };
  table: LimitedRows<StockAlertRow>;
}

export interface PatrimonyStatusDetail {
  generalStatus: string;
  currentStatus: string;
  patrimonyTag: string | null;
  serialNumber: string | null;
  base: string | null;
  responsible: string | null;
  team: string | null;
}

export interface PendingRow {
  invoiceNumber: string | null;
  entryDate: string | null;
  productCode: string | null;
  description: string | null;
  base: string | null;
  totalUnits: number;
  pendingUnits: number;
}

export interface PackingNote {
  createdAt: string | null;
  responsible: string | null;
  receivedBy: string | null;
  description: string | null;
  patrimonyTag: string | null;
  serialNumber: string | null;
}

export interface PatrimonyStockAlertReport extends Omit<StockAlertReport, 'kpis'> {
  kpis: StockAlertReport['kpis'] & { pendingUnits: number; availablePlusPending: number };
  statuses: {
    options: FilterOptions;
    total: number;
    byGeneralStatus: KeyValue[];
    byCurrentStatus: KeyValue[];
    byBase: KeyValue[];
    byProduct: KeyValue[];
    byTeam: KeyValue[];
    byResponsible: { responsible: string; team: string | null; total: number }[];
    detail: LimitedRows<PatrimonyStatusDetail>;
  };
  pending: PendingRow[];
  packingHistory: LimitedRows<PackingNote>;
}

// ------------------------------------------------------------ romaneios

export interface PackingKpis {
  total: number;
  monthlyAverage: number;
  threeMonthAverage: number;
  packings: number;
  monthlyPackings: number;
}

export interface PackingProductRow extends PackingKpis {
  productCode: string | null;
  description: string | null;
}

export interface StackedSeries {
  points: { key: string; total: number; series: Record<string, number> }[];
  series: string[];
  others: number;
}

interface PackingPanel {
  options: FilterOptions;
  kpis: PackingKpis;
  byProduct: PackingProductRow[];
  monthly: KeyValue[];
  daily: { points: KeyValue[]; from: string | null; to: string | null };
}

export interface ProductPackingDetail {
  documentNumber: string | null;
  date: string | null;
  productCode: string | null;
  description: string | null;
  supplier: string | null;
  receiver: string | null;
  units: number;
  base: string | null;
}

export interface ProductPackingReport extends PackingPanel {
  cables: { stacked: StackedSeries; byReceiver: KeyValue[] };
  products: { stacked: StackedSeries; byReceiver: KeyValue[] };
  detail: LimitedRows<ProductPackingDetail>;
}

export interface PatrimonyPackingDetail {
  packingNumber: string | null;
  movedAt: string | null;
  productCode: string | null;
  description: string | null;
  patrimonyTag: string | null;
  serialNumber: string | null;
  supplier: string | null;
  receiver: string | null;
  base: string | null;
}

export interface PatrimonyPackingReport extends PackingPanel {
  stacked: StackedSeries;
  byReceiver: KeyValue[];
  detail: LimitedRows<PatrimonyPackingDetail>;
}

// ------------------------------------------------------------ alocações

export interface ProductAllocationDetail {
  createdAt: string | null;
  protocolNumber: string | null;
  invoiceNumber: string | null;
  technician: string | null;
  baseGroup: string;
  category: string | null;
  productCode: string | null;
  product: string | null;
  units: number;
  unitMeasure: string | null;
}

export interface ProductAllocationReport {
  options: FilterOptions;
  totals: { units: number; cableUnits: number; rows: number };
  products: { stacked: StackedSeries; byTechnician: KeyValue[] };
  cables: { stacked: StackedSeries; byTechnician: KeyValue[] };
  detail: LimitedRows<ProductAllocationDetail>;
}

export interface PatrimonyAllocationDetail {
  equipment: string | null;
  patrimonyTag: string | null;
  serialNumber: string | null;
  protocolNumber: string | null;
  outAt: string | null;
  allocatedBy: string | null;
  currentHolder: string | null;
  returned: string;
  returnedDate: string | null;
  city: string | null;
  site: string | null;
}

export interface PatrimonyAllocationReport {
  options: FilterOptions;
  total: number;
  byEquipment: KeyValue[];
  byPatrimony: { patrimonyTag: string; equipment: string; total: number }[];
  detail: LimitedRows<PatrimonyAllocationDetail>;
}

// ------------------------------------------------------------ compras · lançamento e saldos

export interface ItemBalanceRow {
  productCode: string | null;
  item: string;
  base: string | null;
  units: number;
  unitMeasure: string | null;
  updatesStock: string | null;
  generatesPatrimony: string | null;
}

export interface PurchaseOrderSummaryRow {
  orderNumber: number;
  date: string | null;
  expectedDate: string | null;
  supplier: string | null;
  status: string | null;
  base: string | null;
}

export interface PurchaseOrderItemRow {
  key: string;
  orderNumber: number;
  date: string | null;
  expectedDate: string | null;
  supplier: string | null;
  status: string | null;
  base: string | null;
  productCode: string | null;
  description: string | null;
  unitMeasure: string | null;
  units: number | null;
  updatesStock: string | null;
  generatesPatrimony: string | null;
  unitAmount: number | null;
  orderTotal: number | null;
  totalAmount: number | null;
  requestedBy: string | null;
}

export interface PurchaseOrdersReport {
  options: FilterOptions;
  /** leitura mais antiga das duas fontes da tela (o "Atualizado:" do Power BI) */
  readAt: string | null;
  /** a linha de total do Power BI só tinha a coluna ".": códigos no saldo, pedidos distintos nas tabelas de pedido */
  balances: LimitedRows<ItemBalanceRow> & { totals: { items: number } };
  orders: LimitedRows<PurchaseOrderSummaryRow> & { totals: { orders: number } };
  items: LimitedRows<PurchaseOrderItemRow> & { totals: { orders: number } };
}

// ------------------------------------------------------------ controle · equipamentos para campo

export interface MatrixColumn {
  key: string;
  label: string;
}

/** Linha de matriz (pivot do Power BI): valor por coluna, total da linha e o nível de baixo. */
export interface MatrixNode {
  key: string;
  label: string;
  values: Record<string, number>;
  total: number;
  children?: MatrixNode[];
}

export interface Matrix {
  columns: MatrixColumn[];
  rows: MatrixNode[];
  totals: Record<string, number>;
  total: number;
}

export interface FieldEquipmentDetailRow {
  count: number;
  date: string;
  equipment: string | null;
  description: string | null;
}

export interface FieldEquipmentReport {
  options: FilterOptions;
  byDate: Matrix;
  pie: KeyValue[];
  byType: Matrix;
  newByMonth: Matrix;
  usedByMonth: Matrix;
  newDaily: Matrix;
  usedDaily: Matrix;
  newDetail: LimitedRows<FieldEquipmentDetailRow> & { totals: { count: number } };
  usedDetail: LimitedRows<FieldEquipmentDetailRow> & { totals: { count: number } };
}

// ------------------------------------------------------------ em carga (saldo por responsável)

export interface HolderRow {
  holder: string;
  /** patrimônios distintos, ou produtos distintos (pela descrição) */
  quantity: number;
  value: number;
}

export interface ChargedPatrimonyRow {
  holder: string;
  base: string;
  productCode: string | null;
  description: string | null;
  serialNumber: string | null;
  patrimonyTag: string | null;
  movedAt: string | null;
  days: number | null;
  value: number | null;
}

export interface ChargedPatrimoniesReport {
  options: FilterOptions;
  kpis: { holders: number; value: number; quantity: number };
  byHolder: { rows: HolderRow[]; totals: { quantity: number; value: number } };
  byBase: KeyValue[];
  detail: LimitedRows<ChargedPatrimonyRow>;
}

export interface ChargedProductRow {
  holder: string;
  base: string;
  productCode: string | null;
  description: string | null;
  quantity: number;
  unitMeasure: string | null;
}

export interface ChargedProductsReport {
  options: FilterOptions;
  kpis: { holders: number; value: number };
  byHolder: { rows: HolderRow[]; totals: { quantity: number; value: number } };
  byBase: KeyValue[];
  detail: LimitedRows<ChargedProductRow>;
}

// ------------------------------------------------------------ cadastro de controle de estoque

/** As bases que o cadastro aceita (mesma lista do servidor). */
export const OPERATIONAL_BASES = [
  'BASE OPERACIONAL - CANOAS',
  'BASE OPERACIONAL - SÃO LEOPOLDO',
  'SEDE - PORTO ALEGRE',
] as const;
export type OperationalBase = (typeof OPERATIONAL_BASES)[number];

/** O que o formulário manda ao servidor (criar e editar mandam o item inteiro). */
export interface StockControlInput {
  code: number;
  category: string;
  item: string | null;
  baseName: OperationalBase;
  alertLevel: number;
  minimumLevel: number;
  /** COMPRADOR RESPONSÁVEL */
  buyer: string | null;
  leadTimeDays: number | null;
  externalProcess: string | null;
}

export interface StockControl extends Omit<StockControlInput, 'baseName'> {
  id: string;
  baseName: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  /** o produto nessa base no saldo do Voalle (última carga); null = não aparece no saldo */
  voalle: { description: string; units: number; status: StockAlertRow['status'] } | null;
}

export interface StockControlList {
  items: StockControl[];
  total: number;
  limit: number;
  updatedAt: string | null;
}

export interface ProductLookup {
  code: number;
  productCode: string;
  description: string;
  itemType: 'PRODUCT' | 'PATRIMONY';
  bases: { baseName: string; units: number }[];
}

// ------------------------------------------------------------ administração

export interface AdminUser {
  email: string;
  name: string;
  picture: string | null;
  role: UserRole;
  firstSeenAt: string;
  lastSeenAt: string;
  lastLoginAt: string | null;
  online: boolean;
  /** vê a seção Gerencial (para admin é sempre true) */
  managementAccess: boolean;
}

export interface AdminUserList {
  users: AdminUser[];
  total: number;
  online: number;
}

export type AuditAction =
  | 'stock-control.create'
  | 'stock-control.update'
  | 'stock-control.delete'
  | 'user.role.update'
  | 'user.management-access.update'
  | 'productivity-staff.update'
  | 'data-sources.refresh';

export interface AuditChange {
  field: string;
  from: string | number | null;
  to: string | number | null;
}

export interface AuditEvent {
  id: string;
  at: string;
  email: string;
  name: string;
  action: AuditAction;
  target: string | null;
  changes: AuditChange[];
}

// ------------------------------------------------------------------ gerencial (Power BI "LOG - Gerencial")

export type ComparisonKind = 'months' | 'monthsYearAgo' | 'quarters' | 'quartersYearAgo' | 'years';

export interface SeriesDefinition {
  key: string;
  label: string;
}

export interface PeriodValues {
  key: string;
  label: string;
  total: number;
  values: Record<string, number>;
}

export interface Comparison {
  previous: PeriodValues;
  current: PeriodValues;
  change: number | null;
  shares?: {
    previous: Record<string, number | null>;
    current: Record<string, number | null>;
    change: Record<string, number | null>;
  };
}

export interface ComparisonReport {
  series: SeriesDefinition[];
  comparisons: Record<ComparisonKind, Comparison>;
  history: PeriodValues[];
}

export interface ProductivityMonth {
  packings: number;
  patrimonies: number;
}

export interface ProductivityPerson {
  name: string;
  months: ProductivityMonth[];
  packingsChange: number | null;
  patrimoniesChange: number | null;
  averagePackings: number;
  averagePatrimonies: number;
}

export interface ProductivityReport {
  months: { key: string; label: string }[];
  people: ProductivityPerson[];
  total: {
    months: ProductivityMonth[];
    packingsChange: number | null;
    patrimoniesChange: number | null;
    averagePackingsPerPerson: number;
    averagePatrimoniesPerPerson: number;
  };
}

export interface ProductivityStaff {
  names: string[];
  updatedAt: string | null;
  updatedBy: string | null;
  candidates: { name: string; patrimonies: number }[];
}
