import { useState } from 'react';
import { StackedBars } from '../../components/charts/StackedBars';
import { FilterBar, type FilterField } from '../../components/filters/FilterBar';
import { PackingOverview } from '../../components/packing/PackingOverview';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { RankingTable } from '../../components/tables/RankingTable';
import { ExportButton } from '../../components/ui/ExportButton';
import { Segmented } from '../../components/ui/Segmented';
import { ErrorBanner, Loading } from '../../components/ui/States';
import { Visual } from '../../components/ui/Visual';
import { useReport } from '../../hooks/useReport';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import type { ProductPackingDetail } from '../../services/types';
import { int, labelDate } from '../../utils/format';

const FIELDS: FilterField[] = [
  { type: 'period', label: 'Data do consumo' },
  { type: 'list', key: 'productCode', label: 'Código produto' },
  { type: 'list', key: 'product', label: 'Produto' },
  { type: 'list', key: 'base', label: 'Base' },
  { type: 'list', key: 'supplier', label: 'Fornecedor' },
  { type: 'list', key: 'receiver', label: 'Recebedor' },
  { type: 'list', key: 'active', label: 'Colaborador ativo?' },
];

const DETAIL_COLUMNS: Column<ProductPackingDetail>[] = [
  { key: 'documentNumber', title: 'ROMANEIO', value: (r) => r.documentNumber, align: 'center' },
  { key: 'date', title: 'DATA', value: (r) => r.date, render: (r) => labelDate(r.date), align: 'center' },
  { key: 'productCode', title: 'CÓDIGO', value: (r) => r.productCode, align: 'center' },
  { key: 'description', title: 'DESCRIÇÃO', value: (r) => r.description, wrap: true },
  { key: 'supplier', title: 'FORNECEDOR', value: (r) => r.supplier },
  { key: 'receiver', title: 'RECEBEDOR', value: (r) => r.receiver, wrap: true },
  { key: 'units', title: 'QTD', value: (r) => r.units },
  { key: 'base', title: 'BASE DE ORIGEM', value: (r) => r.base },
];

type Kind = 'cables' | 'products';

/** "PRODUTOS & CABOS - ROMANEIO": consumo enviado em romaneio pelo almoxarifado. */
export default function ProductPackingListsPage() {
  const filters = useUrlFilters();
  const { data, error, isPending } = useReport('product-packing-lists', filters.query);
  const [kind, setKind] = useState<Kind>('cables');
  const block = data?.[kind];

  return (
    <main className="page">
      <FilterBar fields={FIELDS} filters={filters} options={data?.options} />
      {error && <ErrorBanner error={error} />}
      {isPending && !data && <Loading text="Carregando romaneios de produtos…" />}
      {data && block && (
        <>
          <PackingOverview
            kpis={data.kpis}
            monthly={data.monthly}
            daily={data.daily}
            byProduct={data.byProduct}
            itemLabel="produto"
            totalLabel="TOTAL ENVIADO EM ROMANEIO"
          />
          <Visual
            title="Relatório de romaneio"
            subtitle={data.detail.truncated ? `${int(data.detail.rows.length)} de ${int(data.detail.total)} linhas na tela — o CSV leva todas` : `${int(data.detail.total)} linhas`}
            className="v-tabela"
            flush
            actions={<ExportButton report="product-packing-lists" table="detail" query={filters.query} />}
          >
            <DataTable columns={DETAIL_COLUMNS} rows={data.detail.rows} total={data.detail.total} rowKey={(r, i) => `${r.documentNumber}|${r.productCode}|${i}`} />
          </Visual>
          <div className="grid linha-70-25">
            <Visual
              title={kind === 'cables' ? 'Romaneio de cabos' : 'Romaneio de produtos'}
              subtitle={`Quantidade por código e base de origem${block.stacked.others ? ` · 25 maiores (+${block.stacked.others} códigos)` : ''} · clique para filtrar`}
              className="v-tabela"
              actions={(
                <Segmented<Kind>
                  value={kind}
                  onChange={setKind}
                  options={[{ id: 'cables', label: 'cabos' }, { id: 'products', label: 'produtos' }]}
                  title="O relatório separa cabos (lista fechada de cabos de fibra/drop) dos demais produtos"
                />
              )}
            >
              <StackedBars data={block.stacked} onSelect={(k) => filters.toggle('productCode', k)} selected={filters.getList('productCode')} />
            </Visual>
            <Visual title="Qtd enviada em romaneio para:" subtitle={kind === 'cables' ? 'cabos' : 'produtos'} className="v-tabela" flush>
              <RankingTable
                label="RECEBEDOR"
                data={block.byReceiver}
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
