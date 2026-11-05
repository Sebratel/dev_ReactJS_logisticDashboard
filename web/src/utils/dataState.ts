import type { DataSourcesState } from '../services/types';

export interface DataState {
  /** leitura bem-sucedida mais antiga entre as fontes consideradas */
  dataAsOf: string | null;
  failed: boolean;
  /** maior intervalo de releitura entre elas — a régua do "atrasado" */
  intervalMs: number | null;
}

/**
 * Idade do dado que o topo mostra: a da TELA aberta (as fontes dela). Numa
 * tela ao vivo é a leitura de minuto em minuto; nas outras, a carga horária.
 * Sem fontes declaradas (capa, administração), vale o painel inteiro.
 */
export function dataStateOf(keys: readonly string[] | undefined, state: DataSourcesState | undefined): DataState {
  const all = state?.sources ?? [];
  const scoped = keys?.length ? all.filter((s) => keys.includes(s.key)) : all;
  // fonte da tela que ainda não apareceu: "carregando", e não a idade das outras
  const complete = !keys?.length || scoped.length === keys.length;
  const read = scoped.map((s) => s.updatedAt).filter((v): v is string => v !== null).sort();
  const intervals = scoped.map((s) => s.intervalMs).filter((v): v is number => v !== null);
  return {
    dataAsOf: complete ? read[0] ?? null : null,
    failed: scoped.some((s) => s.failed),
    intervalMs: intervals.length ? Math.max(...intervals) : state?.refresh.intervalMs ?? null,
  };
}

/** 60_000 -> 'a cada minuto'; 3_600_000 -> 'de hora em hora'. */
export function cadenceLabel(intervalMs: number | null): string {
  if (!intervalMs) return 'automática';
  if (intervalMs < 60_000) return `a cada ${Math.round(intervalMs / 1000)} s`;
  if (intervalMs === 60_000) return 'a cada minuto';
  if (intervalMs < 3_600_000) return `a cada ${Math.round(intervalMs / 60_000)} min`;
  if (intervalMs === 3_600_000) return 'de hora em hora';
  return `a cada ${Math.round(intervalMs / 3_600_000)} h`;
}
