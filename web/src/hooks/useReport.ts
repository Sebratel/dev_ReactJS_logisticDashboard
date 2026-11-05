import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AUTO_REFRESH_MS } from '../config';
import { fetchReport, reportKeys, type ReportName, type ReportQuery } from '../services/reportsService';

/**
 * Uma chamada por tela. `keepPreviousData` mantém o painel anterior enquanto o
 * novo recorte chega (sem piscar em branco a cada clique), e o `signal` cancela
 * a requisição velha quando o filtro muda em rajada — sem isso a resposta da
 * penúltima seleção poderia chegar depois da última.
 */
export function useReport<N extends ReportName>(name: N, query: ReportQuery, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: reportKeys.report(name, query),
    queryFn: ({ signal }) => fetchReport(name, query, signal),
    placeholderData: keepPreviousData,
    refetchInterval: AUTO_REFRESH_MS,
    enabled,
  });
}
