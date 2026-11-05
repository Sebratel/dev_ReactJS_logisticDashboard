import { createHash } from 'node:crypto';
import { appConfig } from '../config/env.config.js';
import { logger } from '../common/helpers/logger.helper.js';
import { buildItemBalances, buildPurchaseOrders } from '../model/builders/purchasing.builder.js';
import { getPurchasingModel, publishPurchasing } from '../model/model.store.js';
import type { PurchasingModel } from '../model/model.types.js';
import { runSource, type RunSourceOptions } from './refresh.job.js';
import { SOURCES } from './source.registry.js';

/**
 * Carga "ao vivo" — as fontes da tela de Compras (lançamento e saldos), lidas
 * a cada minuto, fora da carga horária.
 *
 * São duas consultas leves (~1 s as duas, medido em 04/11/2026) e rodam em
 * SEQUÊNCIA, numa conexão só: a carga horária chega a prender duas conexões
 * por minutos, e o pool tem três. Fonte que falha mantém a tabela anterior —
 * a tela segue com a última leitura boa e a capa/topo mostram a falha.
 *
 * Só publica versão nova quando o dado MUDOU: a tela confere a versão a cada
 * 15 s (`/data-sources`, resposta pequena) e só baixa as tabelas quando ela
 * muda. Fora do expediente, nada muda e ninguém baixa nada.
 */
export const LIVE_SOURCE_KEYS: readonly string[] = Object.values(SOURCES)
  .filter((s) => s.phase === 'LIVE')
  .map((s) => s.key);

const LIVE_OPTIONS: RunSourceOptions = { devCache: false, quiet: true };
/** folga mínima entre o fim de uma rodada e o início da próxima */
const MIN_GAP_MS = 5_000;

let running: Promise<void> | null = null;
let timer: NodeJS.Timeout | null = null;
let lastStartedAt: number | null = null;
let nextRunAt: number | null = null;
let stopped = true;
/** impressão digital da última leitura publicada de cada fonte */
const published = new Map<string, string>();

/** Impressão digital de uma leitura: duas leituras iguais têm a mesma. */
export function fingerprint(rows: readonly unknown[]): string {
  return createHash('sha1').update(JSON.stringify(rows)).digest('hex');
}

/** Impressão digital da leitura, se ela é diferente da última publicada; null se veio igual (ou falhou). */
function newPrint(key: string, rows: readonly unknown[] | null): string | null {
  if (!rows) return null;
  const print = fingerprint(rows);
  return published.get(key) === print ? null : print;
}

export function refreshLive(): Promise<void> {
  if (running) return running;
  lastStartedAt = Date.now();
  running = (async () => {
    try {
      const balances = await runSource(SOURCES.itemBalances, LIVE_OPTIONS);
      const orders = await runSource(SOURCES.purchaseOrders, LIVE_OPTIONS);
      const balancesPrint = newPrint(SOURCES.itemBalances.key, balances);
      const ordersPrint = newPrint(SOURCES.purchaseOrders.key, orders);
      const changes: Partial<Pick<PurchasingModel, 'itemBalances' | 'purchaseOrders'>> = {};
      if (balances && balancesPrint) changes.itemBalances = buildItemBalances(balances);
      if (orders && ordersPrint) changes.purchaseOrders = buildPurchaseOrders(orders);
      if (changes.itemBalances || changes.purchaseOrders) {
        publishPurchasing(changes);
        // só depois de publicar: se a montagem falhar, a próxima rodada tenta de novo
        if (balancesPrint) published.set(SOURCES.itemBalances.key, balancesPrint);
        if (ordersPrint) published.set(SOURCES.purchaseOrders.key, ordersPrint);
      }
    } catch (err) {
      // runSource não lança; isto é a montagem das tabelas — registra e segue na próxima rodada
      logger.error('etl', `carga ao vivo falhou: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Próxima rodada contada do INÍCIO da anterior: a cadência fica de minuto em minuto, sem encavalar. */
function scheduleNext(): void {
  if (stopped) return;
  const delay = Math.max(MIN_GAP_MS, (lastStartedAt ?? Date.now()) + appConfig.liveRefreshIntervalMs - Date.now());
  nextRunAt = Date.now() + delay;
  timer = setTimeout(() => {
    void refreshLive().finally(scheduleNext);
  }, delay);
  timer.unref();
}

export function startLiveRefresh(): void {
  stopped = false;
  void refreshLive().finally(scheduleNext);
}

export function stopLiveRefresh(): void {
  stopped = true;
  if (timer) clearTimeout(timer);
  timer = null;
}

export function getLiveRefreshState(): {
  running: boolean; lastStartedAt: string | null; nextRunAt: string | null; intervalMs: number; version: number;
} {
  return {
    running: running !== null,
    lastStartedAt: lastStartedAt ? new Date(lastStartedAt).toISOString() : null,
    nextRunAt: nextRunAt ? new Date(nextRunAt).toISOString() : null,
    intervalMs: appConfig.liveRefreshIntervalMs,
    // muda só quando o dado da tela de Compras mudou: é o sinal para a tela baixar de novo
    version: getPurchasingModel().version,
  };
}
