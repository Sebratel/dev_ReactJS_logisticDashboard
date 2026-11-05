import { FilterBar, type FilterField } from '../../components/filters/FilterBar';
import { ToggleGroup } from '../../components/filters/ToggleGroup';
import { StockAlertSection } from '../../components/stock/StockAlertSection';
import { STOCK_STATUS_OPTIONS } from '../../components/stock/stockStatus';
import { ErrorBanner, Loading } from '../../components/ui/States';
import { useReport } from '../../hooks/useReport';
import { useUrlFilters } from '../../hooks/useUrlFilters';

const FIELDS: FilterField[] = [
  { type: 'list', key: 'productCode', label: 'Código produto' },
  { type: 'list', key: 'category', label: 'Categoria' },
  { type: 'list', key: 'base', label: 'Bases operacionais' },
  { type: 'list', key: 'description', label: 'Item' },
  // cadastro do produto no Voalle (service_products)
  { type: 'list', key: 'active', label: 'Ativo?' },
  { type: 'list', key: 'deleted', label: 'Deletado?' },
];

/** "PRODUTOS - ALERTA ESTOQUE": só produtos do cadastro de controle de estoque (Configuração). */
export default function ProductStockAlertsPage() {
  const filters = useUrlFilters();
  const { data, error, isPending } = useReport('product-stock-alerts', filters.query);

  return (
    <main className="page">
      <FilterBar fields={FIELDS} filters={filters} options={data?.options} extraKeys={[{ key: 'status', label: 'Status' }]}>
        <ToggleGroup
          label="Status do estoque"
          options={STOCK_STATUS_OPTIONS}
          value={filters.getList('status')}
          onChange={(v) => filters.setList('status', v)}
        />
      </FilterBar>
      {error && <ErrorBanner error={error} />}
      {isPending && !data && <Loading text="Carregando o saldo de estoque…" />}
      {data && <StockAlertSection report="product-stock-alerts" data={data} filters={filters} title="Alerta de estoque · produtos" />}
    </main>
  );
}
