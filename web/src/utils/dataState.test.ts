import { describe, expect, it } from 'vitest';
import type { DataSourcesState, SourceInfo } from '../services/types';
import { cadenceLabel, dataStateOf } from './dataState';

const source = (key: string, updatedAt: string | null, intervalMs: number | null, failed = false): SourceInfo => ({
  key, label: key, origin: 'VOALLE', rows: 1, durationMs: 1, updatedAt, failed, intervalMs,
});

const state = (sources: SourceInfo[]): DataSourcesState => ({
  builtAt: null,
  dataAsOf: null,
  modelVersion: 1,
  stockControlAvailable: true,
  refresh: { running: false, lastStartedAt: null, nextRunAt: null, intervalMs: 3_600_000 },
  live: { running: false, lastStartedAt: null, nextRunAt: null, intervalMs: 60_000, version: 1 },
  sources,
});

const STATE = state([
  source('stockBalances', '2026-11-04T17:00:00.000Z', 3_600_000),
  source('itemBalances', '2026-11-04T18:00:10.000Z', 60_000),
  source('purchaseOrders', '2026-11-04T18:00:11.000Z', 60_000),
]);

describe('dataStateOf — a idade do dado que o topo mostra', () => {
  it('tela ao vivo: só as fontes dela, com a régua de um minuto', () => {
    expect(dataStateOf(['itemBalances', 'purchaseOrders'], STATE)).toEqual({
      dataAsOf: '2026-11-04T18:00:10.000Z', failed: false, intervalMs: 60_000,
    });
  });

  it('sem fontes declaradas: o painel inteiro, pela leitura mais antiga', () => {
    expect(dataStateOf(undefined, STATE)).toMatchObject({ dataAsOf: '2026-11-04T17:00:00.000Z', intervalMs: 3_600_000 });
  });

  it('fonte da tela que ainda não apareceu deixa a tela "carregando"', () => {
    expect(dataStateOf(['itemBalances', 'naoLida'], STATE).dataAsOf).toBeNull();
  });

  it('falha numa fonte da tela marca a tela; falha em outra não', () => {
    const failing = state([...STATE.sources, source('senior', null, 3_600_000, true)]);
    expect(dataStateOf(['itemBalances', 'purchaseOrders'], failing).failed).toBe(false);
    expect(dataStateOf(undefined, failing).failed).toBe(true);
  });
});

describe('cadenceLabel', () => {
  it('escreve a cadência por extenso', () => {
    expect(cadenceLabel(60_000)).toBe('a cada minuto');
    expect(cadenceLabel(3_600_000)).toBe('de hora em hora');
    expect(cadenceLabel(300_000)).toBe('a cada 5 min');
    expect(cadenceLabel(null)).toBe('automática');
  });
});
