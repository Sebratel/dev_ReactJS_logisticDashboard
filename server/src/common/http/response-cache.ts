/**
 * Cache curto de respostas de relatório, chaveado por (versão do modelo, rota,
 * query normalizada). Carga nova muda a versão e invalida tudo sozinha.
 *
 * Os dados são os mesmos para qualquer usuário autenticado (não há recorte por
 * pessoa nesta dashboard), então a chave não precisa do usuário. Se um dia
 * entrar escopo por usuário, ele TEM de entrar na chave.
 */
const MAX_ENTRIES = 200;
const entries = new Map<string, unknown>();

export function cacheKey(version: number, route: string, query: Record<string, unknown>): string {
  const sorted = Object.keys(query).sort().map((k) => `${k}=${String(query[k])}`).join('&');
  return `${version}|${route}|${sorted}`;
}

export function getCached<T>(key: string): T | undefined {
  const value = entries.get(key);
  if (value === undefined) return undefined;
  // LRU: reinsere para ir ao fim da fila
  entries.delete(key);
  entries.set(key, value);
  return value as T;
}

export function setCached(key: string, value: unknown): void {
  entries.set(key, value);
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}
