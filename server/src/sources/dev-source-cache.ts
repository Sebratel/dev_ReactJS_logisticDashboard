import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { appConfig } from '../config/env.config.js';
import { logger } from '../common/helpers/logger.helper.js';

/**
 * Cache das fontes em disco — SÓ PARA DESENVOLVIMENTO.
 *
 * Sem ele, cada reinício do servidor local relê ~1,7 milhão de linhas do
 * Voalle de produção (~9 minutos, a view de alocações sozinha leva 7). Com
 * `DEV_SOURCE_CACHE_DIR` definido, cada fonte lida é gravada em NDJSON e, no
 * próximo boot, reaproveitada se tiver menos de uma hora.
 *
 * Em produção isto não liga nem com a variável definida: lá o dado tem de vir
 * da fonte, e um arquivo esquecido no volume não pode virar "dado atual".
 */
const dir = process.env.DEV_SOURCE_CACHE_DIR ? resolve(process.env.DEV_SOURCE_CACHE_DIR) : null;
export const devCacheEnabled = Boolean(dir) && !appConfig.isProduction;

const fileOf = (key: string): string => join(dir ?? '', `${key}.ndjson`);

export async function readDevCache<T>(key: string): Promise<T[] | null> {
  if (!devCacheEnabled) return null;
  const file = fileOf(key);
  if (!existsSync(file)) return null;
  if (Date.now() - statSync(file).mtimeMs > appConfig.refreshIntervalMs) return null;
  const rows: T[] = [];
  const lines = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
  for await (const line of lines) if (line) rows.push(JSON.parse(line) as T);
  logger.info('etl', `${key}: ${rows.length} linhas do cache de desenvolvimento`);
  return rows;
}

export async function writeDevCache<T>(key: string, rows: T[]): Promise<void> {
  if (!devCacheEnabled || !dir) return;
  mkdirSync(dir, { recursive: true });
  const stream = createWriteStream(fileOf(key), 'utf8');
  for (const row of rows) {
    // há títulos de produto no Voalle com U+2028/U+2029: o JSON aceita os dois
    // crus, mas o readline os trata como fim de linha e partiria o registro
    const line = JSON.stringify(row).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    if (!stream.write(`${line}\n`)) await once(stream, 'drain');
  }
  stream.end();
  await once(stream, 'finish');
}
