import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { FilterBar, type FilterField } from '../../components/filters/FilterBar';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { ExportButton } from '../../components/ui/ExportButton';
import { ErrorBanner, Loading } from '../../components/ui/States';
import { Visual } from '../../components/ui/Visual';
import { useDataSources } from '../../hooks/useDataSources';
import { useReport } from '../../hooks/useReport';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { reportKeys } from '../../services/reportsService';
import type { ItemBalanceRow, PurchaseOrderItemRow, PurchaseOrderSummaryRow } from '../../services/types';
import { brl, int, labelDate } from '../../utils/format';
import { purchaseStatusClass, yesClass } from './purchaseStatus';

/** Os dez slicers da página "RECEBIMENTO", na ordem do relatório (código, item e base são do saldo; o resto, do pedido). */
const FIELDS: FilterField[] = [
  { type: 'list', key: 'productCode', label: 'Código' },
  { type: 'list', key: 'item', label: 'Item' },
  { type: 'list', key: 'base', label: 'Base' },
  { type: 'list', key: 'supplier', label: 'Fornecedor' },
  { type: 'list', key: 'status', label: 'Status' },
  { type: 'list', key: 'orderNumber', label: 'Nº pedido' },
  { type: 'list', key: 'requestedBy', label: 'Pessoa' },
  { type: 'list', key: 'updatesStock', label: 'Atualiza estoque?' },
  { type: 'list', key: 'generatesPatrimony', label: 'Gera patrimônio?' },
  { type: 'list', key: 'deleted', label: 'Deletado?' },
];

/**
 * A coluna "." do Power BI, a única com total. No saldo conta os códigos
 * (ITENS); nas tabelas de pedido é a contagem DISTINTA do Nº (PEDIDOS): 1 em
 * cada linha, e o total é o número de pedidos do recorte.
 */
const ITEMS_TITLE = 'ITENS';
const ORDERS_TITLE = 'PEDIDOS';

const BALANCE_COLUMNS: Column<ItemBalanceRow>[] = [
  { key: 'count', title: ITEMS_TITLE, value: (r) => (r.productCode === null ? 0 : 1), align: 'center' },
  { key: 'productCode', title: 'CÓDIGO', value: (r) => r.productCode, align: 'center' },
  { key: 'item', title: 'ITEM', value: (r) => r.item, wrap: true },
  { key: 'base', title: 'BASE', value: (r) => r.base },
  { key: 'units', title: 'QUANTIDADE', value: (r) => r.units },
  { key: 'unitMeasure', title: 'UNIDADE', value: (r) => r.unitMeasure },
  { key: 'updatesStock', title: 'ATUALIZA ESTOQUE', value: (r) => r.updatesStock, align: 'center', cellClass: (r) => yesClass(r.updatesStock) },
  { key: 'generatesPatrimony', title: 'GERA PATRIMÔNIO', value: (r) => r.generatesPatrimony, align: 'center', cellClass: (r) => yesClass(r.generatesPatrimony) },
];

const ORDER_COLUMNS: Column<PurchaseOrderSummaryRow>[] = [
  { key: 'count', title: ORDERS_TITLE, value: () => 1, align: 'center' },
  { key: 'date', title: 'DATA', value: (r) => r.date, render: (r) => labelDate(r.date), align: 'center' },
  { key: 'orderNumber', title: 'Nº PEDIDO', value: (r) => r.orderNumber, render: (r) => r.orderNumber, align: 'center' },
  { key: 'expectedDate', title: 'PREV. ENTREGA', value: (r) => r.expectedDate, render: (r) => labelDate(r.expectedDate), align: 'center' },
  { key: 'supplier', title: 'FORNECEDOR', value: (r) => r.supplier, wrap: true },
  { key: 'status', title: 'STATUS', value: (r) => r.status, align: 'center', cellClass: (r) => purchaseStatusClass(r.status) },
  { key: 'base', title: 'BASE', value: (r) => r.base },
];

const ITEM_COLUMNS: Column<PurchaseOrderItemRow>[] = [
  { key: 'count', title: ORDERS_TITLE, value: () => 1, align: 'center' },
  { key: 'date', title: 'DATA', value: (r) => r.date, render: (r) => labelDate(r.date), align: 'center' },
  { key: 'orderNumber', title: 'Nº PEDIDO', value: (r) => r.orderNumber, render: (r) => r.orderNumber, align: 'center' },
  { key: 'expectedDate', title: 'PREV. ENTREGA', value: (r) => r.expectedDate, render: (r) => labelDate(r.expectedDate), align: 'center' },
  { key: 'supplier', title: 'FORNECEDOR', value: (r) => r.supplier, wrap: true },
  { key: 'status', title: 'STATUS', value: (r) => r.status, align: 'center', cellClass: (r) => purchaseStatusClass(r.status) },
  { key: 'base', title: 'BASE', value: (r) => r.base },
  { key: 'productCode', title: 'CÓDIGO', value: (r) => r.productCode, align: 'center' },
  { key: 'description', title: 'DESCRIÇÃO ITEM', value: (r) => r.description, wrap: true },
  { key: 'unitMeasure', title: 'UNIDADE', value: (r) => r.unitMeasure },
  { key: 'units', title: 'QTD.', value: (r) => r.units, align: 'center' },
  { key: 'updatesStock', title: 'ATUALIZA ESTOQUE', value: (r) => r.updatesStock, align: 'center', cellClass: (r) => yesClass(r.updatesStock) },
  { key: 'generatesPatrimony', title: 'GERA PATRIMÔNIO', value: (r) => r.generatesPatrimony, align: 'center', cellClass: (r) => yesClass(r.generatesPatrimony) },
  { key: 'unitAmount', title: 'VAL. UNITÁRIO', value: (r) => r.unitAmount, render: (r) => brl(r.unitAmount), align: 'center' },
  { key: 'orderTotal', title: 'TOTAL PEDIDO', value: (r) => r.orderTotal, render: (r) => brl(r.orderTotal), align: 'center' },
  { key: 'totalAmount', title: 'TOTAL COM IMPOSTO', value: (r) => r.totalAmount, render: (r) => brl(r.totalAmount), align: 'center' },
  { key: 'requestedBy', title: 'PESSOA', value: (r) => r.requestedBy },
];

/** Versão nova do dado de Compras no servidor -> baixa as tabelas da tela de novo. */
function useReloadOnNewData() {
  const queryClient = useQueryClient();
  const { data: sources } = useDataSources({ fast: true });
  const version = sources?.live.version;
  const seen = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (version === undefined) return;
    // a primeira versão vista é a que a tela acabou de carregar: não precisa baixar de novo
    if (seen.current !== undefined && seen.current !== version) {
      void queryClient.invalidateQueries({ queryKey: reportKeys.all('purchase-orders') });
    }
    seen.current = version;
  }, [version, queryClient]);
}

const shown = (rows: number, total: number, noun: string) => (rows < total
  ? `${int(rows)} de ${int(total)} ${noun} na tela — o CSV leva todas`
  : `${int(total)} ${noun}`);

/**
 * "CMP - LANÇAMENTO E SALDOS" (página RECEBIMENTO): saldo de itens por base e
 * os pedidos de compra lançados no ano, em resumo e item a item. O servidor
 * relê o Voalle a cada minuto; a tela confere a versão do dado a cada 15 s e
 * baixa as tabelas de novo só quando ela muda.
 *
 * Os filtros cruzam as duas tabelas pelo código do item, nos dois sentidos —
 * fornecedor recorta o saldo, base recorta os pedidos — como no Power BI.
 */
export default function PurchaseOrdersPage() {
  const filters = useUrlFilters();
  const { data, error, isPending } = useReport('purchase-orders', filters.query);
  useReloadOnNewData();
  const selectedCodes = filters.getList('productCode');
  const selectedOrders = filters.getList('orderNumber');

  return (
    <main className="page">
      <FilterBar fields={FIELDS} filters={filters} options={data?.options} />
      {error && <ErrorBanner error={error} />}
      {isPending && !data && <Loading text="Carregando saldo e pedidos de compra…" />}
      {data && (
        <>
          <div className="grid linha-50-50">
            <Visual
              title="Saldo de itens"
              subtitle={`${shown(data.balances.rows.length, data.balances.total, 'linhas')} · clique para filtrar pelo código`}
              className="v-tabela"
              flush
              actions={<ExportButton report="purchase-orders" table="balances" query={filters.query} />}
            >
              <DataTable
                columns={BALANCE_COLUMNS}
                rows={data.balances.rows}
                total={data.balances.total}
                rowKey={(r) => `${r.productCode ?? '-'}|${r.base ?? '-'}|${r.item}`}
                footer={{ count: int(data.balances.totals.items), productCode: 'Total' }}
                onRowClick={(r) => { if (r.productCode) filters.toggle('productCode', r.productCode); }}
                isSelected={(r) => r.productCode !== null && selectedCodes.includes(r.productCode)}
              />
            </Visual>
            <Visual
              title="Pedido de compra"
              subtitle={`${shown(data.orders.rows.length, data.orders.total, 'pedidos')} · clique para filtrar pelo pedido`}
              className="v-tabela"
              flush
              actions={<ExportButton report="purchase-orders" table="orders" query={filters.query} />}
            >
              <DataTable
                columns={ORDER_COLUMNS}
                rows={data.orders.rows}
                total={data.orders.total}
                rowKey={(r) => String(r.orderNumber)}
                footer={{ count: int(data.orders.totals.orders), date: 'Total' }}
                onRowClick={(r) => filters.toggle('orderNumber', String(r.orderNumber))}
                isSelected={(r) => selectedOrders.includes(String(r.orderNumber))}
              />
            </Visual>
          </div>
          <Visual
            title="Pedido de compra · itens"
            subtitle={`${shown(data.items.rows.length, data.items.total, 'linhas')} · item repetido igual no mesmo pedido aparece uma vez`}
            className="v-tabela"
            flush
            actions={<ExportButton report="purchase-orders" table="items" query={filters.query} />}
          >
            <DataTable
              columns={ITEM_COLUMNS}
              rows={data.items.rows}
              total={data.items.total}
              rowKey={(r) => r.key}
              footer={{ count: int(data.items.totals.orders), date: 'Total' }}
            />
          </Visual>
        </>
      )}
    </main>
  );
}
