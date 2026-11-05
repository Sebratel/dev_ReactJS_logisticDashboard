import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { logger } from '../../common/helpers/logger.helper.js';
import { createJsonFileStore } from '../../common/storage/json-file.store.js';
import type { StockControlEntity } from './stock-control.entity.js';

/**
 * Persistência do cadastro de controle de estoque — mesmo desenho do cadastro
 * de supervisores do projeto da agenda: um arquivo JSON no volume de dados.
 * São ~800 itens que mudam algumas vezes por semana e precisam sobreviver a
 * reinício e a deploy; banco próprio seria peso sem ganho.
 *
 *   { "items": [StockControlEntity], "updatedAt": "ISO 8601" }
 *
 * No primeiro boot (arquivo ainda não existe) o cadastro nasce da semente
 * gerada a partir da planilha oficial "ALERTA ESTOQUE - LOGÍSTICA".
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const SEED_FILE = join(HERE, 'seed', 'stock-controls.seed.json');
const SEED_AUTHOR = 'Planilha oficial (importação inicial)';

export interface StockControlStore {
  items: StockControlEntity[];
  updatedAt: string | null;
}

const EntitySchema = z.object({
  id: z.string().min(1),
  code: z.number().int(),
  category: z.string(),
  item: z.string().nullable(),
  baseName: z.string(),
  alertLevel: z.number(),
  minimumLevel: z.number(),
  // campo incluído depois do primeiro cadastro: arquivo antigo sem ele lê como vazio
  buyer: z.string().nullable().default(null),
  leadTimeDays: z.number().nullable(),
  externalProcess: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string(),
});
const StoreSchema = z.object({ items: z.array(EntitySchema), updatedAt: z.string().nullable() });

const SeedSchema = z.object({
  items: z.array(z.object({
    code: z.number().int(),
    category: z.string(),
    item: z.string().nullable(),
    baseName: z.string(),
    alertLevel: z.number(),
    minimumLevel: z.number(),
    buyer: z.string().nullable().default(null),
    leadTimeDays: z.number().nullable(),
    externalProcess: z.string().nullable(),
    updatedAt: z.string().nullable(),
  })),
});

function seedStore(): StockControlStore {
  const seed = SeedSchema.parse(JSON.parse(readFileSync(SEED_FILE, 'utf8')));
  const now = new Date().toISOString();
  const items = seed.items.map((s): StockControlEntity => ({
    id: randomUUID(),
    ...s,
    createdAt: s.updatedAt ?? now,
    updatedAt: s.updatedAt ?? now,
    updatedBy: SEED_AUTHOR,
  }));
  logger.info('stock-controls', `cadastro criado com ${items.length} itens da planilha oficial`);
  return { items, updatedAt: now };
}

const store = createJsonFileStore<StockControlStore>({
  fileName: 'stock-controls.json',
  schema: StoreSchema,
  initial: seedStore,
  persistInitial: true,
  label: 'stock-controls',
  unreadableCode: 'STOCK_CONTROL_STORE_UNREADABLE',
  unreadableMessage: 'O cadastro de controle de estoque não pôde ser lido.',
});

/** O cadastro atual (ver `createJsonFileStore`: releitura só quando muda, arquivo ilegível trava a gravação). */
export function readStore(): StockControlStore {
  return store.read();
}

export function writeStore(items: StockControlEntity[]): StockControlStore {
  return store.write({ items, updatedAt: new Date().toISOString() });
}
