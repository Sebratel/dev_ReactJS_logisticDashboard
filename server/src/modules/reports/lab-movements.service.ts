import { compareText, type KeyValue } from '../../common/helpers/aggregation.helper.js';
import { LAB_EVENT_TYPES } from '../../model/business-rules.js';
import type { DataModel, LabBacklogItem, LabEvent } from '../../model/model.types.js';
import { buildMatrix, byTotalDesc, type Matrix } from './matrix.js';
import { applyFilters, type FilterSelection, type FilterSpec } from './report-filter.js';

/**
 * Tela LABORATÓRIO · ENTRADA/SAÍDA — réplica da aba "Entrada/ Saída
 * Laboratório" do Power BI "LAB - Produtividade Laboratório".
 *
 * Agregações conferidas no campo de cada visual: o gráfico conta patrimônios
 * (não vazios) por dia e tipo de evento; o cartão conta eventos; a matriz conta
 * o id do patrimônio por item x evento/motivo; as tabelas por item e de
 * patrimônios contam patrimônios DISTINTOS. O backlog (sem saída registrada)
 * se liga aos eventos pelo patrimônio: os filtros da tela valem para ele
 * pelos patrimônios que sobram nos eventos.
 *
 * Sem limite de linhas nesta aba (decisão da área, 06/11/2026): as tabelas
 * levam todas as linhas do recorte (a tela desenha só as que estão à vista).
 */
export const LAB_SPEC: FilterSpec<LabEvent> = {
  lists: [
    { key: 'item', values: (r) => r.productTitle },
    { key: 'lab', values: (r) => r.entryLab },
    { key: 'warehouse', values: (r) => r.warehouse },
    { key: 'event', values: (r) => r.eventType },
    { key: 'base', values: (r) => r.baseLab },
    { key: 'reason', values: (r) => r.entryReason },
    // clique numa coluna do gráfico (dia ou mês); sem lista na tela, só os chips
    { key: 'day', values: (r) => r.day, withOptions: false },
    { key: 'month', values: (r) => r.day.slice(0, 7), withOptions: false },
  ],
  // ~20 mil patrimônios: busca em vez de lista
  searches: [{ key: 'patrimonyTag', value: (r) => r.patrimonyTag }],
  date: (r) => r.day,
};

const EVENT_ORDER = new Map<string, number>(LAB_EVENT_TYPES.map((e, i) => [e, i]));
const eventRank = (e: string) => EVENT_ORDER.get(e) ?? EVENT_ORDER.size;
const BLANK = '(Em branco)';

export interface LabPeriodValues {
  key: string;
  label: string;
  total: number;
  values: Record<string, number>;
}

/** Linha da lista de patrimônios: patrimônio x ciclo (a "LISTAGEM DOS PATRIMÔNIOS"). */
export interface LabPatrimonyRow {
  patrimonyTag: string | null;
  serialNumber: string | null;
  cycle: number;
  item: string | null;
}

export interface LabBacklogRow {
  patrimonyTag: string | null;
  serialNumber: string | null;
  item: string | null;
  currentLab: string | null;
  entryAt: string | null;
  openDays: number | null;
  over90: string | null;
}

export interface LabDetailRow {
  occurredAt: string;
  eventType: string;
  patrimonyTag: string | null;
  serialNumber: string | null;
  packingNumber: string | null;
  item: string | null;
  entryReason: string | null;
  entryLab: string | null;
  cycleEntryAt: string | null;
  labDays: number | null;
  warehouse: string | null;
  discardReason: string | null;
}

export const toLabDetailRow = (r: LabEvent): LabDetailRow => ({
  occurredAt: r.occurredAt,
  eventType: r.eventType,
  patrimonyTag: r.patrimonyTag,
  serialNumber: r.serialNumber,
  packingNumber: r.packingNumber,
  item: r.productTitle,
  entryReason: r.entryReason,
  entryLab: r.entryLab,
  cycleEntryAt: r.cycleEntryAt,
  labDays: r.labDays,
  warehouse: r.warehouse,
  discardReason: r.discardReason,
});

/** "LISTAGEM DOS PATRIMÔNIOS": uma linha por patrimônio e ciclo, em ordem de patrimônio. */
export function labPatrimonies(rows: readonly LabEvent[]): LabPatrimonyRow[] {
  const groups = new Map<string, LabPatrimonyRow>();
  for (const r of rows) {
    const key = `${r.patrimonyTag ?? ''}|${r.serialNumber ?? ''}|${r.cycle}|${r.productTitle ?? ''}`;
    if (!groups.has(key)) groups.set(key, { patrimonyTag: r.patrimonyTag, serialNumber: r.serialNumber, cycle: r.cycle, item: r.productTitle });
  }
  // sem número de patrimônio vai para o fim
  return [...groups.values()].sort((a, b) => Number(a.patrimonyTag === null) - Number(b.patrimonyTag === null)
    || compareText(a.patrimonyTag ?? '', b.patrimonyTag ?? '') || a.cycle - b.cycle);
}

/**
 * Backlog no recorte: os patrimônios sem saída que aparecem nos eventos
 * filtrados (é assim que o filtro chegava ao backlog no Power BI), com o
 * patrimônio, o serial e o item dos eventos. Entrada mais recente primeiro,
 * como a tabela do relatório. Um por patrimônio (a consulta já agrupa).
 */
export function labBacklog(rows: readonly LabEvent[], backlog: readonly LabBacklogItem[]): LabBacklogRow[] {
  const byId = new Map<number, LabEvent>();
  for (const r of rows) if (!byId.has(r.patrimonyId)) byId.set(r.patrimonyId, r);
  const out: LabBacklogRow[] = [];
  for (const b of backlog) {
    const event = byId.get(b.patrimonyId);
    if (!event) continue;
    out.push({
      patrimonyTag: event.patrimonyTag,
      serialNumber: event.serialNumber,
      item: event.productTitle,
      currentLab: b.currentLab,
      entryAt: b.entryAt,
      openDays: b.openDays,
      over90: b.over90,
    });
  }
  return out;
}

/** Patrimônios DISTINTOS por item, do maior para o menor, e o total distinto. */
function distinctByItem<T>(rows: readonly T[], itemOf: (r: T) => string | null, idOf: (r: T) => number): { rows: KeyValue[]; total: number } {
  const byItem = new Map<string, Set<number>>();
  const all = new Set<number>();
  for (const r of rows) {
    const item = itemOf(r) ?? BLANK;
    const set = byItem.get(item) ?? new Set<number>();
    set.add(idOf(r));
    byItem.set(item, set);
    all.add(idOf(r));
  }
  return {
    rows: [...byItem].map(([key, ids]) => ({ key, value: ids.size })).sort((a, b) => b.value - a.value || compareText(a.key, b.key)),
    total: all.size,
  };
}

/** O recorte sem o dia/mês clicado no gráfico: o gráfico continua com todas as colunas (as clicadas em destaque). */
const withoutPeriodClick = (selection: FilterSelection): FilterSelection => {
  const { day: _day, month: _month, ...lists } = selection.lists;
  return { ...selection, lists };
};

export function buildLabMovementsReport(model: DataModel, selection: FilterSelection) {
  const { rows, options } = applyFilters(model.labEvents, LAB_SPEC, selection);
  const hasPeriodClick = Boolean(selection.lists.day?.length || selection.lists.month?.length);
  const chartRows = hasPeriodClick ? applyFilters(model.labEvents, LAB_SPEC, withoutPeriodClick(selection)).rows : rows;

  // gráfico: patrimônios (não vazios) por dia e tipo de evento
  const present = new Set(chartRows.map((r) => r.eventType));
  const series = [...LAB_EVENT_TYPES.filter((e) => present.has(e)), ...[...present].filter((e) => !EVENT_ORDER.has(e)).sort(compareText)]
    .map((e) => ({ key: e, label: e }));
  const byDayMap = new Map<string, Record<string, number>>();
  for (const r of chartRows) {
    if (r.patrimonyTag === null) continue;
    const values = byDayMap.get(r.day) ?? {};
    values[r.eventType] = (values[r.eventType] ?? 0) + 1;
    byDayMap.set(r.day, values);
  }
  const byDay: LabPeriodValues[] = [...byDayMap]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, values]) => ({ key: day, label: day, values, total: Object.values(values).reduce((s, v) => s + v, 0) }));

  // matriz: item x evento > motivo de entrada (contagem do id do patrimônio)
  const matrix: Matrix = buildMatrix(
    rows,
    [{ key: (r) => r.productTitle ?? BLANK, sort: byTotalDesc }],
    (r) => `${r.eventType}|${r.entryReason ?? ''}`,
    (key) => {
      const [event, reason] = key.split('|');
      return reason ? `${event} · ${reason}` : String(event);
    },
    (a, b) => {
      const [ea, ra] = a.split('|') as [string, string];
      const [eb, rb] = b.split('|') as [string, string];
      return eventRank(ea) - eventRank(eb) || compareText(ra, rb);
    },
  );

  const patrimonies = labPatrimonies(rows);
  const backlog = labBacklog(rows, model.labBacklog);

  return {
    options,
    kpis: {
      events: rows.length,
      patrimonies: new Set(rows.map((r) => r.patrimonyId)).size,
      backlog: backlog.length,
    },
    series,
    byDay,
    matrix,
    byItem: distinctByItem(rows, (r) => r.productTitle, (r) => r.patrimonyId),
    patrimonies,
    backlog: {
      // uma linha por patrimônio: a posição na lista serve de identidade
      byItem: distinctByItem(backlog.map((b, i) => ({ item: b.item, i })), (r) => r.item, (r) => r.i).rows,
      over90: backlog.filter((b) => b.over90 === 'Acima de 90 dias').length,
      rows: backlog,
    },
    // os próprios eventos do modelo (sem cópia): o cache de respostas guarda só a lista
    detail: rows,
  };
}
