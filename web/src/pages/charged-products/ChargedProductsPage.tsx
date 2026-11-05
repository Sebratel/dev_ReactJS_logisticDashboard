import { ChargedOverview } from '../../components/charged/ChargedOverview';
import { FilterBar, type FilterField } from '../../components/filters/FilterBar';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { ExportButton } from '../../components/ui/ExportButton';
import { ErrorBanner, Loading } from '../../components/ui/States';
import { Visual } from '../../components/ui/Visual';
import { useReport } from '../../hooks/useReport';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import type { ChargedProductRow } from '../../services/types';
import { int } from '../../utils/format';

/** Os slicers da página "SALDO PRODUTO", na ordem do relatório. */
const FIELDS: FilterField[] = [
  { type: 'list', key: 'base', label: 'Base' },
  { type: 'list', key: 'description', label: 'Descrição' },
  { type: 'list', key: 'holder', label: 'Responsável' },
  // "ATIVO?" do Power BI: o responsável é usuário ativo do Voalle
  { type: 'list', key: 'active', label: 'Colaborador ativo?' },
  // cadastro do produto no Voalle (sp.active / sp.deleted)
  { type: 'list', key: 'itemActive', label: 'Produto ativo?' },
  { type: 'list', key: 'itemDeleted', label: 'Produto deletado?' },
];

const DETAIL_COLUMNS: Column<ChargedProductRow>[] = [
  { key: 'holder', title: 'TÉCNICO', value: (r) => r.holder, wrap: true },
  { key: 'base', title: 'BASE', value: (r) => r.base },
  { key: 'productCode', title: 'CÓDIGO', value: (r) => r.productCode, align: 'center' },
  { key: 'description', title: 'DESCRIÇÃO', value: (r) => r.description, wrap: true },
  { key: 'quantity', title: 'QUANTIDADE', value: (r) => r.quantity, align: 'center' },
  { key: 'unitMeasure', title: 'UNIDADE DE MEDIDA', value: (r) => r.unitMeasure },
];

/**
 * "LOG - OBJETOS EM CARGA" · SALDO PRODUTO: o saldo de produtos e cabos com
 * cada pessoa da empresa — produtos distintos, valor (quantidade x preço
 * unitário) e a quantidade por base.
 */
export default function ChargedProductsPage() {
  const filters = useUrlFilters();
  const { data, error, isPending } = useReport('charged-products', filters.query);

  return (
    <main className="page">
      <FilterBar fields={FIELDS} filters={filters} options={data?.options} />
      {error && <ErrorBanner error={error} />}
      {isPending && !data && <Loading text="Carregando os produtos em carga…" />}
      {data && (
        <>
          <ChargedOverview
            filters={filters}
            byHolder={data.byHolder}
            kpis={data.kpis}
            byBase={data.byBase}
            quantityMeaning="produtos distintos"
            baseValueLabel="QUANTIDADE"
            valueMeaning="quantidade x preço unitário"
          />
          <Visual
            title="Visão geral"
            subtitle={data.detail.truncated
              ? `${int(data.detail.rows.length)} de ${int(data.detail.total)} linhas na tela — o CSV leva todas`
              : `${int(data.detail.total)} linhas · saldo somado por pessoa e produto`}
            className="v-tabela"
            flush
            actions={<ExportButton report="charged-products" table="detail" query={filters.query} />}
          >
            <DataTable
              columns={DETAIL_COLUMNS}
              rows={data.detail.rows}
              total={data.detail.total}
              rowKey={(r, i) => `${r.holder}|${r.productCode ?? '-'}|${r.unitMeasure ?? '-'}|${i}`}
            />
          </Visual>
        </>
      )}
    </main>
  );
}
