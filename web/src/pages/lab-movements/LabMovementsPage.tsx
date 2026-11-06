import { useMemo, useState } from 'react';
import { ComparisonColumns } from '../../components/charts/ComparisonColumns';
import { FilterBar, type FilterField } from '../../components/filters/FilterBar';
import { ToggleGroup } from '../../components/filters/ToggleGroup';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { MatrixTable } from '../../components/tables/MatrixTable';
import { RankingTable } from '../../components/tables/RankingTable';
import { ExportButton } from '../../components/ui/ExportButton';
import { Kpi } from '../../components/ui/Kpi';
import { Segmented } from '../../components/ui/Segmented';
import { Empty, ErrorBanner, Loading } from '../../components/ui/States';
import { Visual } from '../../components/ui/Visual';
import { useReport } from '../../hooks/useReport';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import type { LabBacklogRow, LabDetailRow, LabPatrimonyRow, PeriodValues, SeriesDefinition } from '../../services/types';
import { dec1, int, labelDate, labelDateTime, labelDay, labelMonth } from '../../utils/format';

/** Os slicers de lista da aba, na ordem do relatório (evento, base e tipo de entrada são botões, abaixo). */
const FIELDS: FilterField[] = [
  { type: 'period', label: 'Data' },
  { type: 'list', key: 'item', label: 'Item' },
  { type: 'list', key: 'lab', label: 'Dash laboratório' },
  { type: 'list', key: 'warehouse', label: 'Dash almox' },
  { type: 'search', key: 'patrimonyTag', label: 'Patrimônio' },
];

/** Filtros sem caixa na barra: os botões e o clique no gráfico (aparecem nos chips). */
const EXTRA_KEYS = [
  { key: 'event', label: 'Tipo de evento' },
  { key: 'base', label: 'Base operacional' },
  { key: 'reason', label: 'Tipo de entrada' },
  { key: 'day', label: 'Dia', format: labelDate },
  { key: 'month', label: 'Mês', format: labelMonth },
];

/** Os quatro eventos, sempre na mesma ordem e com a cor das colunas do Power BI (o filtro não muda as cores). */
const EVENTS: SeriesDefinition[] = [
  { key: 'ENTRADA', label: 'Entrada' },
  { key: 'SAIDA', label: 'Saída' },
  { key: 'RMA', label: 'RMA' },
  { key: 'DESCARTE INTERNO', label: 'Descarte interno' },
];
const EVENT_COLORS: Record<string, string> = {
  ENTRADA: '#51B249',
  SAIDA: '#D64550',
  RMA: '#118DFF',
  'DESCARTE INTERNO': '#A666B0',
};

/** Fundo da célula de evento e de motivo nas tabelas, como no Power BI (classes em theme.css). */
const EVENT_CELL: Record<string, string> = {
  ENTRADA: 'lab-ev lab-ev-entrada',
  SAIDA: 'lab-ev lab-ev-saida',
  RMA: 'lab-ev lab-ev-rma',
  'DESCARTE INTERNO': 'lab-ev lab-ev-descarte',
};
const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function reasonCell(reason: string | null): string | undefined {
  const r = reason ? fold(reason) : '';
  if (r.startsWith('cancel')) return 'lab-ev lab-motivo-cancelamento';
  if (r.startsWith('manut')) return 'lab-ev lab-motivo-manutencao';
  return undefined;
}
const REASON_COLORS: Record<string, string> = { cancelamento: '#A38600', manutencao: '#0D6ABF' };
const reasonColor = (reason: string): string | undefined => REASON_COLORS[fold(reason)];

/** Botões a partir das opções do recorte, sem perder o que está marcado. */
const toggleOptions = (options: string[] | undefined, selected: string[], colorOf?: (v: string) => string | undefined) => (
  [...new Set([...(options ?? []), ...selected])].map((v) => ({ value: v, label: v, color: colorOf?.(v) }))
);

const DETAIL_COLUMNS: Column<LabDetailRow>[] = [
  { key: 'occurredAt', title: 'DATA MOVIMENTO', value: (r) => r.occurredAt, render: (r) => labelDateTime(r.occurredAt), align: 'center' },
  {
    key: 'eventType',
    title: 'EVENTO',
    value: (r) => r.eventType,
    render: (r) => <span title={r.discardReason ? `Motivo do descarte: ${r.discardReason}` : undefined}>{r.eventType}</span>,
    cellClass: (r) => EVENT_CELL[r.eventType],
    align: 'center',
  },
  { key: 'patrimonyTag', title: 'PATRIMÔNIO', value: (r) => r.patrimonyTag, align: 'center' },
  { key: 'serialNumber', title: 'SERIAL', value: (r) => r.serialNumber },
  { key: 'packingNumber', title: 'ROMANEIO', value: (r) => r.packingNumber, align: 'center' },
  { key: 'item', title: 'ITEM', value: (r) => r.productTitle, wrap: true },
  { key: 'entryReason', title: 'MOTIVO', value: (r) => r.entryReason, cellClass: (r) => reasonCell(r.entryReason), align: 'center' },
  { key: 'entryLab', title: 'DASH LABORATÓRIO', value: (r) => r.entryLab },
  { key: 'cycleEntryAt', title: 'DATA ENTRADA', value: (r) => r.cycleEntryAt, render: (r) => labelDateTime(r.cycleEntryAt), align: 'center' },
  { key: 'labDays', title: 'DIAS NO LAB', value: (r) => r.labDays, render: (r) => (r.labDays === null ? '' : dec1(r.labDays)), align: 'center' },
  { key: 'warehouse', title: 'DASH ALMOX', value: (r) => r.warehouse },
];

const PATRIMONY_COLUMNS: Column<LabPatrimonyRow>[] = [
  { key: 'patrimonyTag', title: 'PATRIMÔNIO', value: (r) => r.patrimonyTag, align: 'center' },
  { key: 'serialNumber', title: 'SERIAL', value: (r) => r.serialNumber },
  { key: 'cycle', title: 'CICLOS', value: (r) => r.cycle, align: 'center' },
  { key: 'item', title: 'ITEM', value: (r) => r.item, wrap: true },
];

const BACKLOG_COLUMNS: Column<LabBacklogRow>[] = [
  { key: 'patrimonyTag', title: 'PATRIMÔNIO', value: (r) => r.patrimonyTag, align: 'center' },
  { key: 'serialNumber', title: 'SERIAL', value: (r) => r.serialNumber },
  { key: 'entryAt', title: 'DATA ENTRADA', value: (r) => r.entryAt, render: (r) => labelDate(r.entryAt), align: 'center' },
  {
    key: 'openDays',
    title: 'DIAS',
    value: (r) => r.openDays,
    render: (r) => <span className={r.over90 === 'Acima de 90 dias' ? 'dias-atraso' : undefined}>{r.openDays === null ? '—' : dec1(r.openDays)}</span>,
    align: 'center',
  },
  { key: 'currentLab', title: 'LABORATÓRIO ATUAL', value: (r) => r.currentLab, wrap: true },
];

type Grain = 'day' | 'month';

/** Soma os dias em meses (a chave vira AAAA-MM). */
function toMonths(days: readonly PeriodValues[]): PeriodValues[] {
  const months = new Map<string, PeriodValues>();
  for (const d of days) {
    const key = d.key.slice(0, 7);
    const m = months.get(key) ?? { key, label: key, total: 0, values: {} };
    m.total += d.total;
    for (const [k, v] of Object.entries(d.values)) m.values[k] = (m.values[k] ?? 0) + v;
    months.set(key, m);
  }
  return [...months.values()];
}

/**
 * LABORATÓRIO · ENTRADA E SAÍDA — a aba "Entrada/ Saída Laboratório" do Power
 * BI "LAB - Produtividade Laboratório": os eventos de cada patrimônio no
 * laboratório (entrada, saída, RMA, descarte interno), por dia e item, os
 * patrimônios por ciclo e o backlog (no laboratório sem saída registrada).
 */
export default function LabMovementsPage() {
  const filters = useUrlFilters();
  const { data, error, isPending } = useReport('lab-movements', filters.query);
  // o Power BI mostrava dia a dia; com mais de dois meses no recorte, o mês lê melhor (e dá para trocar)
  const [grain, setGrain] = useState<Grain | null>(null);
  const autoGrain: Grain = (data?.byDay.length ?? 0) > 62 ? 'month' : 'day';
  const chartGrain = grain ?? autoGrain;
  const chartData = useMemo(() => (chartGrain === 'month' ? toMonths(data?.byDay ?? []) : data?.byDay ?? []), [chartGrain, data]);
  const selectedItems = filters.getList('item');

  // clique numa coluna do gráfico: filtra a tela pelo período; com Ctrl/⌘, soma mais de um
  const days = filters.getList('day');
  const months = filters.getList('month');
  const selectPeriod = (key: string, additive: boolean) => {
    const own = chartGrain === 'month' ? 'month' : 'day';
    const current = own === 'month' ? months : days;
    const next = additive
      ? (current.includes(key) ? current.filter((k) => k !== key) : [...current, key])
      : (current.length === 1 && current[0] === key ? [] : [key]);
    // dia e mês juntos seriam a interseção: o clique num troca o outro
    filters.setLists({ [own]: next, [own === 'month' ? 'day' : 'month']: [] });
  };
  const isPeriodSelected = (key: string) => (chartGrain === 'month'
    ? months.includes(key) || days.some((d) => d.startsWith(key))
    : days.includes(key) || months.includes(key.slice(0, 7)));

  return (
    <main className="page">
      <FilterBar fields={FIELDS} filters={filters} options={data?.options} extraKeys={EXTRA_KEYS}>
        <div className="lab-filtros">
          <ToggleGroup
            label="Tipo de evento"
            options={EVENTS.map((e) => ({ value: e.key, label: e.label, color: EVENT_COLORS[e.key] }))}
            value={filters.getList('event')}
            onChange={(v) => filters.setList('event', v)}
          />
          <ToggleGroup
            label="Base operacional"
            showLabel
            options={toggleOptions(data?.options.base, filters.getList('base'))}
            value={filters.getList('base')}
            onChange={(v) => filters.setList('base', v)}
          />
          <ToggleGroup
            label="Tipo de entrada"
            showLabel
            options={toggleOptions(data?.options.reason, filters.getList('reason'), reasonColor)}
            value={filters.getList('reason')}
            onChange={(v) => filters.setList('reason', v)}
          />
        </div>
      </FilterBar>
      {error && <ErrorBanner error={error} />}
      {isPending && !data && <Loading text="Carregando as entradas e saídas do laboratório…" />}
      {data && (
        <>
          <div className="grid linha-lab-topo">
            <div className="col-kpi">
              <Kpi value={int(data.kpis.events)} label="Eventos" description="entradas, saídas, RMA e descartes" />
              <Kpi value={int(data.kpis.patrimonies)} label="Patrimônios" description="distintos no recorte" />
              <Kpi value={int(data.kpis.backlog)} label="No laboratório" description={`sem saída registrada · ${int(data.backlog.over90)} há mais de 90 dias`} />
            </div>
            <Visual
              title={`Eventos por ${chartGrain === 'month' ? 'mês' : 'dia'}`}
              subtitle="patrimônios por tipo de evento · clique numa coluna filtra o período (Ctrl soma mais de uma)"
              actions={(
                <Segmented
                  value={chartGrain}
                  options={[{ id: 'day', label: 'dia' }, { id: 'month', label: 'mês' }]}
                  onChange={setGrain}
                  title="Agrupar por dia ou por mês"
                />
              )}
            >
              {chartData.length ? (
                <>
                  <div className="ger-grafico">
                    <ComparisonColumns
                      data={chartData}
                      series={EVENTS}
                      seriesColors={EVENT_COLORS}
                      stacked={false}
                      labelOf={(p) => (chartGrain === 'month' ? labelMonth(p.key) : labelDay(p.key))}
                      onSelect={selectPeriod}
                      isSelected={isPeriodSelected}
                    />
                  </div>
                  <ul className="lab-legenda">
                    {EVENTS.map((e) => <li key={e.key}><i style={{ background: EVENT_COLORS[e.key] }} />{e.label}</li>)}
                  </ul>
                </>
              ) : <Empty />}
            </Visual>
          </div>

          <Visual
            title="Eventos"
            subtitle={`${int(data.detail.length)} eventos · do mais recente para o mais antigo · passe o mouse no descarte para ver o motivo`}
            className="v-tabela"
            flush
            actions={<ExportButton report="lab-movements" table="detail" query={filters.query} />}
          >
            <DataTable virtual columns={DETAIL_COLUMNS} rows={data.detail} rowKey={(r, i) => `${r.patrimonyId}|${r.occurredAt}|${r.eventType}|${i}`} />
          </Visual>

          <Visual title="Itens por evento e motivo" subtitle="patrimônios por item, tipo de evento e motivo de entrada" className="v-tabela" flush>
            <MatrixTable matrix={data.matrix} rowHeader="ITEM" totalHeader="TOTAL" />
          </Visual>

          <div className="grid linha-50-50">
            <Visual title="Quantidade por tipo de equipamento" subtitle="patrimônios distintos · clique para filtrar" className="v-tabela" flush>
              <RankingTable label="ITEM" data={data.byItem.rows} onSelect={(k) => filters.toggle('item', k)} selected={selectedItems} />
            </Visual>
            <Visual
              title="Listagem dos patrimônios"
              subtitle={`${int(data.patrimonies.length)} linhas · um por patrimônio e ciclo`}
              className="v-tabela"
              flush
              actions={<ExportButton report="lab-movements" table="patrimonies" query={filters.query} />}
            >
              <DataTable virtual columns={PATRIMONY_COLUMNS} rows={data.patrimonies} rowKey={(r, i) => `${r.patrimonyTag ?? '-'}|${r.cycle}|${i}`} />
            </Visual>
          </div>

          <div className="grid linha-50-50">
            <Visual title="Backlog por item" subtitle="no laboratório sem saída registrada · clique para filtrar" className="v-tabela" flush>
              <RankingTable label="ITEM" data={data.backlog.byItem} onSelect={(k) => filters.toggle('item', k)} selected={selectedItems} />
            </Visual>
            <Visual
              title="Backlog · patrimônios sem saída registrada"
              subtitle={`${int(data.backlog.rows.length)} patrimônios · entrada mais recente primeiro · em vinho, mais de 90 dias`}
              className="v-tabela"
              flush
              actions={<ExportButton report="lab-movements" table="backlog" query={filters.query} />}
            >
              <DataTable virtual columns={BACKLOG_COLUMNS} rows={data.backlog.rows} rowKey={(r, i) => `${r.patrimonyTag ?? '-'}|${i}`} />
            </Visual>
          </div>
        </>
      )}
    </main>
  );
}
