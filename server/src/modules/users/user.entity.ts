/**
 * Quem já entrou no painel e o que pode fazer. Papéis, do menor para o maior:
 *   VIEWER ("Padrão") — consulta tudo;
 *   EDITOR ("Edição") — também altera o cadastro de controle de estoque;
 *   ADMIN  ("Admin")  — tudo, mais a tela de Administração (usuários,
 *                       permissões, log de edições) e a atualização manual.
 *
 * À parte do papel, a seção GERENCIAL (Power BI "LOG - Gerencial") é liberada
 * pessoa a pessoa (`managementAccess`); administradores sempre a veem.
 */
export const USER_ROLES = ['VIEWER', 'EDITOR', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = { VIEWER: 'Padrão', EDITOR: 'Edição', ADMIN: 'Admin' };

export interface UserEntity {
  /** chave: e-mail em minúsculas */
  email: string;
  name: string;
  picture: string | null;
  role: UserRole;
  firstSeenAt: string;
  /** última requisição autenticada (gravada no máximo a cada 30 s) */
  lastSeenAt: string;
  /** último login com o Google (o clique em "Entrar") */
  lastLoginAt: string | null;
  /** acesso à seção Gerencial (ausente nos cadastros antigos = sem acesso) */
  managementAccess?: boolean;
}

/** Quem vê a seção Gerencial: admin, ou quem um admin liberou. */
export const hasManagementAccess = (user: { role: UserRole; managementAccess?: boolean }): boolean => (
  user.role === 'ADMIN' || user.managementAccess === true
);
