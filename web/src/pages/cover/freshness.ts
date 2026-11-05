import type { PageDefinition } from '../../components/layout/pages';
import type { DataSourcesState } from '../../services/types';
import { labelInstant, timeAgo } from '../../utils/format';

export interface Freshness {
  text: string;
  title?: string;
  tone: 'ok' | 'loading' | 'error';
}

/**
 * Quando o dado DAQUELA tela foi lido: a leitura mais antiga entre as fontes
 * que ela usa (a mesma regra do "dados lidos" do topo, recortada por tela).
 * Fonte que falhou deixa a tela em vermelho, com a idade da última leitura boa.
 */
export function freshnessOf(page: Pick<PageDefinition, 'sources'>, state: DataSourcesState | undefined): Freshness {
  const keys = page.sources ?? [];
  const statuses = (state?.sources ?? []).filter((s) => keys.includes(s.key));
  if (!state || statuses.length < keys.length || statuses.some((s) => !s.updatedAt && !s.failed)) {
    return { text: state?.refresh.running ? 'carregando os dados…' : 'sem leitura ainda', tone: 'loading' };
  }
  const oldest = statuses.map((s) => s.updatedAt).filter((v): v is string => v !== null).sort()[0] ?? null;
  const failed = statuses.filter((s) => s.failed);
  if (failed.length) {
    // fonte que falhou sem NUNCA ter lido: parte da tela está sem dado, não "velha"
    const neverRead = failed.some((s) => !s.updatedAt);
    return {
      text: !neverRead && oldest ? `falhou · dados de ${timeAgo(oldest)}` : 'falhou na leitura',
      title: `Falhou: ${failed.map((s) => s.label).join(', ')}. A tela mostra a última leitura boa.`,
      tone: 'error',
    };
  }
  return { text: `atualizado ${timeAgo(oldest)}`, title: oldest ? `Lido em ${labelInstant(oldest)}` : undefined, tone: 'ok' };
}
