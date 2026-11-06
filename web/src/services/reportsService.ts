import { fileNameFrom, saveBlob } from '../utils/download';
import { todayIso } from '../utils/format';
import { getData, httpClient, toApiError } from './httpClient';
import type {
  ChargedPatrimoniesReport, ChargedProductsReport, ComparisonReport, LabMovementsReport, ProductivityReport, FieldEquipmentReport, PatrimonyAllocationReport, PatrimonyPackingReport, PatrimonyStockAlertReport, ProductAllocationReport,
  ProductPackingReport, PurchaseOrdersReport, StockAlertReport,
} from './types';

/** Os relatórios (um endpoint por tela) e o tipo de cada resposta. */
export interface ReportMap {
  'product-stock-alerts': StockAlertReport;
  'patrimony-stock-alerts': PatrimonyStockAlertReport;
  'patrimony-packing-lists': PatrimonyPackingReport;
  'patrimony-allocations': PatrimonyAllocationReport;
  'product-packing-lists': ProductPackingReport;
  'product-allocations': ProductAllocationReport;
  'purchase-orders': PurchaseOrdersReport;
  'field-equipment': FieldEquipmentReport;
  'charged-patrimonies': ChargedPatrimoniesReport;
  'charged-products': ChargedProductsReport;
  'lab-movements': LabMovementsReport;
  // seção Gerencial (/management-reports: só quem tem acesso)
  'created-objects': ComparisonReport;
  'flat-consumption': ComparisonReport;
  'zte-movements': ComparisonReport;
  'zte-used': ComparisonReport;
  'obsolete-equipment': ComparisonReport;
  'warehouse-productivity': ProductivityReport;
}
export type ReportName = keyof ReportMap;

const MANAGEMENT_REPORTS: ReadonlySet<ReportName> = new Set<ReportName>([
  'created-objects', 'flat-consumption', 'zte-movements', 'zte-used', 'obsolete-equipment', 'warehouse-productivity',
]);
const reportPath = (name: ReportName) => `${MANAGEMENT_REPORTS.has(name) ? '/management-reports' : '/reports'}/${name}`;

export type ReportQuery = Record<string, string | string[]>;

export const reportKeys = {
  /** todas as consultas de uma tela, com qualquer filtro */
  all: (name: ReportName) => ['reports', name] as const,
  report: (name: ReportName, query: ReportQuery) => ['reports', name, query] as const,
};

export function fetchReport<N extends ReportName>(name: N, query: ReportQuery, signal?: AbortSignal): Promise<ReportMap[N]> {
  return getData<ReportMap[N]>(reportPath(name), query, signal);
}

/** Exportação completa (CSV gerado no servidor com os mesmos filtros da tela). */
export async function downloadReportExport(name: ReportName, table: string, query: ReportQuery): Promise<void> {
  try {
    const response = await httpClient.get<Blob>(`/reports/${name}/exports/${table}`, { params: query, responseType: 'blob' });
    const disposition = response.headers['content-disposition'] as string | undefined;
    saveBlob(fileNameFrom(disposition, `${name}-${table}_${todayIso()}.csv`), response.data);
  } catch (err) {
    throw toApiError(err);
  }
}
