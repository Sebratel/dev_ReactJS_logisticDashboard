import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { z } from 'zod';
import { appConfig } from '../../config/env.config.js';
import { AppException } from '../errors/app.exception.js';
import { logger } from '../helpers/logger.helper.js';

/**
 * Um arquivo JSON no volume de dados do app (`DATA_PATH`) — o desenho dos
 * cadastros pequenos (controle de estoque, usuários, log de edições), o mesmo
 * dos cadastros da agenda e da dashboard IA:
 *
 *   - gravação atômica (arquivo temporário + rename): JSON cortado no meio
 *     seria dado perdido;
 *   - releitura só quando o arquivo mudou (data de modificação + tamanho);
 *   - arquivo ilegível LANÇA em vez de virar vazio: tratar como vazio deixaria
 *     a próxima gravação apagar tudo por causa de um defeito recuperável à mão.
 */
export interface JsonFileStore<T> {
  read(): T;
  write(value: T): T;
  path(): string;
}

interface JsonFileStoreOptions<T> {
  fileName: string;
  schema: z.ZodType<T>;
  /** valor de quando o arquivo ainda não existe */
  initial: () => T;
  /** grava o valor inicial no primeiro uso (ex.: a semente do controle de estoque) */
  persistInitial?: boolean;
  /** rótulo do log e código/mensagem do erro de arquivo ilegível */
  label: string;
  unreadableCode: string;
  unreadableMessage: string;
}

export function createJsonFileStore<T>(options: JsonFileStoreOptions<T>): JsonFileStore<T> {
  let cache: { file: string; mtimeMs: number; size: number; value: T } | null = null;
  const path = () => join(appConfig.dataPath, options.fileName);

  const write = (value: T): T => {
    const file = path();
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(value, null, 1), 'utf8');
    renameSync(tmp, file);
    const { mtimeMs, size } = statSync(file);
    cache = { file, mtimeMs, size, value };
    return value;
  };

  const read = (): T => {
    const file = path();
    if (!existsSync(file)) {
      const value = options.initial();
      return options.persistInitial ? write(value) : value;
    }
    const { mtimeMs, size } = statSync(file);
    if (cache && cache.file === file && cache.mtimeMs === mtimeMs && cache.size === size) return cache.value;
    try {
      const value = options.schema.parse(JSON.parse(readFileSync(file, 'utf8')));
      cache = { file, mtimeMs, size, value };
      return value;
    } catch (err) {
      logger.error(options.label, `${file} ilegível (${err instanceof Error ? err.message : String(err)}) — nenhuma gravação até ele ser corrigido`);
      throw new AppException(500, options.unreadableCode, options.unreadableMessage);
    }
  };

  return { read, write, path };
}
