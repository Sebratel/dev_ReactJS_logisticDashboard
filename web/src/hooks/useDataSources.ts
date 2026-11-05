import { useQuery } from '@tanstack/react-query';
import { LIVE_STATUS_POLL_MS } from '../config';
import { dataSourcesKeys, fetchDataSources } from '../services/dataSourcesService';

/**
 * Situação das fontes: alimenta o "atualizado há…" do topo e a capa.
 * `fast`: tela com dado ao vivo (Compras) — o topo acompanha a leitura de minuto em minuto.
 */
export function useDataSources({ fast = false }: { fast?: boolean } = {}) {
  return useQuery({
    queryKey: dataSourcesKeys.all,
    queryFn: ({ signal }) => fetchDataSources(signal),
    refetchInterval: (query) => (fast ? LIVE_STATUS_POLL_MS : query.state.data?.refresh.running ? 15_000 : 60_000),
  });
}
