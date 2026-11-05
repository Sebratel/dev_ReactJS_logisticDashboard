import { StatusDonut } from '../../components/charts/StatusDonut';
import { FilterBar, type FilterField } from '../../components/filters/FilterBar';
import { ToggleGroup } from '../../components/filters/ToggleGroup';
import { StockAlertSection } from '../../components/stock/StockAlertSection';
import { patrimonyStatusClass, patrimonyStatusColor } from '../../components/stock/patrimonyStatus';
import { STOCK_STATUS_OPTIONS } from '../../components/stock/stockStatus';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { RankingTable } from '../../components/tables/RankingTable';
import { ExportButton } from '../../components/ui/ExportButton';
import { Kpi } from '../../components/ui/Kpi';
import { ErrorBanner, Loading } from '../../components/ui/States';
import { Visual } from '../../components/ui/Visual';
import { useReport } from '../../hooks/useReport';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import type { PackingNote, PatrimonyStatusDetail, PendingRow } from '../../services/types';
import { int, labelDate, labelDateTime } from '../../utils/format';

const STOCK_FIELDS: FilterField[] = [
  { type: 'list', key: 'productCode', label: 'Código item' },
  { type: 'list', key: 'category', label: 'Categoria' },
  { type: 'list', key: 'base', label: 'Bases operacionais' },
  { type: 'list', key: 'description', label: 'Item' },
];

const STATUS_FIELDS: FilterField[] = [
  { type: 'search', key: 'patrimonyTag', label: 'Patrimônio' },
  { type: 'search', key: 'serialNumber', label: 'Serial' },
  { type: 'list', key: 'statusProduct', label: 'Item' },
  { type: 'list', key: 'statusProductCode', label: 'Código item' },
  { type: 'list', key: 'statusResponsible', label: 'Responsável' },
  { type: 'list', key: 'statusTeam', label: 'Equipe' },
  // cadastro de cada patrimônio no Voalle (p.active / p.deleted)
  { type: 'list', key: 'statusActive', label: 'Ativo?' },
  { type: 'list', key: 'statusDeleted', label: 'Deletado?' },
];

const STATUS_COLUMNS: Column<PatrimonyStatusDetail>[] = [
  { key: 'generalStatus', title: 'STATUS GERAL', value: (r) => r.generalStatus, align: 'center', cellClass: (r) => patrimonyStatusClass(r.generalStatus) },
  { key: 'currentStatus', title: 'STATUS', value: (r) => r.currentStatus, cellClass: (r) => patrimonyStatusClass(r.currentStatus) },
  { key: 'patrimonyTag', title: 'PATRIMÔNIO', value: (r) => r.patrimonyTag, align: 'center' },
  { key: 'serialNumber', title: 'SERIAL', value: (r) => r.serialNumber, align: 'center' },
  { key: 'base', title: 'BASE', value: (r) => r.base },
  { key: 'responsible', title: 'RESPONSÁVEL', value: (r) => r.responsible, wrap: true },
  { key: 'team', title: 'EQUIPE', value: (r) => r.team },
];

const PENDING_COLUMNS: Column<PendingRow>[] = [
  { key: 'invoiceNumber', title: 'NOTA FISCAL', value: (r) => r.invoiceNumber, align: 'center' },
  { key: 'entryDate', title: 'DATA ENTRADA', value: (r) => r.entryDate, render: (r) => labelDate(r.entryDate), align: 'center' },
  { key: 'productCode', title: 'CÓDIGO', value: (r) => r.productCode, align: 'center' },
  { key: 'description', title: 'ITEM', value: (r) => r.description, wrap: true },
  { key: 'base', title: 'BASE OPERACIONAL', value: (r) => r.base },
  { key: 'totalUnits', title: 'TOTAL COMPRADO', value: (r) => r.totalUnits },
  { key: 'pendingUnits', title: 'PENDENTE/ À PATRIMONIAR', value: (r) => r.pendingUnits },
];

const HISTORY_COLUMNS: Column<PackingNote>[] = [
  { key: 'createdAt', title: 'DATA', value: (r) => r.createdAt, render: (r) => labelDateTime(r.createdAt), align: 'center' },
  { key: 'responsible', title: 'RESPONSÁVEL', value: (r) => r.responsible },
  { key: 'receivedBy', title: 'RECEBIDO POR', value: (r) => r.receivedBy, wrap: true },
  { key: 'description', title: 'DESCRIÇÃO', value: (r) => r.description, wrap: true },
  { key: 'patrimonyTag', title: 'PATRIMÔNIO', value: (r) => r.patrimonyTag, align: 'center' },
  { key: 'serialNumber', title: 'SERIAL', value: (r) => r.serialNumber, align: 'center' },
];

/**
 * "PATRIMÔNIOS - ALERTA DE ESTOQUE". Três blocos, na ordem do relatório:
 * o alerta de estoque (filtros da barra de cima), o status real de cada
 * patrimônio (filtros próprios, na barra da seção) e, ao final, os objetos
 * pendentes de patrimoniar e o histórico de romaneios.
 */
export default function PatrimonyStockAlertsPage() {
  const filters = useUrlFilters();
  const { data, error, isPending } = useReport('patrimony-stock-alerts', filters.query);
  const statuses = data?.statuses;

  return (
    <main className="page">
      <FilterBar fields={STOCK_FIELDS} filters={filters} options={data?.options} extraKeys={[{ key: 'status', label: 'Status' }]}>
        <ToggleGroup label="Status do estoque" options={STOCK_STATUS_OPTIONS} value={filters.getList('status')} onChange={(v) => filters.setList('status', v)} />
      </FilterBar>
      {error && <ErrorBanner error={error} />}
      {isPending && !data && <Loading text="Carregando patrimônios…" />}
      {data && statuses && (
        <>
          <StockAlertSection
            report="patrimony-stock-alerts"
            data={data}
            filters={filters}
            title="Alerta de estoque · patrimônios"
            extraKpis={(
              <>
                <Kpi value={int(data.kpis.availableUnits)} label="Disponíveis" description="saldo dos itens filtrados acima" />
                <Kpi value={int(data.kpis.pendingUnits)} label="Pendente / à patrimoniar" description="todas as notas com saldo a patrimoniar" />
                <Kpi value={int(data.kpis.availablePlusPending)} label="Disponível + pendente" />
              </>
            )}
          />

          <h2 className="secao-titulo">Status real dos patrimônios</h2>
          <FilterBar
            section
            label="Filtros do status"
            fields={STATUS_FIELDS}
            filters={filters}
            options={statuses.options}
            extraKeys={[{ key: 'generalStatus', label: 'Status geral' }, { key: 'currentStatus', label: 'Status' }]}
          />
          <div className="grid linha-status">
            <Visual title="Status geral" subtitle={`${int(statuses.total)} patrimônios`} className="v-grafico">
              <StatusDonut
                data={statuses.byGeneralStatus}
                colorOf={patrimonyStatusColor}
                onSelect={(k) => filters.toggle('generalStatus', k)}
                selected={filters.getList('generalStatus')}
              />
            </Visual>
            <Visual title="Status específico" className="v-grafico" flush>
              <DataTable
                columns={[
                  { key: 'key', title: 'STATUS', value: (r) => r.key, cellClass: (r) => patrimonyStatusClass(r.key), wrap: true },
                  { key: 'value', title: 'QTD', value: (r) => r.value },
                ]}
                rows={statuses.byCurrentStatus}
                rowKey={(r) => r.key}
                onRowClick={(r) => filters.toggle('currentStatus', r.key)}
                isSelected={(r) => filters.getList('currentStatus').includes(r.key)}
              />
            </Visual>
            <Visual title="Patrimônios por base" className="v-grafico" flush>
              <RankingTable label="BASE" data={statuses.byBase} />
            </Visual>
            <Visual title="Patrimônios por tipo" className="v-grafico" flush>
              <RankingTable
                label="DESCRIÇÃO"
                data={statuses.byProduct}
                onSelect={(k) => filters.toggle('statusProduct', k)}
                selected={filters.getList('statusProduct')}
              />
            </Visual>
          </div>

          <Visual
            title="Status específico · por patrimônio"
            subtitle={statuses.detail.truncated ? `${int(statuses.detail.rows.length)} de ${int(statuses.detail.total)} patrimônios na tela — o CSV leva todos` : undefined}
            className="v-tabela"
            flush
            actions={<ExportButton report="patrimony-stock-alerts" table="statuses" query={filters.query} />}
          >
            <DataTable columns={STATUS_COLUMNS} rows={statuses.detail.rows} total={statuses.detail.total} rowKey={(r, i) => `${r.patrimonyTag}|${r.serialNumber}|${i}`} />
          </Visual>

          <div className="grid linha-30-42">
            <Visual title="Em responsabilidade de: · equipe" className="v-tabela-baixa" flush>
              <RankingTable
                label="EQUIPE"
                data={statuses.byTeam}
                onSelect={(k) => filters.toggle('statusTeam', k)}
                selected={filters.getList('statusTeam')}
              />
            </Visual>
            <Visual title="Em responsabilidade de: · responsável" className="v-tabela-baixa" flush>
              <DataTable
                columns={[
                  { key: 'responsible', title: 'RESPONSÁVEL', value: (r) => r.responsible, wrap: true },
                  { key: 'team', title: 'EQUIPE', value: (r) => r.team },
                  { key: 'total', title: 'QTD', value: (r) => r.total, databar: true },
                ]}
                rows={statuses.byResponsible}
                rowKey={(r) => `${r.responsible}|${r.team}`}
                onRowClick={(r) => filters.toggle('statusResponsible', r.responsible)}
                isSelected={(r) => filters.getList('statusResponsible').includes(r.responsible)}
              />
            </Visual>
          </div>

          <h2 className="secao-titulo">Pendências e histórico</h2>
          <Visual
            title="Objetos pendentes · visão detalhada"
            subtitle="Itens comprados que ainda não viraram patrimônio (todas as bases)"
            className="v-tabela-baixa"
            flush
            actions={<ExportButton report="patrimony-stock-alerts" table="pending" query={{}} />}
          >
            <DataTable
              columns={PENDING_COLUMNS}
              rows={data.pending}
              rowKey={(r, i) => `${r.invoiceNumber}|${r.productCode}|${i}`}
              footer={{
                invoiceNumber: `Total (${data.pending.length})`,
                totalUnits: int(data.pending.reduce((s, r) => s + r.totalUnits, 0)),
                pendingUnits: int(data.pending.reduce((s, r) => s + r.pendingUnits, 0)),
              }}
            />
          </Visual>
          <Visual
            title="Histórico de romaneios"
            subtitle={`Romaneios de patrimônio do almoxarifado para técnicos · ${int(data.packingHistory.total)} registros${data.packingHistory.truncated ? ' (os 1.000 mais recentes na tela)' : ''}`}
            className="v-tabela"
            flush
            actions={<ExportButton report="patrimony-stock-alerts" table="packing-history" query={{}} />}
          >
            <DataTable columns={HISTORY_COLUMNS} rows={data.packingHistory.rows} total={data.packingHistory.total} rowKey={(r, i) => `${r.createdAt}|${r.patrimonyTag}|${i}`} />
          </Visual>
        </>
      )}
    </main>
  );
}
