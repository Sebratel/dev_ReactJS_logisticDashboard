import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { logger } from '../../common/helpers/logger.helper.js';
import { createJsonFileStore } from '../../common/storage/json-file.store.js';
import { AUDIT_ACTIONS, type AuditAction, type AuditChange, type AuditEvent } from './audit.entity.js';

/**
 * Log de edições: `audit-log.json` no volume de dados, com as últimas
 * MAX_EVENTS ações (o mais antigo sai quando passa disso). Mesmo desenho do
 * log de ações da dashboard IA.
 */
export const MAX_AUDIT_EVENTS = 5000;

const ValueSchema = z.union([z.string(), z.number(), z.null()]);
const store = createJsonFileStore<{ events: AuditEvent[] }>({
  fileName: 'audit-log.json',
  schema: z.object({
    events: z.array(z.object({
      id: z.string(),
      at: z.string(),
      email: z.string(),
      name: z.string(),
      action: z.enum(AUDIT_ACTIONS),
      target: z.string().nullable(),
      changes: z.array(z.object({ field: z.string(), from: ValueSchema, to: ValueSchema })),
    })),
  }),
  initial: () => ({ events: [] }),
  label: 'audit',
  unreadableCode: 'AUDIT_LOG_UNREADABLE',
  unreadableMessage: 'O log de edições não pôde ser lido.',
});

/**
 * Registra uma ação. Não lança: quando ela é chamada a alteração já foi
 * gravada, e falhar a requisição agora faria a pessoa achar que não salvou.
 * A falha fica no log do servidor, alto, para ser vista.
 */
export function recordAudit(
  actor: { email: string; name: string },
  action: AuditAction,
  target: string | null,
  changes: AuditChange[] = [],
): void {
  try {
    const { events } = store.read();
    const event: AuditEvent = {
      id: randomUUID(), at: new Date().toISOString(), email: actor.email, name: actor.name, action, target, changes,
    };
    store.write({ events: [...events, event].slice(-MAX_AUDIT_EVENTS) });
  } catch (err) {
    logger.error('audit', `NÃO registrado: ${action} por ${actor.email} em ${target ?? '-'} (${err instanceof Error ? err.message : String(err)})`);
  }
}

/** As ações mais recentes primeiro. */
export function listAudit(limit: number): AuditEvent[] {
  return store.read().events.slice(-limit).reverse();
}
