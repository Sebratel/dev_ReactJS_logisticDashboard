import { fileNameFrom, saveBlob } from '../utils/download';
import { todayIso } from '../utils/format';
import { getData, httpClient, toApiError } from './httpClient';
import type { ProductLookup, StockControl, StockControlInput, StockControlList } from './types';

/**
 * Cadastro de controle de estoque (o que era a planilha "Controle Estoque").
 * Fica no servidor: o que se grava aqui vale na hora para todo mundo.
 */
export const stockControlKeys = {
  all: ['stock-controls'] as const,
  product: (code: number) => ['products', code] as const,
};

interface ListEnvelope {
  data: StockControl[];
  meta: { total: number; limit: number; updatedAt: string | null };
}

export async function fetchStockControls(signal?: AbortSignal): Promise<StockControlList> {
  try {
    const { data } = await httpClient.get<ListEnvelope>('/stock-controls', { signal });
    return { items: data.data, ...data.meta };
  } catch (err) {
    throw toApiError(err);
  }
}

export async function createStockControl(input: StockControlInput): Promise<StockControl> {
  try {
    const { data } = await httpClient.post<{ data: StockControl }>('/stock-controls', input);
    return data.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function updateStockControl(id: string, input: StockControlInput): Promise<StockControl> {
  try {
    const { data } = await httpClient.put<{ data: StockControl }>(`/stock-controls/${encodeURIComponent(id)}`, input);
    return data.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function deleteStockControl(id: string): Promise<void> {
  try {
    await httpClient.delete(`/stock-controls/${encodeURIComponent(id)}`);
  } catch (err) {
    throw toApiError(err);
  }
}

export async function downloadStockControls(): Promise<void> {
  try {
    const response = await httpClient.get<Blob>('/stock-controls/export', { responseType: 'blob' });
    const disposition = response.headers['content-disposition'] as string | undefined;
    saveBlob(fileNameFrom(disposition, `controle-estoque_${todayIso()}.csv`), response.data);
  } catch (err) {
    throw toApiError(err);
  }
}

/** Descrição e bases do produto no saldo do Voalle — o formulário mostra enquanto a pessoa digita o código. */
export const fetchProduct = (code: number, signal?: AbortSignal): Promise<ProductLookup> => (
  getData<ProductLookup>(`/products/${code}`, undefined, signal)
);
