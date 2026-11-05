/** O que entra no log de edições (tela de Administração). */
export const AUDIT_ACTIONS = [
  'stock-control.create',
  'stock-control.update',
  'stock-control.delete',
  'user.role.update',
  'user.management-access.update',
  'productivity-staff.update',
  'data-sources.refresh',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Um campo alterado: valor antes e depois (null = não existia / ficou vazio). */
export interface AuditChange {
  field: string;
  from: string | number | null;
  to: string | number | null;
}

export interface AuditEvent {
  id: string;
  at: string;
  email: string;
  name: string;
  action: AuditAction;
  /** o que foi alterado, legível: "Código 32 · BASE OPERACIONAL - CANOAS", um e-mail... */
  target: string | null;
  changes: AuditChange[];
}
