import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SQL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'sources', 'sql');
const cache = new Map<string, string>();

/** Lê `sources/sql/<name>.sql` uma vez e guarda em memória. */
export function loadSql(name: string): string {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`nome de consulta inválido: ${name}`);
  let sql = cache.get(name);
  if (sql === undefined) {
    sql = readFileSync(join(SQL_DIR, `${name}.sql`), 'utf8');
    cache.set(name, sql);
  }
  return sql;
}
