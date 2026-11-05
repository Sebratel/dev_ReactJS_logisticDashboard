import { StackedBars } from '../../components/charts/StackedBars';
import { FilterBar, type FilterField } from '../../components/filters/FilterBar';
import { PackingOverview } from '../../components/packing/PackingOverview';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { RankingTable } from '../../components/tables/RankingTable';
import { ExportButton } from '../../components/ui/ExportButton';
import { ErrorBanner, Loading } from '../../components/ui/States';
import { Visual } from '../../components/ui/Visual';
import { useReport } from '../../hooks/useReport';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import type { PatrimonyPackingDetail } from '../../services/types';
import { int, labelDateTime } from '../../utils/format';

const FIELDS: FilterField[] = [
  { type: 'period', label: 'Data do consumo' },
  { type: 'list', key: 'productCode', label: 'Código patrimônio' },
  { type: 'list', key: 'product', label: 'Produto' },
  { type: 'list', key: 'base', label: 'Base' },
  { type: 'list', key: 'supplier', label: 'Fornecedor' },
  { type: 'list', key: 'receiver', label: 'Recebedor' },
  { type: 'list', key: 'active', label: 'Colaborador ativo?' },
];

const DETAIL_COLUMNS: Column<PatrimonyPackingDetail>[] = [
  { key: 'packingNumber', title: 'ROMANEIO', value: (r) => r.packingNumber, align: 'center' },
  { key: 'movedAt', title: 'DATA', value: (r) => r.movedAt, render: (r) => labelDateTime(r.movedAt), align: 'center' },
  { key: 'productCode', title: 'CÓDIGO', value: (r) => r.productCode, align: 'center' },
  { key: 'description', title: 'DESCRIÇÃO', value: (r) => r.description, wrap: true },
  { key: 'patrimonyTag', title: 'PATRIMÔNIO', value: (r) => r.patrimonyTag, align: 'center' },
  { key: 'serialNumber', title: 'SERIAL', value: (r) => r.serialNumber, align: 'center' },
  { key: 'supplier', title: 'FORNECEDOR', value: (r) => r.supplier },
  { key: 'receiver', title: 'RECEBEDOR', value: (r) => r.receiver, wrap: true },
  { key: 'base', title: 'BASE DE ORIGEM', value: (r) => r.base },
];

/** "PATRIMÔNIOS - ROMANEIO": consumo de patrimônios enviados em romaneio pelo almoxarifado. */
export default function PatrimonyPackingListsPage() {
  const filters = useUrlFilters();
  const { data, error, isPending } = useReport('patrimony-packing-lists', filters.query);

  return (
    <main className="page">
      <FilterBar fields={FIELDS} filters={filters} options={data?.options} />
      {error && <ErrorBanner error={error} />}
      {isPending && !data && <Loading text="Carregando romaneios de patrimônio…" />}
      {data && (
        <>
          <PackingOverview
            kpis={data.kpis}
            monthly={data.monthly}
            daily={data.daily}
            byProduct={data.byProduct}
            itemLabel="patrimônio"
            totalLabel="TOTAL ENVIADO EM ROMANEIO"
          />
          <Visual
            title="Relatório de romaneio"
            subtitle={data.detail.truncated ? `${int(data.detail.rows.length)} de ${int(data.detail.total)} itens na tela — o CSV leva todos` : `${int(data.detail.total)} itens`}
            className="v-tabela"
            flush
            actions={<ExportButton report="patrimony-packing-lists" table="detail" query={filters.query} />}
          >
            <DataTable columns={DETAIL_COLUMNS} rows={data.detail.rows} total={data.detail.total} rowKey={(r, i) => `${r.packingNumber}|${r.patrimonyTag}|${i}`} />
          </Visual>
          <div className="grid linha-70-25">
            <Visual
              title="Romaneio de patrimônios"
              subtitle={`Itens por código e base de origem${data.stacked.others ? ` · 25 maiores (+${data.stacked.others} códigos)` : ''} · clique para filtrar`}
              className="v-tabela"
            >
              <StackedBars data={data.stacked} onSelect={(k) => filters.toggle('productCode', k)} selected={filters.getList('productCode')} />
            </Visual>
            <Visual title="Qtd enviada em romaneio para:" className="v-tabela" flush>
              <RankingTable
                label="RECEBEDOR"
                data={data.byReceiver}
                onSelect={(k) => filters.toggle('receiver', k)}
                selected={filters.getList('receiver')}
              />
            </Visual>
          </div>
        </>
      )}
    </main>
  );
}
