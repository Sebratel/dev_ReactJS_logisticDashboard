import mysql from 'mysql2/promise';
import { appConfig, hasMaria } from '../config/env.config.js';

/**
 * Cliente do MariaDB corporativo (base de colaboradores da Senior).
 * Só leitura; uma conexão basta para a única consulta horária.
 */
let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!hasMaria) throw new Error('MariaDB não configurado (DB_MARIA_*)');
  if (!pool) {
    const { maria } = appConfig;
    pool = mysql.createPool({
      host: maria.host,
      port: maria.port,
      user: maria.user,
      password: maria.password,
      database: maria.database,
      connectionLimit: 2,
      waitForConnections: true,
      connectTimeout: 20_000,
      // mesmo cuidado do Voalle: conexão parada entre as cargas não pode ser derrubada pelo caminho
      enableKeepAlive: true,
      keepAliveInitialDelay: 30_000,
      charset: 'utf8mb4',
      dateStrings: true,
    });
  }
  return pool;
}

export async function queryMaria<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await getPool().query(sql, params);
  return rows as T[];
}

export async function closeMaria(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
