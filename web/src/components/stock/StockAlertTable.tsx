import type { StockAlertRow } from '../../services/types';
import { int, labelDate } from '../../utils/format';
import { DataTable, type Column } from '../tables/DataTable';

/**
 * Formatação condicional do relatório: código, categoria, base, descrição e
 * unidades ganham fundo vinho no MÍNIMO e dourado no ALERTA; o status do
 * pedido "Aguardando Entrega" fica dourado.
 */
const statusCell = (row: StockAlertRow): string | undefined => (
  row.status === 'MÍNIMO' ? 'est-minimo' : row.status === 'ALERTA' ? 'est-alerta' : undefined
);

const COLUMNS: Column<StockAlertRow>[] = [
  { key: 'productCode', title: 'CÓDIGO', value: (r) => r.productCode, align: 'center', cellClass: statusCell },
  { key: 'category', title: 'CATEGORIA', value: (r) => r.category, cellClass: statusCell },
  { key: 'base', title: 'BASE', value: (r) => r.base, align: 'center', cellClass: statusCell },
  { key: 'description', title: 'DESCRIÇÃO', value: (r) => r.description, cellClass: statusCell, wrap: true },
  { key: 'units', title: 'UNIDADES', value: (r) => r.units, cellClass: statusCell },
  { key: 'alertLevel', title: 'ALERTA', value: (r) => r.alertLevel, render: (r) => (r.alertLevel === null ? '' : int(r.alertLevel)) },
  { key: 'minimumLevel', title: 'MÍNIMO', value: (r) => r.minimumLevel, render: (r) => (r.minimumLevel === null ? '' : int(r.minimumLevel)) },
  { key: 'transferQty', title: 'A RECEBER', value: (r) => r.transferQty, render: (r) => (r.transferQty ? int(r.transferQty) : '') },
  {
    key: 'purchaseStatus',
    title: 'STATUS',
    value: (r) => r.purchaseStatus,
    align: 'center',
    cellClass: (r) => (r.purchaseStatus === 'Aguardando Entrega' ? 'ped-aguardando' : undefined),
  },
  { key: 'expectedDate', title: 'DATA PREVISÃO', value: (r) => r.expectedDate, render: (r) => (r.expectedDate ? labelDate(r.expectedDate) : ''), align: 'center' },
  { key: 'purchaseUnits', title: 'TOTAL', value: (r) => r.purchaseUnits, render: (r) => (r.purchaseUnits === null ? '' : int(r.purchaseUnits)) },
  {
    key: 'leadTimeDays',
    title: 'LEAD TIME',
    value: (r) => r.leadTimeDays,
    render: (r) => (r.leadTimeDays === null ? '' : `${int(r.leadTimeDays)} dias`),
    align: 'center',
  },
  { key: 'buyer', title: 'COMPRADOR RESPONSÁVEL', value: (r) => r.buyer },
  { key: 'externalProcess', title: 'PROCESSO EXTERNO', value: (r) => r.externalProcess },
];

export function StockAlertTable({ rows, total }: { rows: StockAlertRow[]; total: number }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      total={total}
      rowKey={(r, i) => `${r.productCode}|${r.base ?? ''}|${i}`}
    />
  );
}
