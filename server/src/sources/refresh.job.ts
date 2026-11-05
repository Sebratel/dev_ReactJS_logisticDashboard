import { appConfig, hasMaria, hasVoalle } from '../config/env.config.js';
import { logger } from '../common/helpers/logger.helper.js';
import { StringPool } from '../common/helpers/string-pool.js';
import {
  buildChargedPatrimonies, buildChargedProducts, buildFieldEquipment, buildPatrimonyAllocations, buildPatrimonyPackingNotes, buildPatrimonyPackings, buildPatrimonyStatuses,
  buildPendingPatrimonies, buildProductAllocations, buildProductPackings, buildUserActivity,
} from '../model/builders/activity.builder.js';
import {
  buildCreatedObjects, buildFlatConsumption, buildObsoleteFirstDays, buildPackingProductivity, buildZteDispatches, buildZteReturns,
} from '../model/builders/management.builder.js';
import { buildStockBalances } from '../model/builders/stock-balances.builder.js';
import { buildStockControlIndex, type StockControlIndex } from '../model/builders/stock-control.builder.js';
import { getSourceStatuses, publishModel, setSourceStatus } from '../model/model.store.js';
import { listStockControls } from '../modules/stock-controls/stock-control.service.js';
import { devCacheEnabled, readDevCache, writeDevCache } from './dev-source-cache.js';
import { SOURCES, type SourceDefinition } from './source.registry.js';
import type {
  PendingPatrimonySourceRow, PurchaseRequestSourceRow, SeniorCollaboratorSourceRow,
  StockBalanceSourceRow, UserSourceRow,
} from './source.types.js';

/**
 * Carga horária das fontes.
 *
 * As tabelas de CADASTRO (saldo, pedidos, pendentes, usuários, Senior)
 * ficam guardadas cruas entre as cargas: são pequenas, e se uma delas falhar a
 * próxima montagem reaproveita a última versão boa em vez de esvaziar a tela.
 *
 * As de MOVIMENTO são grandes (até ~700 mil linhas) e viram tabela do modelo
 * assim que chegam — guardar o cru delas dobraria a memória. Se uma falhar, a
 * tabela publicada anterior continua valendo até a próxima carga.
 */
const master: {
  stockBalances: StockBalanceSourceRow[] | null;
  purchaseRequests: PurchaseRequestSourceRow[] | null;
  pendingPatrimonies: PendingPatrimonySourceRow[] | null;
  users: UserSourceRow[] | null;
  senior: SeniorCollaboratorSourceRow[] | null;
} = {
  stockBalances: null,
  purchaseRequests: null,
  pendingPatrimonies: null,
  users: null,
  senior: null,
};

const ACTIVITY_CONCURRENCY = 2;
const MANUAL_REFRESH_MIN_INTERVAL_MS = 5 * 60_000;

let running: Promise<void> | null = null;
let timer: NodeJS.Timeout | null = null;
let lastStartedAt: number | null = null;
let nextRunAt: number | null = null;
let isFirstRun = true;

function isConfigured(source: SourceDefinition<unknown>): string | null {
  if (source.origin === 'VOALLE' && !hasVoalle) return 'Voalle não configurado';
  if (source.origin === 'MARIADB' && !hasMaria) return 'MariaDB não configurado';
  return null;
}

export interface RunSourceOptions {
  /** false: nunca usa o cache de desenvolvimento (fonte leve, lida a cada minuto) */
  devCache?: boolean;
  /** true: só registra no log a primeira leitura, falha e volta da falha (fonte lida a cada minuto) */
  quiet?: boolean;
}

/** Roda uma fonte e registra o resultado. Nunca lança: falha vira status. */
export async function runSource<T>(source: SourceDefinition<T>, options: RunSourceOptions = {}): Promise<T[] | null> {
  const previous = getSourceStatuses().find((s) => s.key === source.key);
  const notConfigured = isConfigured(source as SourceDefinition<unknown>);
  if (notConfigured) {
    setSourceStatus({ key: source.key, label: source.label, origin: source.origin, rows: null, durationMs: null, updatedAt: null, error: notConfigured });
    return null;
  }
  const started = Date.now();
  try {
    // cache de desenvolvimento só no boot: as cargas agendadas sempre vão à fonte
    const useDevCache = options.devCache !== false;
    const cached = isFirstRun && useDevCache ? await readDevCache<T>(source.key) : null;
    const rows = cached ?? await source.load();
    if (!cached && useDevCache && devCacheEnabled) await writeDevCache(source.key, rows);
    const durationMs = Date.now() - started;
    setSourceStatus({
      key: source.key, label: source.label, origin: source.origin,
      rows: rows.length, durationMs, updatedAt: new Date().toISOString(), error: null,
    });
    if (!options.quiet || !previous?.updatedAt || previous.error) {
      logger.info('etl', `${source.key}: ${rows.length} linhas em ${durationMs} ms`);
    }
    return rows;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // mantém a última leitura boa no status: a tela mostra "falhou" E desde quando o dado vale
    setSourceStatus({
      key: source.key, label: source.label, origin: source.origin,
      rows: previous?.rows ?? null, durationMs: Date.now() - started,
      updatedAt: previous?.updatedAt ?? null, error: message,
    });
    logger.error('etl', `${source.key} falhou: ${message}`);
    return null;
  }
}

const STOCK_CONTROL_SOURCE = { key: 'stockControl', label: 'Controle de estoque (cadastro do app)', origin: 'APP' } as const;

/** Último cadastro lido com sucesso: se o arquivo ficar ilegível, a tela segue com ele. */
let lastStockControl: StockControlIndex | null = null;

/**
 * Lê o cadastro de controle de estoque (arquivo local, instantâneo). Aparece
 * na lista de fontes como as outras: quantos itens e se a leitura falhou.
 */
function readStockControl(): StockControlIndex | null {
  const started = Date.now();
  try {
    const { items } = listStockControls();
    const index = buildStockControlIndex(items);
    if (index.duplicatedKeys) {
      logger.warn('etl', `cadastro de controle de estoque tem ${index.duplicatedKeys} item(ns) com código+base repetido; vale o primeiro`);
    }
    setSourceStatus({
      ...STOCK_CONTROL_SOURCE, rows: index.size, durationMs: Date.now() - started,
      updatedAt: new Date().toISOString(), error: null,
    });
    lastStockControl = index;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const previous = getSourceStatuses().find((s) => s.key === STOCK_CONTROL_SOURCE.key);
    setSourceStatus({
      ...STOCK_CONTROL_SOURCE, rows: previous?.rows ?? null, durationMs: Date.now() - started,
      updatedAt: previous?.updatedAt ?? null, error: message,
    });
    logger.error('etl', `cadastro de controle de estoque falhou: ${message}`);
  }
  return lastStockControl;
}

/** Remonta o que depende do cadastro: saldo x mínimo/alerta e a categoria por código. */
function publishStockTables(control: StockControlIndex | null): void {
  publishModel({
    stockBalances: buildStockBalances(master.stockBalances ?? [], control, master.purchaseRequests ?? []),
    categoryByProduct: control?.categoryByProduct ?? new Map(),
    hasStockControl: control !== null && control.size > 0,
  });
}

/**
 * Chamado quando alguém altera o cadastro pela tela: a mudança vale na hora,
 * sem esperar a próxima carga (o saldo do Voalle é o da última carga).
 */
export function applyStockControls(): void {
  publishStockTables(readStockControl());
}

async function runMasterPhase(): Promise<void> {
  const masters = Object.values(SOURCES).filter((s) => s.phase === 'MASTER');
  const results = await Promise.all(masters.map((s) => runSource(s as SourceDefinition<unknown>)));
  masters.forEach((source, i) => {
    const rows = results[i];
    if (rows) (master as Record<string, unknown[] | null>)[source.key] = rows;
  });

  publishStockTables(readStockControl());
  publishModel({
    pendingPatrimonies: buildPendingPatrimonies(master.pendingPatrimonies ?? []),
    userActivity: buildUserActivity(master.users ?? []),
  });
}

async function runActivityPhase(): Promise<void> {
  const pool = new StringPool();
  const senior = master.senior ?? [];

  const tasks: Array<() => Promise<void>> = [
    async () => {
      const rows = await runSource(SOURCES.productAllocations);
      if (rows) publishModel({ productAllocations: buildProductAllocations(rows, pool) });
    },
    async () => {
      const rows = await runSource(SOURCES.patrimonyStatuses);
      if (rows) publishModel({ patrimonyStatuses: buildPatrimonyStatuses(rows, senior, pool) });
    },
    async () => {
      const rows = await runSource(SOURCES.patrimonyAllocations);
      if (rows) publishModel({ patrimonyAllocations: buildPatrimonyAllocations(rows, pool) });
    },
    async () => {
      const rows = await runSource(SOURCES.productPackings);
      if (rows) publishModel({ productPackings: buildProductPackings(rows, pool) });
    },
    async () => {
      const rows = await runSource(SOURCES.patrimonyPackings);
      if (rows) publishModel({ patrimonyPackings: buildPatrimonyPackings(rows, pool) });
    },
    async () => {
      const rows = await runSource(SOURCES.patrimonyPackingNotes);
      if (rows) publishModel({ patrimonyPackingNotes: buildPatrimonyPackingNotes(rows, pool) });
    },
    // tela de equipamentos para campo (Power BI "CTR"): ~3 s e ~2 s
    async () => {
      const rows = await runSource(SOURCES.newFieldEquipment);
      if (rows) publishModel({ newFieldEquipment: buildFieldEquipment(rows, pool) });
    },
    async () => {
      const rows = await runSource(SOURCES.usedFieldEquipment);
      if (rows) publishModel({ usedFieldEquipment: buildFieldEquipment(rows, pool) });
    },
    // telas "em carga" (Power BI "LOG - Objetos em Carga"): ~1 s e ~2 s
    async () => {
      const rows = await runSource(SOURCES.chargedPatrimonies);
      if (rows) publishModel({ chargedPatrimonies: buildChargedPatrimonies(rows, pool) });
    },
    async () => {
      const rows = await runSource(SOURCES.chargedProducts);
      if (rows) publishModel({ chargedProducts: buildChargedProducts(rows, pool) });
    },
    // seção Gerencial (Power BI "LOG - Gerencial"): de 0,1 s a ~16 s cada
    async () => {
      const rows = await runSource(SOURCES.createdObjects);
      if (rows) publishModel({ createdObjects: buildCreatedObjects(rows) });
    },
    async () => {
      const rows = await runSource(SOURCES.flatConsumption);
      if (rows) publishModel({ flatConsumption: buildFlatConsumption(rows) });
    },
    async () => {
      const rows = await runSource(SOURCES.zteDispatches);
      if (rows) publishModel({ zteDispatches: buildZteDispatches(rows) });
    },
    async () => {
      const rows = await runSource(SOURCES.zteReturns);
      if (rows) publishModel({ zteReturns: buildZteReturns(rows, pool) });
    },
    async () => {
      const rows = await runSource(SOURCES.obsoleteEquipment);
      if (rows) publishModel({ obsoleteFirstDays: buildObsoleteFirstDays(rows) });
    },
    async () => {
      const rows = await runSource(SOURCES.packingProductivity);
      if (rows) publishModel({ packingProductivity: buildPackingProductivity(rows, pool) });
    },
  ];

  // a view de alocação de produtos leva minutos: ela começa primeiro e as
  // outras andam em paralelo na segunda conexão
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const task = tasks[next];
      next += 1;
      if (task) await task();
    }
  };
  await Promise.all(Array.from({ length: ACTIVITY_CONCURRENCY }, worker));
}

export function refreshAll(): Promise<void> {
  if (running) return running;
  lastStartedAt = Date.now();
  logger.info('etl', 'carga iniciada');
  running = (async () => {
    try {
      await runMasterPhase();
      await runActivityPhase();
      const failures = getSourceStatuses().filter((s) => s.error).map((s) => s.key);
      logger.info('etl', `carga concluída em ${Math.round((Date.now() - (lastStartedAt ?? Date.now())) / 1000)} s${failures.length ? ` — com falha: ${failures.join(', ')}` : ''}`);
    } finally {
      running = null;
      isFirstRun = false;
    }
  })();
  return running;
}

/** Agenda a próxima carga contando do INÍCIO da anterior: a cadência fica de hora em hora. */
function scheduleNext(): void {
  if (timer) clearTimeout(timer);
  const base = lastStartedAt ?? Date.now();
  const delay = Math.max(30_000, base + appConfig.refreshIntervalMs - Date.now());
  nextRunAt = Date.now() + delay;
  timer = setTimeout(() => {
    void refreshAll().finally(scheduleNext);
  }, delay);
  timer.unref();
}

export function startRefreshScheduler(): void {
  void refreshAll().finally(scheduleNext);
}

export function stopRefreshScheduler(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

export type ManualRefreshResult = 'STARTED' | 'ALREADY_RUNNING' | 'TOO_SOON';

/**
 * Atualização pedida pela tela (só administradores). Tem intervalo mínimo:
 * segurar o botão não pode virar gerador de carga contra o ERP.
 */
export function requestManualRefresh(): ManualRefreshResult {
  if (running) return 'ALREADY_RUNNING';
  if (lastStartedAt && Date.now() - lastStartedAt < MANUAL_REFRESH_MIN_INTERVAL_MS) return 'TOO_SOON';
  void refreshAll().finally(scheduleNext);
  return 'STARTED';
}

export function getRefreshState(): { running: boolean; lastStartedAt: string | null; nextRunAt: string | null; intervalMs: number } {
  return {
    running: running !== null,
    lastStartedAt: lastStartedAt ? new Date(lastStartedAt).toISOString() : null,
    nextRunAt: nextRunAt ? new Date(nextRunAt).toISOString() : null,
    intervalMs: appConfig.refreshIntervalMs,
  };
}

