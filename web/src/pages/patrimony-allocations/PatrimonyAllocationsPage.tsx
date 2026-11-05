import { FilterBar, type FilterField } from '../../components/filters/FilterBar';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { RankingTable } from '../../components/tables/RankingTable';
import { ExportButton } from '../../components/ui/ExportButton';
import { ErrorBanner, Loading } from '../../components/ui/States';
import { Visual } from '../../components/ui/Visual';
import { useReport } from '../../hooks/useReport';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import type { PatrimonyAllocationDetail } from '../../services/types';
import { int, labelDate, labelDateTime } from '../../utils/format';

const FIELDS: FilterField[] = [
  { type: 'period', label: 'Data do consumo' },
  { type: 'search', key: 'patrimonyTag', label: 'Patrimônio' },
  { type: 'list', key: 'equipment', label: 'Equipamento' },
  { type: 'search', key: 'serialNumber', label: 'Serial' },
  { type: 'list', key: 'allocatedBy', label: 'Último responsável (de)' },
  { type: 'search', key: 'currentHolder', label: 'Responsável atual (para)' },
  { type: 'search', key: 'protocolNumber', label: 'Nº protocolo' },
  { type: 'list', key: 'returned', label: 'Retorno?' },
];

const DETAIL_COLUMNS: Column<PatrimonyAllocationDetail>[] = [
  { key: 'equipment', title: 'PRODUTO', value: (r) => r.equipment, wrap: true },
  { key: 'patrimonyTag', title: 'PATRIMÔNIO', value: (r) => r.patrimonyTag, align: 'center' },
  { key: 'serialNumber', title: 'SERIAL', value: (r) => r.serialNumber, align: 'center' },
  { key: 'protocolNumber', title: 'Nº PROTOCOLO', value: (r) => r.protocolNumber, align: 'center' },
  { key: 'outAt', title: 'DATA/ HORA', value: (r) => r.outAt, render: (r) => labelDateTime(r.outAt), align: 'center' },
  { key: 'allocatedBy', title: 'ÚLTIMO RESPONSÁVEL (DE)', value: (r) => r.allocatedBy, wrap: true },
  { key: 'currentHolder', title: 'RESPONSÁVEL ATUAL (PARA)', value: (r) => r.currentHolder, wrap: true },
  { key: 'returned', title: 'RETORNO?', value: (r) => r.returned, align: 'center' },
  { key: 'returnedDate', title: 'DATA RETORNO', value: (r) => r.returnedDate, render: (r) => (r.returnedDate ? labelDate(r.returnedDate) : ''), align: 'center' },
  { key: 'city', title: 'CIDADE', value: (r) => r.city },
  { key: 'site', title: 'SITE', value: (r) => r.site },
];

/** "PATRIMÔNIOS - ALOCAÇÃO": rastreabilidade de cada patrimônio que saiu em atendimento. */
export default function PatrimonyAllocationsPage() {
  const filters = useUrlFilters();
  const { data, error, isPending } = useReport('patrimony-allocations', filters.query);

  return (
    <main className="page">
      <FilterBar fields={FIELDS} filters={filters} options={data?.options} />
      {error && <ErrorBanner error={error} />}
      {isPending && !data && <Loading text="Carregando alocações de patrimônio…" />}
      {data && (
        <>
          <Visual
            title="Histórico por patrimônio"
            subtitle={data.detail.truncated ? `${int(data.detail.rows.length)} de ${int(data.detail.total)} movimentos na tela — o CSV leva todos` : `${int(data.detail.total)} movimentos`}
            className="v-tabela"
            flush
            actions={<ExportButton report="patrimony-allocations" table="detail" query={filters.query} />}
          >
            <DataTable columns={DETAIL_COLUMNS} rows={data.detail.rows} total={data.detail.total} rowKey={(r, i) => `${r.patrimonyTag}|${r.outAt}|${i}`} />
          </Visual>
          <div className="grid linha-50-50">
            <Visual title="Movimentos dos itens" subtitle="saídas por equipamento · clique para filtrar" className="v-tabela" flush>
              <RankingTable
                label="EQUIPAMENTO"
                data={data.byEquipment}
                onSelect={(k) => filters.toggle('equipment', k)}
                selected={filters.getList('equipment')}
              />
            </Visual>
            <Visual title="Movimentos dos patrimônios" subtitle="os 500 patrimônios que mais saíram no recorte" className="v-tabela" flush>
              <DataTable
                columns={[
                  { key: 'patrimonyTag', title: 'PATRIMÔNIO', value: (r) => r.patrimonyTag, align: 'center' },
                  { key: 'equipment', title: 'EQUIPAMENTO', value: (r) => r.equipment, wrap: true },
                  { key: 'total', title: 'QTD', value: (r) => r.total, databar: true },
                ]}
                rows={data.byPatrimony}
                rowKey={(r) => `${r.patrimonyTag}|${r.equipment}`}
                onRowClick={(r) => filters.setValues({ patrimonyTag: filters.getValue('patrimonyTag') === r.patrimonyTag ? undefined : r.patrimonyTag })}
                isSelected={(r) => filters.getValue('patrimonyTag') === r.patrimonyTag}
              />
            </Visual>
          </div>
        </>
      )}
    </main>
  );
}
