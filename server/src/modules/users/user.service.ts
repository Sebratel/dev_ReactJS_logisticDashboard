import { AppException } from '../../common/errors/app.exception.js';
import { logger } from '../../common/helpers/logger.helper.js';
import { appConfig } from '../../config/env.config.js';
import { recordAudit } from '../audit/audit.service.js';
import { hasManagementAccess, ROLE_LABELS, type UserEntity, type UserRole } from './user.entity.js';
import { readUsers, writeUsers } from './user.repository.js';

/**
 * "Online": alguma requisição autenticada nos últimos 2,5 min. O topo de toda
 * tela relê a situação das fontes a cada 60 s, então uma aba aberta e visível
 * sempre aparece online; aba escondida para de consultar e cai em seguida.
 */
export const ONLINE_WINDOW_MS = 150_000;

/** Grava o "visto por último" no disco no máximo a cada 30 s por pessoa (o app faz várias chamadas por minuto). */
const PERSIST_EVERY_MS = 30_000;

const seenAt = new Map<string, number>();
const persistedAt = new Map<string, number>();

const hasSavedAdmin = (users: UserEntity[]) => users.some((u) => u.role === 'ADMIN');
const isBootstrapAdmin = (email: string) => appConfig.auth.bootstrapAdminEmails.includes(email);

/**
 * Papel de quem entra pela primeira vez: Padrão. A lista ADMIN_EMAILS só vale
 * enquanto não existir NENHUM admin salvo (instalação nova) — se valesse
 * sempre, um e-mail dela que entrasse meses depois cairia direto como admin
 * sem ninguém ter decidido isso.
 */
function initialRole(users: UserEntity[], email: string): UserRole {
  return !hasSavedAdmin(users) && isBootstrapAdmin(email) ? 'ADMIN' : 'VIEWER';
}

/** O que a pessoa pode fazer: o papel e se vê a seção Gerencial. */
export interface UserAccess {
  role: UserRole;
  managementAccess: boolean;
}

const accessOf = (user: UserEntity): UserAccess => ({ role: user.role, managementAccess: hasManagementAccess(user) });

/**
 * Registra o acesso de quem fez a requisição e devolve o que ela pode fazer.
 *
 * Nunca lança: cadastro de usuários ilegível não pode trancar todo mundo do
 * lado de fora. Nesse caso vale um papel provisório (admin de fábrica = Admin,
 * o resto = Padrão, sem Gerencial) e nada é gravado.
 */
export function touchUser(identity: { email: string; name: string; picture: string | null }): UserAccess {
  const email = identity.email.toLowerCase();
  const now = Date.now();
  seenAt.set(email, now);
  try {
    const users = readUsers();
    const existing = users.find((u) => u.email === email);
    const fresh = now - (persistedAt.get(email) ?? 0) < PERSIST_EVERY_MS;
    if (existing && fresh && existing.name === identity.name && existing.picture === identity.picture) return accessOf(existing);

    const iso = new Date(now).toISOString();
    const updated: UserEntity = existing
      ? { ...existing, name: identity.name || existing.name, picture: identity.picture, lastSeenAt: iso }
      : {
        email, name: identity.name || email, picture: identity.picture, role: initialRole(users, email),
        firstSeenAt: iso, lastSeenAt: iso, lastLoginAt: null,
      };
    writeUsers(existing ? users.map((u) => (u.email === email ? updated : u)) : [...users, updated]);
    persistedAt.set(email, now);
    if (!existing) logger.info('users', `primeiro acesso de ${email} — permissão ${ROLE_LABELS[updated.role]}`);
    return accessOf(updated);
  } catch (err) {
    logger.error('users', `cadastro de usuários indisponível (${err instanceof Error ? err.message : String(err)}) — permissão provisória para ${email}`);
    const role: UserRole = isBootstrapAdmin(email) ? 'ADMIN' : 'VIEWER';
    return { role, managementAccess: role === 'ADMIN' };
  }
}

/** O clique em "Entrar com Google" (o front avisa logo depois do login). */
export function recordLogin(email: string): void {
  const key = email.toLowerCase();
  const users = readUsers();
  if (!users.some((u) => u.email === key)) return;
  const now = new Date().toISOString();
  writeUsers(users.map((u) => (u.email === key ? { ...u, lastLoginAt: now, lastSeenAt: now } : u)));
  persistedAt.set(key, Date.now());
}

export interface UserView extends UserEntity {
  online: boolean;
  managementAccess: boolean;
}

/** Todos os usuários, online primeiro e depois pelo acesso mais recente. */
export function listUsers(): UserView[] {
  const now = Date.now();
  return readUsers()
    .map((u): UserView => {
      // o "visto por último" em memória é mais novo que o do disco (que só grava a cada 30 s)
      const memory = seenAt.get(u.email);
      const lastSeen = Math.max(new Date(u.lastSeenAt).getTime(), memory ?? 0);
      return {
        ...u, lastSeenAt: new Date(lastSeen).toISOString(), online: now - lastSeen <= ONLINE_WINDOW_MS,
        // o que a pessoa vê de fato: admin sempre vê, mesmo sem a marca
        managementAccess: hasManagementAccess(u),
      };
    })
    .sort((a, b) => Number(b.online) - Number(a.online) || b.lastSeenAt.localeCompare(a.lastSeenAt));
}

/**
 * Troca a permissão de quem já entrou no painel. Não deixa tirar o último
 * administrador — a tela que decide isso ficaria sem ninguém para abri-la.
 */
export function setUserRole(target: string, role: UserRole, actor: { email: string; name: string }): UserView {
  const email = target.toLowerCase();
  const users = readUsers();
  const current = users.find((u) => u.email === email);
  if (!current) throw new AppException(404, 'USER_NOT_FOUND', 'Essa pessoa ainda não entrou no painel.');
  if (current.role !== role) {
    if (current.role === 'ADMIN' && !users.some((u) => u.email !== email && u.role === 'ADMIN')) {
      throw new AppException(422, 'USER_LAST_ADMIN', 'Não dá para tirar o último administrador. Promova outra pessoa antes.');
    }
    writeUsers(users.map((u) => (u.email === email ? { ...u, role } : u)));
    recordAudit(actor, 'user.role.update', email, [{ field: 'Permissão', from: ROLE_LABELS[current.role], to: ROLE_LABELS[role] }]);
    logger.info('users', `${email}: ${ROLE_LABELS[current.role]} -> ${ROLE_LABELS[role]} por ${actor.email}`);
  }
  const view = listUsers().find((u) => u.email === email);
  if (!view) throw new AppException(404, 'USER_NOT_FOUND', 'Essa pessoa ainda não entrou no painel.');
  return view;
}

const yesNoLabel = (value: boolean) => (value ? 'Sim' : 'Não');

/**
 * Libera ou tira a seção Gerencial de quem já entrou no painel. Admin sempre
 * vê a seção — para ele a troca não existe (a tela nem oferece).
 */
export function setUserManagementAccess(target: string, managementAccess: boolean, actor: { email: string; name: string }): UserView {
  const email = target.toLowerCase();
  const users = readUsers();
  const current = users.find((u) => u.email === email);
  if (!current) throw new AppException(404, 'USER_NOT_FOUND', 'Essa pessoa ainda não entrou no painel.');
  if (current.role === 'ADMIN') {
    throw new AppException(422, 'USER_ADMIN_MANAGEMENT_ACCESS', 'Administradores sempre veem a seção Gerencial.');
  }
  const before = current.managementAccess === true;
  if (before !== managementAccess) {
    writeUsers(users.map((u) => (u.email === email ? { ...u, managementAccess } : u)));
    recordAudit(actor, 'user.management-access.update', email, [{ field: 'Gerencial', from: yesNoLabel(before), to: yesNoLabel(managementAccess) }]);
    logger.info('users', `${email}: Gerencial ${yesNoLabel(before)} -> ${yesNoLabel(managementAccess)} por ${actor.email}`);
  }
  const view = listUsers().find((u) => u.email === email);
  if (!view) throw new AppException(404, 'USER_NOT_FOUND', 'Essa pessoa ainda não entrou no painel.');
  return view;
}
