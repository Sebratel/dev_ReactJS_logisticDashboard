import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../../common/auth/auth.middleware.js';
import { AppException } from '../../common/errors/app.exception.js';
import { logger } from '../../common/helpers/logger.helper.js';
import type { AuditChange } from '../audit/audit.entity.js';
import { recordAudit } from '../audit/audit.service.js';
import type { StockControlEntity } from './stock-control.entity.js';
import { readStore, writeStore, type StockControlStore } from './stock-control.repository.js';
import { StockControlIdSchema, StockControlInputSchema, type StockControlInput } from './stock-control.schema.js';

/** Teto contra uso indevido: a planilha oficial tem 831 itens. */
export const STOCK_CONTROL_LIMIT = 5000;

/**
 * Quem precisa saber que o cadastro mudou. A carga das fontes registra aqui a
 * remontagem das tabelas de alerta — assim a tela reflete a alteração na hora,
 * sem esperar a carga horária.
 */
let onChange: (() => void) | null = null;
export function onStockControlChange(listener: () => void): void {
  onChange = listener;
}

const sameKey = (a: { code: number; baseName: string }, b: { code: number; baseName: string }) => (
  a.code === b.code && a.baseName === b.baseName
);

/** Regras de negócio que a validação de formato não cobre. */
function checkRules(input: StockControlInput, items: StockControlEntity[], currentId: string | null): void {
  if (input.alertLevel < input.minimumLevel) {
    throw new AppException(422, 'STOCK_CONTROL_ALERT_BELOW_MINIMUM', 'O alerta de estoque não pode ser menor que o estoque mínimo.');
  }
  const duplicate = items.find((i) => i.id !== currentId && sameKey(i, input));
  if (duplicate) {
    throw new AppException(
      409,
      'STOCK_CONTROL_ALREADY_EXISTS',
      `O código ${input.code} já está cadastrado na ${input.baseName}. Edite o item existente.`,
    );
  }
}

function findOrFail(items: StockControlEntity[], rawId: unknown): StockControlEntity {
  const id = StockControlIdSchema.parse(rawId);
  const found = items.find((i) => i.id === id);
  if (!found) throw new AppException(404, 'STOCK_CONTROL_NOT_FOUND', 'Item do cadastro não encontrado.');
  return found;
}

/** Campos que entram no log de edições, com o nome que a tela usa. */
const AUDITED_FIELDS: Array<[keyof StockControlInput, string]> = [
  ['code', 'Código'], ['baseName', 'Base de origem'], ['category', 'Situação'], ['item', 'Item'],
  ['alertLevel', 'Alerta de estoque'], ['minimumLevel', 'Estoque mínimo'], ['buyer', 'Comprador responsável'],
  ['leadTimeDays', 'Lead time (dias)'], ['externalProcess', 'Processo externo'],
];

/** O que mudou entre antes e depois (null de um lado = item criado ou excluído). */
function changesOf(before: StockControlEntity | null, after: StockControlEntity | null): AuditChange[] {
  const out: AuditChange[] = [];
  for (const [field, label] of AUDITED_FIELDS) {
    const from = before ? before[field] ?? null : null;
    const to = after ? after[field] ?? null : null;
    if (from !== to) out.push({ field: label, from, to });
  }
  return out;
}

const targetOf = (item: StockControlEntity) => `Código ${item.code} · ${item.baseName}`;

function persist(items: StockControlEntity[]): void {
  writeStore(items);
  onChange?.();
}

export function listStockControls(): StockControlStore {
  return readStore();
}

export function createStockControl(body: unknown, user: AuthenticatedUser): StockControlEntity {
  const input = StockControlInputSchema.parse(body);
  const { items } = readStore();
  if (items.length >= STOCK_CONTROL_LIMIT) {
    throw new AppException(422, 'STOCK_CONTROL_LIMIT_REACHED', `O cadastro aceita no máximo ${STOCK_CONTROL_LIMIT} itens.`);
  }
  checkRules(input, items, null);
  const now = new Date().toISOString();
  const created: StockControlEntity = { id: randomUUID(), ...input, createdAt: now, updatedAt: now, updatedBy: user.email };
  persist([...items, created]);
  recordAudit(user, 'stock-control.create', targetOf(created), changesOf(null, created));
  logger.info('stock-controls', `código ${created.code} / ${created.baseName} cadastrado por ${user.email}`);
  return created;
}

export function updateStockControl(rawId: unknown, body: unknown, user: AuthenticatedUser): StockControlEntity {
  const input = StockControlInputSchema.parse(body);
  const { items } = readStore();
  const current = findOrFail(items, rawId);
  checkRules(input, items, current.id);
  const updated: StockControlEntity = { ...current, ...input, updatedAt: new Date().toISOString(), updatedBy: user.email };
  persist(items.map((i) => (i.id === current.id ? updated : i)));
  const changes = changesOf(current, updated);
  if (changes.length) recordAudit(user, 'stock-control.update', targetOf(updated), changes);
  logger.info('stock-controls', `código ${updated.code} / ${updated.baseName} alterado por ${user.email}`);
  return updated;
}

export function deleteStockControl(rawId: unknown, user: AuthenticatedUser): void {
  const { items } = readStore();
  const current = findOrFail(items, rawId);
  persist(items.filter((i) => i.id !== current.id));
  recordAudit(user, 'stock-control.delete', targetOf(current), changesOf(current, null));
  logger.info('stock-controls', `código ${current.code} / ${current.baseName} excluído por ${user.email}`);
}
