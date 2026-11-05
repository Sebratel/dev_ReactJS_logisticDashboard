import pg from 'pg';
import { appConfig, hasVoalle } from '../config/env.config.js';
import { logger } from '../common/helpers/logger.helper.js';

/**
 * Cliente do Voalle (PostgreSQL de produção de OUTRO sistema).
 *
 * Três cuidados, todos contra o mesmo risco — atrapalhar o ERP:
 *   - pool pequeno (padrão 3): a carga é horária e roda poucas consultas;
 *   - toda consulta roda em `BEGIN READ ONLY`, então nem por engano esta
 *     aplicação escreve no banco;
 *   - `application_name` próprio, para quem cuida do ERP reconhecer a carga no
 *     pg_stat_activity sem adivinhar de onde ela vem.
 */

// datas e timestamps chegam como texto, sem conversão de fuso: o modelo
// trabalha na data civil do Voalle, como o Power BI
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (v) => v);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v) => v);
// numeric e bigint como número: quantidades e ids cabem com folga em 2^53
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)));

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!hasVoalle) throw new Error('Voalle não configurado (DB_VOALLE_* / DB_ELLEVEN_*)');
  if (!pool) {
    const { voalle } = appConfig;
    pool = new pg.Pool({
      host: voalle.host,
      port: voalle.port,
      database: voalle.database,
      user: voalle.user,
      password: voalle.password,
      max: voalle.poolMax,
      // com TLS ligado o certificado é verificado — sem atalho de aceitar qualquer um
      ssl: voalle.ssl ? { rejectUnauthorized: true } : undefined,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 60_000,
      // as consultas pesadas ficam minutos sem trafegar nada enquanto o banco
      // calcula; firewall/NAT no caminho derruba conexão "parada" — o keepalive
      // do TCP mantém a conexão viva aos olhos deles
      keepAlive: true,
      keepAliveInitialDelayMillis: 30_000,
      application_name: 'logistic-dashboard',
      ...(voalle.schema ? { options: `-c search_path=${voalle.schema}` } : {}),
    });
    pool.on('error', (err) => logger.error('voalle', `erro no pool: ${err.message}`));
  }
  return pool;
}

/**
 * Executa uma consulta de leitura com teto de tempo próprio.
 *
 * Conexão que cai NO MEIO da consulta (rede, firewall, reinício do banco): o
 * `pg` rejeita a consulta E emite 'error' no client. Enquanto a conexão está em
 * uso, o pool não escuta esse evento — sem o ouvinte abaixo ele virava exceção
 * não capturada e derrubava o processo inteiro (aconteceu em 04/11/2026). Com
 * ele, a fonte só falha, a carga segue e a tela mantém o dado anterior; a
 * conexão quebrada é descartada em vez de voltar ao pool.
 */
export async function queryVoalle<T extends pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  timeoutMs = appConfig.queryTimeoutMs,
): Promise<T[]> {
  const client = await getPool().connect();
  let broken: Error | undefined;
  const onError = (err: Error) => {
    broken = err;
    logger.warn('voalle', `conexão caiu durante a consulta: ${err.message}`);
  };
  client.on('error', onError);
  let discard: Error | undefined;
  try {
    await client.query('BEGIN READ ONLY');
    // SET LOCAL vale só dentro da transação: a conexão volta ao pool limpa
    await client.query(`SET LOCAL statement_timeout = ${Math.max(1000, Math.round(timeoutMs))}`);
    const result = await client.query<T>(sql, params);
    await client.query('COMMIT');
    return result.rows;
  } catch (err) {
    // conexão morta não tem o que desfazer; viva, desfaz — e se nem isso der, não volta ao pool
    if (!broken) await client.query('ROLLBACK').catch((e: Error) => { discard = e; });
    throw err;
  } finally {
    // conexão quebrada fica com o ouvinte (vai ser destruída); a saudável volta ao pool sem ele
    if (!broken) client.removeListener('error', onError);
    client.release(broken ?? discard);
  }
}

export async function closeVoalle(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
