import { useState } from 'react';
import { StackedBars } from '../../components/charts/StackedBars';
import { FilterBar, type FilterField } from '../../components/filters/FilterBar';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { RankingTable } from '../../components/tables/RankingTable';
import { ExportButton } from '../../components/ui/ExportButton';
import { Kpi } from '../../components/ui/Kpi';
import { Segmented } from '../../components/ui/Segmented';
import { ErrorBanner, Loading } from '../../components/ui/States';
import { Visual } from '../../components/ui/Visual';
import { useReport } from '../../hooks/useReport';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import type { ProductAllocationDetail } from '../../services/types';
import { int, labelDateTime } from '../../utils/format';

const FIELDS: FilterField[] = [
  { type: 'period', label: 'Data do consumo' },
  { type: 'list', key: 'productCode', label: 'Código produto' },
  { type: 'list', key: 'product', label: 'Produto' },
  { type: 'list', key: 'category', label: 'Categoria' },
  { type: 'list', key: 'technician', label: 'Responsáveis' },
  { type: 'search', key: 'invoiceNumber', label: 'Nota' },
  { type: 'search', key: 'protocolNumber', label: 'Nº protocolo' },
  { type: 'list', key: 'baseGroup', label: 'Base' },
  { type: 'list', key: 'active', label: 'Técnico ativo?' },
];

const DETAIL_COLUMNS: Column<ProductAllocationDetail>[] = [
  { key: 'createdAt', title: 'ALOCADO EM', value: (r) => r.createdAt, render: (r) => labelDateTime(r.createdAt), align: 'center' },
  { key: 'protocolNumber', title: 'Nº PROTOCOLO', value: (r) => r.protocolNumber, align: 'center' },
  { key: 'invoiceNumber', title: 'NOTA', value: (r) => r.invoiceNumber, align: 'center' },
  { key: 'technician', title: 'TÉCNICO', value: (r) => r.technician, wrap: true },
  { key: 'baseGroup', title: 'BASE', value: (r) => r.baseGroup, align: 'center' },
  { key: 'category', title: 'CATEGORIA', value: (r) => r.category },
  { key: 'productCode', title: 'CÓDIGO', value: (r) => r.productCode, align: 'center' },
  { key: 'product', title: 'PRODUTO', value: (r) => r.product, wrap: true },
  { key: 'units', title: 'QTD', value: (r) => r.units },
  { key: 'unitMeasure', title: 'MEDIDA', value: (r) => r.unitMeasure },
];

type Kind = 'products' | 'cables';

/** "PRODUTOS & CABOS - ALOCAÇÃO": rastreabilidade de produtos e cabos alocados em protocolo. */
export default function ProductAllocationsPage() {
  const filters = useUrlFilters();
  const { data, error, isPending } = useReport('product-allocations', filters.query);
  const [kind, setKind] = useState<Kind>('products');
  const block = data?.[kind];

  return (
    <main className="page">
      <FilterBar fields={FIELDS} filters={filters} options={data?.options} />
      {error && <ErrorBanner error={error} />}
      {isPending && !data && <Loading text="Carregando alocações de produtos…" />}
      {data && block && (
        <>
          <div className="kpi-faixa">
            <Kpi value={int(data.totals.rows)} label="Alocações" description="linhas de produto alocado em protocolo" />
            <Kpi value={int(data.totals.units)} label="Qtd produtos" description="soma das quantidades (sem cabos)" />
            <Kpi value={int(data.totals.cableUnits)} label="Qtd cabos" description="soma das quantidades de cabo (metros)" />
          </div>
          <Visual
            title="Relatório de alocação"
            subtitle={data.detail.truncated ? `${int(data.detail.rows.length)} de ${int(data.detail.total)} linhas na tela — o CSV leva todas` : `${int(data.detail.total)} linhas`}
            className="v-tabela"
            flush
            actions={<ExportButton report="product-allocations" table="detail" query={filters.query} />}
          >
            <DataTable columns={DETAIL_COLUMNS} rows={data.detail.rows} total={data.detail.total} rowKey={(r, i) => `${r.createdAt}|${r.productCode}|${i}`} />
          </Visual>
          <div className="grid linha-65-30">
            <Visual
              title={kind === 'products' ? 'Alocação produtos' : 'Alocação cabos'}
              subtitle={`Quantidade por código e base${block.stacked.others ? ` · 25 maiores (+${block.stacked.others} códigos)` : ''} · clique para filtrar`}
              className="v-tabela"
              actions={(
                <Segmented<Kind>
                  value={kind}
                  onChange={setKind}
                  options={[{ id: 'products', label: 'produtos' }, { id: 'cables', label: 'cabos' }]}
                />
              )}
            >
              <StackedBars data={block.stacked} onSelect={(k) => filters.toggle('productCode', k)} selected={filters.getList('productCode')} />
            </Visual>
            <Visual title={kind === 'products' ? 'Alocação de produtos por:' : 'Alocação de cabos por:'} className="v-tabela" flush>
              <RankingTable
                label="TÉCNICO"
                valueLabel="QTD ALOCADO"
                data={block.byTechnician}
                onSelect={(k) => filters.toggle('technician', k)}
                selected={filters.getList('technician')}
              />
            </Visual>
          </div>
        </>
      )}
    </main>
  );
}
