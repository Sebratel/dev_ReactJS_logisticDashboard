import { getData, httpClient, toApiError } from './httpClient';
import type { DataSourcesState } from './types';

export const dataSourcesKeys = {
  all: ['data-sources'] as const,
};

export const fetchDataSources = (signal?: AbortSignal): Promise<DataSourcesState> => (
  getData<DataSourcesState>('/data-sources', undefined, signal)
);

/** Dispara a recarga das fontes agora (só administradores). */
export async function requestRefresh(): Promise<void> {
  try {
    await httpClient.post('/data-sources/refresh');
  } catch (err) {
    throw toApiError(err);
  }
}
