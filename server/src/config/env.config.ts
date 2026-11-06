import { existsSync } from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Carga das variáveis de ambiente.
 *
 * Ordem de procura (o primeiro valor encontrado vence — dotenv nunca sobrescreve
 * o que já está no ambiente, então o Docker/Portainer sempre ganha):
 *
 *   1. `ENV_FILE`, quando definido;
 *   2. `.env` na raiz do projeto e em `server/`;
 *   3. FORA de produção, os `.env` dos diretórios acima do projeto.
 *
 * O item 3 existe porque as credenciais de desenvolvimento ficam num `.env`
 * compartilhado da pasta de trabalho (um nível acima dos repositórios), e não
 * dentro de cada projeto. Em produção ele fica desligado: lá nada deve vir de
 * arquivo esquecido no disco do host.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
// src/config (ou dist/config) -> server -> raiz do projeto
const SERVER_ROOT = resolve(HERE, '..', '..');
const PROJECT_ROOT = resolve(SERVER_ROOT, '..');

function envFileCandidates(): string[] {
  const files: string[] = [];
  if (process.env.ENV_FILE) files.push(resolve(process.env.ENV_FILE));
  files.push(join(PROJECT_ROOT, '.env'), join(SERVER_ROOT, '.env'));
  if (process.env.NODE_ENV !== 'production') {
    let dir = dirname(PROJECT_ROOT);
    const { root } = parse(dir);
    while (dir && dir !== root) {
      files.push(join(dir, '.env'));
      dir = dirname(dir);
    }
  }
  return files;
}

const loadedEnvFiles: string[] = [];
for (const file of envFileCandidates()) {
  if (existsSync(file)) {
    dotenv.config({ path: file });
    loadedEnvFiles.push(file);
  }
}

/** Lê a primeira variável definida (e não vazia) de uma lista de nomes alternativos. */
function pick(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value.trim() !== '') return value.trim();
  }
  return undefined;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato AAAA-MM-DD');
const booleanFlag = z
  .string()
  .optional()
  .transform((v) => (v === undefined ? undefined : !['false', '0', 'no', 'off'].includes(v.toLowerCase())));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  // 127.0.0.1 para rodar local sem expor o painel na rede; no contêiner, todas as interfaces
  HOST: z.string().default('0.0.0.0'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  PUBLIC_DIR: z.string().optional(),

  // Voalle (PostgreSQL) — no Power BI era o DSN "dbVoalle"
  DB_VOALLE_HOST: z.string().optional(),
  DB_VOALLE_PORT: z.coerce.number().int().default(5432),
  DB_VOALLE_DATABASE: z.string().optional(),
  DB_VOALLE_USER: z.string().optional(),
  DB_VOALLE_PASSWORD: z.string().optional(),
  DB_VOALLE_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/i).optional(),
  DB_VOALLE_POOL_MAX: z.coerce.number().int().min(1).max(10).default(3),
  DB_VOALLE_SSL: booleanFlag,

  // MariaDB — no Power BI era o DSN "dbMaria" (base de colaboradores da Senior)
  DB_MARIA_HOST: z.string().optional(),
  DB_MARIA_PORT: z.coerce.number().int().default(3306),
  DB_MARIA_DATABASE: z.string().optional(),
  DB_MARIA_USER: z.string().optional(),
  DB_MARIA_PASSWORD: z.string().optional(),

  // Teto de UMA consulta. A view de produtos alocados do Voalle passa de 2 min.
  QUERY_TIMEOUT_MS: z.coerce.number().int().min(10_000).default(900_000),
  // Atualização dos dados: de hora em hora, como pedido para esta fase.
  REFRESH_INTERVAL_MS: z.coerce.number().int().min(60_000).default(3_600_000),
  // Carga "ao vivo" da tela de Compras (lançamento e saldos): a cada minuto.
  // São duas consultas leves; o piso de 30 s protege o ERP de um valor errado na stack.
  LIVE_REFRESH_INTERVAL_MS: z.coerce.number().int().min(30_000).default(60_000),
  // tela do laboratório: relida a cada 3 horas (a carga horária pula as fontes dela no meio)
  LAB_REFRESH_INTERVAL_MS: z.coerce.number().int().min(60_000).default(10_800_000),

  // Recortes de data — os mesmos escritos nas consultas do Power BI
  CONSUMPTION_SINCE: isoDate.default('2024-01-01'),
  PRODUCT_PACKING_SINCE: isoDate.default('2025-01-01'),
  PATRIMONY_PACKING_SINCE: isoDate.default('2026-01-01'),
  PATRIMONY_NOTES_SINCE: isoDate.default('2024-01-01'),
  PURCHASE_ORDERS_SINCE: isoDate.default('2026-01-01'),
  // tela de equipamentos para campo: o Power BI "CTR" só mostrava de 2025 em diante
  FIELD_EQUIPMENT_SINCE: isoDate.default('2025-01-01'),

  // Onde a aplicação grava o que é dela (cadastro de controle de estoque).
  // No Docker é um volume: sem ele, recriar o contêiner apaga o cadastro.
  DATA_PATH: z.string().optional(),

  // Autenticação (login com Google)
  AUTH_ENABLED: booleanFlag,
  GOOGLE_CLIENT_ID: z.string().optional(),
  ALLOWED_DOMAIN: z.string().default('sebratel.com.br'),
  // administradores "de fábrica": só valem enquanto não houver NENHUM admin
  // salvo no cadastro de usuários (instalação nova) — depois disso, quem decide
  // papel é a tela de Administração
  // vazio (variável da stack em branco) também cai no padrão: instalação sem admin ninguém administra
  ADMIN_EMAILS: z.string().optional().transform((v) => (v?.trim() ? v : 'gustavo.santos@sebratel.com.br')),
});

const parsed = EnvSchema.safeParse({
  ...process.env,
  // só PORT: o API_PORT do .env compartilhado é de outro projeto (e colidiria com ele)
  PORT: pick('PORT'),
  DB_VOALLE_HOST: pick('DB_VOALLE_HOST', 'DB_ELLEVEN_HOST'),
  DB_VOALLE_PORT: pick('DB_VOALLE_PORT', 'DB_ELLEVEN_PORT'),
  DB_VOALLE_DATABASE: pick('DB_VOALLE_DATABASE', 'DB_ELLEVEN_DATABASE'),
  DB_VOALLE_USER: pick('DB_VOALLE_USER', 'DB_ELLEVEN_USER'),
  DB_VOALLE_PASSWORD: pick('DB_VOALLE_PASSWORD', 'DB_ELLEVEN_PASSWORD'),
  DB_VOALLE_SCHEMA: pick('DB_VOALLE_SCHEMA', 'DB_ELLEVEN_SCHEMA'),
  DB_VOALLE_SSL: pick('DB_VOALLE_SSL', 'DB_ELLEVEN_SSL'),
  // o ID do cliente OAuth é público (vai para o navegador de qualquer jeito);
  // aceitar o nome com prefixo VITE_ evita duplicar a mesma chave no .env
  GOOGLE_CLIENT_ID: pick('GOOGLE_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID'),
});

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Variáveis de ambiente inválidas — ${problems}`);
}

const env = parsed.data;

const emailList = (value: string): string[] => value.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

const authEnabled = env.AUTH_ENABLED ?? true;

export const appConfig = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  host: env.HOST,
  trustProxy: env.TRUST_PROXY,
  publicDir: env.PUBLIC_DIR ? resolve(env.PUBLIC_DIR) : join(SERVER_ROOT, 'public'),
  loadedEnvFiles,

  voalle: {
    host: env.DB_VOALLE_HOST,
    port: env.DB_VOALLE_PORT,
    database: env.DB_VOALLE_DATABASE,
    user: env.DB_VOALLE_USER,
    password: env.DB_VOALLE_PASSWORD,
    schema: env.DB_VOALLE_SCHEMA,
    poolMax: env.DB_VOALLE_POOL_MAX,
    ssl: env.DB_VOALLE_SSL ?? false,
  },
  maria: {
    host: env.DB_MARIA_HOST,
    port: env.DB_MARIA_PORT,
    database: env.DB_MARIA_DATABASE,
    user: env.DB_MARIA_USER,
    password: env.DB_MARIA_PASSWORD,
  },

  queryTimeoutMs: env.QUERY_TIMEOUT_MS,
  refreshIntervalMs: env.REFRESH_INTERVAL_MS,
  liveRefreshIntervalMs: env.LIVE_REFRESH_INTERVAL_MS,
  labRefreshIntervalMs: env.LAB_REFRESH_INTERVAL_MS,

  since: {
    consumption: env.CONSUMPTION_SINCE,
    productPacking: env.PRODUCT_PACKING_SINCE,
    patrimonyPacking: env.PATRIMONY_PACKING_SINCE,
    patrimonyNotes: env.PATRIMONY_NOTES_SINCE,
    purchaseOrders: env.PURCHASE_ORDERS_SINCE,
    fieldEquipment: env.FIELD_EQUIPMENT_SINCE,
  },

  dataPath: env.DATA_PATH ? resolve(env.DATA_PATH) : join(SERVER_ROOT, 'data'),

  auth: {
    // sem o ID do cliente não existe login: subir "habilitado" sem ele travaria
    // todo mundo do lado de fora sem dizer por quê
    enabled: authEnabled && Boolean(env.GOOGLE_CLIENT_ID),
    requested: authEnabled,
    clientId: env.GOOGLE_CLIENT_ID ?? '',
    allowedDomain: env.ALLOWED_DOMAIN.toLowerCase().replace(/^@/, ''),
    bootstrapAdminEmails: emailList(env.ADMIN_EMAILS),
  },
} as const;

export const hasVoalle = Boolean(appConfig.voalle.host && appConfig.voalle.database && appConfig.voalle.user);
export const hasMaria = Boolean(appConfig.maria.host && appConfig.maria.user);
