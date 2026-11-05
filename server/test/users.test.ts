import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

/**
 * Usuários e permissões contra um diretório de dados temporário. Os e-mails
 * de fábrica (ADMIN_EMAILS) aqui são fictícios.
 */
const dataPath = mkdtempSync(join(tmpdir(), 'users-'));
process.env.DATA_PATH = dataPath;
process.env.ADMIN_EMAILS = 'dono@exemplo.com.br, segundo-dono@exemplo.com.br';

type Users = typeof import('../src/modules/users/user.service.js');
type Audit = typeof import('../src/modules/audit/audit.service.js');
let users: Users;
let audit: Audit;

const who = (email: string, name = email.split('@')[0]!) => ({ email, name, picture: null });
const errorOf = (fn: () => unknown): { status?: number; code?: string } => {
  try {
    fn();
  } catch (err) {
    return err as { status?: number; code?: string };
  }
  assert.fail('deveria ter lançado');
};

before(async () => {
  users = await import('../src/modules/users/user.service.js');
  audit = await import('../src/modules/audit/audit.service.js');
});

after(() => {
  rmSync(dataPath, { recursive: true, force: true });
});

describe('usuários e permissões', () => {
  it('instalação nova: o e-mail de fábrica entra como Admin, o resto como Padrão', () => {
    assert.equal(users.touchUser(who('DONO@exemplo.com.br')).role, 'ADMIN');
    assert.equal(users.touchUser(who('ana@exemplo.com.br')).role, 'VIEWER');
  });

  it('com um admin salvo, a lista de fábrica não dá mais papel a ninguém', () => {
    assert.equal(users.touchUser(who('segundo-dono@exemplo.com.br')).role, 'VIEWER');
  });

  it('lista com quem está online e o último acesso', () => {
    const list = users.listUsers();
    assert.deepEqual(list.map((u) => u.email).sort(), ['ana@exemplo.com.br', 'dono@exemplo.com.br', 'segundo-dono@exemplo.com.br']);
    assert.ok(list.every((u) => u.online), 'acabaram de fazer uma requisição');
    assert.ok(list.every((u) => u.firstSeenAt && u.lastSeenAt));
  });

  it('seção Gerencial: admin sempre vê; os outros só quando um admin libera, e isso entra no log', () => {
    const admin = { email: 'dono@exemplo.com.br', name: 'Dono' };
    assert.equal(users.touchUser(who('dono@exemplo.com.br')).managementAccess, true, 'admin vê sem marca nenhuma');
    assert.equal(users.touchUser(who('ana@exemplo.com.br')).managementAccess, false, 'quem entra não vê');
    const liberada = users.setUserManagementAccess('ANA@exemplo.com.br', true, admin);
    assert.equal(liberada.managementAccess, true);
    assert.equal(users.touchUser(who('ana@exemplo.com.br')).managementAccess, true, 'vale na próxima requisição');
    const [last] = audit.listAudit(1);
    assert.equal(last?.action, 'user.management-access.update');
    assert.deepEqual(last?.changes, [{ field: 'Gerencial', from: 'Não', to: 'Sim' }]);
    users.setUserManagementAccess('ana@exemplo.com.br', false, admin);
    assert.equal(users.touchUser(who('ana@exemplo.com.br')).managementAccess, false);
    assert.equal(errorOf(() => users.setUserManagementAccess('dono@exemplo.com.br', false, admin)).code, 'USER_ADMIN_MANAGEMENT_ACCESS');
    assert.equal(errorOf(() => users.setUserManagementAccess('ninguem@exemplo.com.br', true, admin)).status, 404);
    assert.equal(users.listUsers().find((u) => u.email === 'dono@exemplo.com.br')?.managementAccess, true);
  });

  it('o admin dá Edição e isso entra no log de edições', () => {
    const admin = { email: 'dono@exemplo.com.br', name: 'Dono' };
    const updated = users.setUserRole('ANA@exemplo.com.br', 'EDITOR', admin);
    assert.equal(updated.role, 'EDITOR');
    assert.equal(users.touchUser(who('ana@exemplo.com.br')).role, 'EDITOR', 'o papel salvo vale na próxima requisição');
    const [last] = audit.listAudit(1);
    assert.equal(last?.action, 'user.role.update');
    assert.equal(last?.target, 'ana@exemplo.com.br');
    assert.deepEqual(last?.changes, [{ field: 'Permissão', from: 'Padrão', to: 'Edição' }]);
  });

  it('não deixa tirar o último administrador', () => {
    const err = errorOf(() => users.setUserRole('dono@exemplo.com.br', 'VIEWER', { email: 'dono@exemplo.com.br', name: 'Dono' }));
    assert.equal(err.status, 422);
    assert.equal(err.code, 'USER_LAST_ADMIN');
  });

  it('com outro admin, o primeiro pode deixar de ser admin', () => {
    const admin = { email: 'dono@exemplo.com.br', name: 'Dono' };
    users.setUserRole('segundo-dono@exemplo.com.br', 'ADMIN', admin);
    assert.equal(users.setUserRole('dono@exemplo.com.br', 'VIEWER', admin).role, 'VIEWER');
  });

  it('quem nunca entrou não recebe permissão', () => {
    assert.equal(errorOf(() => users.setUserRole('nunca@exemplo.com.br', 'EDITOR', { email: 'x@y', name: 'x' })).status, 404);
  });

  it('o login fica registrado', () => {
    users.recordLogin('ana@exemplo.com.br');
    const ana = users.listUsers().find((u) => u.email === 'ana@exemplo.com.br');
    assert.ok(ana?.lastLoginAt);
  });

  it('cadastro ilegível não tranca ninguém do lado de fora nem é sobrescrito', () => {
    const file = join(dataPath, 'users.json');
    writeFileSync(file, '{ "users": [ quebrado', 'utf8');
    assert.equal(users.touchUser(who('dono@exemplo.com.br')).role, 'ADMIN', 'permissão provisória do admin de fábrica');
    assert.equal(users.touchUser(who('outra@exemplo.com.br')).role, 'VIEWER');
    assert.equal(readFileSync(file, 'utf8'), '{ "users": [ quebrado');
  });
});
