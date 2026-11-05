import { describe, expect, it } from 'vitest';
import type { DataSourcesState, SourceInfo } from '../../services/types';
import { freshnessOf } from './freshness';

const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();

const source = (key: string, minutes: number | null, failed = false): SourceInfo => ({
  key, label: key, origin: 'VOALLE', rows: 1, durationMs: 1, updatedAt: minutes === null ? null : minutesAgo(minutes), failed,
  intervalMs: 3_600_000,
});

const state = (sources: SourceInfo[], running = false): DataSourcesState => ({
  builtAt: null, dataAsOf: null, modelVersion: 1, stockControlAvailable: true,
  refresh: { running, lastStartedAt: null, nextRunAt: null, intervalMs: 3_600_000 },
  live: { running: false, lastStartedAt: null, nextRunAt: null, intervalMs: 60_000, version: 1 }, sources,
});

const page = { sources: ['a', 'b'] };

describe('hora do dado por tela (capa)', () => {
  it('usa a leitura MAIS ANTIGA entre as fontes da tela', () => {
    const f = freshnessOf(page, state([source('a', 5), source('b', 40), source('outra', 300)]));
    expect(f).toMatchObject({ tone: 'ok', text: 'atualizado há 40 min' });
  });

  it('fonte que ainda não chegou deixa a tela carregando', () => {
    expect(freshnessOf(page, state([source('a', 5)], true))).toMatchObject({ tone: 'loading', text: 'carregando os dados…' });
    expect(freshnessOf(page, undefined).tone).toBe('loading');
  });

  it('fonte que falhou fica em vermelho, com a idade da última leitura boa', () => {
    const f = freshnessOf(page, state([source('a', 5), source('b', 90, true)]));
    expect(f.tone).toBe('error');
    expect(f.text).toBe('falhou · dados de há 1h30');
    expect(f.title).toContain('Falhou: b');
  });

  it('fonte que falhou sem nunca ter lido', () => {
    expect(freshnessOf(page, state([source('a', 5), source('b', null, true)])).text).toBe('falhou na leitura');
  });
});
