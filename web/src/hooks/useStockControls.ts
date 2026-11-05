import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dataSourcesKeys } from '../services/dataSourcesService';
import { ApiError } from '../services/httpClient';
import {
  createStockControl, deleteStockControl, fetchProduct, fetchStockControls, stockControlKeys, updateStockControl,
} from '../services/stockControlsService';
import type { StockControlInput } from '../services/types';

export function useStockControls() {
  return useQuery({
    queryKey: stockControlKeys.all,
    queryFn: ({ signal }) => fetchStockControls(signal),
  });
}

/**
 * Depois de gravar: a lista, as telas de alerta (mínimo, alerta e categoria
 * mudaram) e a situação das fontes são relidas.
 */
function useInvalidateAfterWrite() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: stockControlKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['reports'] }),
    queryClient.invalidateQueries({ queryKey: dataSourcesKeys.all }),
  ]);
}

export function useSaveStockControl() {
  const invalidate = useInvalidateAfterWrite();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: StockControlInput }) => (
      id ? updateStockControl(id, input) : createStockControl(input)
    ),
    onSuccess: invalidate,
  });
}

export function useDeleteStockControl() {
  const invalidate = useInvalidateAfterWrite();
  return useMutation({
    mutationFn: (id: string) => deleteStockControl(id),
    onSuccess: invalidate,
  });
}

/** Produto no saldo do Voalle; 404 vira `null` ("não aparece no saldo"), não erro. */
export function useProductLookup(code: number | null) {
  return useQuery({
    queryKey: stockControlKeys.product(code ?? 0),
    queryFn: async ({ signal }) => {
      try {
        return await fetchProduct(code ?? 0, signal);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: code !== null,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
