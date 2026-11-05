import { useMemo, useState } from 'react';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { Dialog } from '../../components/ui/Dialog';
import { Banner, ErrorBanner, Loading } from '../../components/ui/States';
import { Visual } from '../../components/ui/Visual';
import { useSession } from '../../context/SessionContext';
import { useAdminUsers, useAuditEvents, useUpdateUserManagementAccess, useUpdateUserRole } from '../../hooks/useAdmin';
import { ProductivityStaffEditor } from './ProductivityStaffEditor';
import {
  ROLE_LABELS, ROLE_ORDER, type AdminUser, type AuditAction, type AuditChange, type AuditEvent, type UserRole,
} from '../../services/types';
import { int, labelInstant, timeAgo } from '../../utils/format';

const ACTION_LABELS: Record<AuditAction, string> = {
  'stock-control.create': 'Cadastrou item no controle de estoque',
  'stock-control.update': 'Alterou item do controle de estoque',
  'stock-control.delete': 'Excluiu item do controle de estoque',
  'user.role.update': 'Alterou permissão',
  'user.management-access.update': 'Alterou o acesso ao Gerencial',
  'productivity-staff.update': 'Alterou a lista da produtividade almox',
  'data-sources.refresh': 'Atualizou as fontes manualmente',
};

/** O que cada permissão libera — vai no diálogo de confirmação. */
const ROLE_EFFECT: Record<UserRole, string> = {
  VIEWER: 'Passa a só consultar o painel.',
  EDITOR: 'Passa a poder incluir, alterar e excluir itens do controle de estoque.',
  ADMIN: 'Passa a ter acesso a esta tela (usuários, permissões e log) e à atualização manual das fontes, além da edição.',
};

const valueText = (v: string | number | null) => (v === null || v === '' ? '—' : String(v));
const changeText = (c: AuditChange) => `${c.field}: ${valueText(c.from)} → ${valueText(c.to)}`;

function RoleSelector({ user, disabled, onChange }: { user: AdminUser; disabled: boolean; onChange: (role: UserRole) => void }) {
  return (
    <span className="alternador papel-seletor" role="radiogroup" aria-label={`Permissão de ${user.name}`}>
      {ROLE_ORDER.map((role) => (
        <button
          key={role}
          type="button"
          role="radio"
          aria-checked={user.role === role}
          className={`${user.role === role ? 'on' : ''} papel-${role.toLowerCase()}`}
          disabled={disabled}
          onClick={() => { if (role !== user.role) onChange(role); }}
        >
          {ROLE_LABELS[role]}
        </button>
      ))}
    </span>
  );
}

/** Acesso à seção Gerencial: admin sempre vê; os outros, Sim/Não. */
function ManagementToggle({ user, disabled, onChange }: { user: AdminUser; disabled: boolean; onChange: (value: boolean) => void }) {
  if (user.role === 'ADMIN') return <span className="apagado" title="Administradores sempre veem a seção Gerencial">Sempre (admin)</span>;
  return (
    <span className="alternador papel-seletor" role="radiogroup" aria-label={`Acesso de ${user.name} à seção Gerencial`}>
      {[false, true].map((value) => (
        <button
          key={String(value)}
          type="button"
          role="radio"
          aria-checked={user.managementAccess === value}
          className={user.managementAccess === value ? 'on' : ''}
          disabled={disabled}
          onClick={() => { if (value !== user.managementAccess) onChange(value); }}
        >
          {value ? 'Sim' : 'Não'}
        </button>
      ))}
    </span>
  );
}

/**
 * ADMINISTRAÇÃO — só administradores: quem já entrou no painel, quem está
 * online agora, a permissão de cada um (Padrão, Edição, Admin), quem vê a
 * seção Gerencial, quem aparece na produtividade do almoxarifado e o log de
 * edições. Mesmo desenho da aba de acessos da dashboard IA.
 */
export default function AdminPage() {
  const { user: me, isAdmin } = useSession();
  const users = useAdminUsers(isAdmin);
  const audit = useAuditEvents(isAdmin);
  const updateRole = useUpdateUserRole();
  const updateManagement = useUpdateUserManagementAccess();
  const [pending, setPending] = useState<{ user: AdminUser; role: UserRole } | null>(null);
  const [pendingAccess, setPendingAccess] = useState<{ user: AdminUser; value: boolean } | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<AuditAction | ''>('');

  const userColumns = useMemo<Column<AdminUser>[]>(() => [
    {
      key: 'online',
      title: 'STATUS',
      value: (r) => (r.online ? 'Online' : 'Offline'),
      render: (r) => <span className={`status-usuario${r.online ? ' on' : ''}`}><i />{r.online ? 'Online' : 'Offline'}</span>,
      align: 'center',
    },
    {
      key: 'name',
      title: 'NOME',
      value: (r) => r.name,
      render: (r) => <>{r.name}{r.email === me?.email && <span className="apagado"> (você)</span>}</>,
    },
    { key: 'email', title: 'E-MAIL', value: (r) => r.email },
    {
      key: 'lastLoginAt',
      title: 'ÚLTIMO LOGIN',
      value: (r) => r.lastLoginAt,
      render: (r) => (r.lastLoginAt ? labelInstant(r.lastLoginAt) : '—'),
      align: 'center',
    },
    {
      key: 'lastSeenAt',
      title: 'ÚLTIMO ACESSO',
      value: (r) => r.lastSeenAt,
      render: (r) => <span title={labelInstant(r.lastSeenAt)}>{r.online ? 'agora' : timeAgo(r.lastSeenAt)}</span>,
      align: 'center',
    },
    {
      key: 'firstSeenAt',
      title: 'PRIMEIRO ACESSO',
      value: (r) => r.firstSeenAt,
      render: (r) => labelInstant(r.firstSeenAt).slice(0, 10),
      align: 'center',
    },
    {
      key: 'role',
      title: 'PERMISSÃO',
      value: (r) => ROLE_ORDER.indexOf(r.role),
      render: (r) => (
        <RoleSelector
          user={r}
          disabled={updateRole.isPending}
          onChange={(role) => { setRoleError(null); setPending({ user: r, role }); }}
        />
      ),
      align: 'center',
    },
    {
      key: 'managementAccess',
      title: 'GERENCIAL',
      value: (r) => (r.role === 'ADMIN' ? 2 : r.managementAccess ? 1 : 0),
      render: (r) => (
        <ManagementToggle
          user={r}
          disabled={updateManagement.isPending}
          onChange={(value) => { setRoleError(null); setPendingAccess({ user: r, value }); }}
        />
      ),
      align: 'center',
    },
  ], [me?.email, updateRole.isPending, updateManagement.isPending]);

  const auditColumns = useMemo<Column<AuditEvent>[]>(() => [
    { key: 'at', title: 'DATA/HORA', value: (r) => r.at, render: (r) => labelInstant(r.at), align: 'center' },
    {
      key: 'email',
      title: 'USUÁRIO',
      value: (r) => r.name,
      render: (r) => <span title={r.email}>{r.name}</span>,
    },
    { key: 'action', title: 'AÇÃO', value: (r) => ACTION_LABELS[r.action] ?? r.action },
    { key: 'target', title: 'ITEM', value: (r) => r.target, wrap: true },
    {
      key: 'changes',
      title: 'O QUE MUDOU',
      value: (r) => r.changes.map(changeText).join('; '),
      render: (r) => (r.changes.length
        ? <span className="mudancas">{r.changes.map((c) => <span key={c.field}>{changeText(c)}</span>)}</span>
        : '—'),
      wrap: true,
    },
  ], []);

  const events = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (audit.data ?? []).filter((e) => {
      if (action && e.action !== action) return false;
      if (!term) return true;
      return `${e.name} ${e.email} ${e.target ?? ''} ${e.changes.map(changeText).join(' ')}`.toLowerCase().includes(term);
    });
  }, [audit.data, search, action]);

  if (!isAdmin) {
    return (
      <main className="page sem-filtros">
        <Banner tone="error">Esta tela é só para administradores.</Banner>
      </main>
    );
  }

  const confirm = async () => {
    if (!pending) return;
    try {
      await updateRole.mutateAsync({ email: pending.user.email, role: pending.role });
      setPending(null);
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Não foi possível trocar a permissão.');
      setPending(null);
    }
  };

  const confirmAccess = async () => {
    if (!pendingAccess) return;
    try {
      await updateManagement.mutateAsync({ email: pendingAccess.user.email, managementAccess: pendingAccess.value });
      setPendingAccess(null);
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Não foi possível trocar o acesso ao Gerencial.');
      setPendingAccess(null);
    }
  };

  const list = users.data;
  const editors = list?.users.filter((u) => u.role === 'EDITOR').length ?? 0;
  const admins = list?.users.filter((u) => u.role === 'ADMIN').length ?? 0;
  const management = list?.users.filter((u) => u.role !== 'ADMIN' && u.managementAccess).length ?? 0;

  return (
    <main className="page sem-filtros admin-pagina">
      {list && (
        <section className="admin-resumo" aria-label="Resumo">
          <div className="admin-numero online"><b>{int(list.online)}</b><span>online agora</span></div>
          <div className="admin-numero"><b>{int(list.total)}</b><span>já entraram no painel</span></div>
          <div className="admin-numero"><b>{int(editors)}</b><span>com Edição</span></div>
          <div className="admin-numero"><b>{int(admins)}</b><span>administradores</span></div>
          <div className="admin-numero"><b>{int(management)}</b><span>com Gerencial (fora os admins)</span></div>
        </section>
      )}

      {roleError && <Banner tone="error">{roleError}</Banner>}
      {users.error && <ErrorBanner error={users.error} />}
      {users.isPending && <Loading text="Carregando os usuários…" />}

      {list && (
        <Visual
          title="Usuários e permissões"
          subtitle="Padrão consulta · Edição também altera o controle de estoque · Admin também acessa esta tela. Gerencial libera a seção Gerencial (admin sempre vê). Quem entra pela primeira vez fica como Padrão, sem Gerencial."
          className="v-auto"
          flush
        >
          <DataTable columns={userColumns} rows={list.users} rowKey={(r) => r.email} />
        </Visual>
      )}

      <ProductivityStaffEditor />

      <Visual
        title="Log de edições"
        subtitle={audit.data ? `${int(events.length)} de ${int(audit.data.length)} ações mais recentes` : undefined}
        className="v-admin-log"
        flush
      >
        <div className="admin-log-filtros">
          <label className="busca-cadastro">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar usuário, item ou valor"
              aria-label="Buscar no log de edições"
            />
          </label>
          <select value={action} onChange={(e) => setAction(e.target.value as AuditAction | '')} aria-label="Tipo de ação">
            <option value="">Todas as ações</option>
            {(Object.keys(ACTION_LABELS) as AuditAction[]).map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
          </select>
        </div>
        {audit.error && <ErrorBanner error={audit.error} />}
        {audit.isPending ? <Loading text="Carregando o log…" /> : (
          <DataTable columns={auditColumns} rows={events} rowKey={(r) => r.id} />
        )}
      </Visual>

      {pendingAccess && (
        <Dialog
          title={`${pendingAccess.value ? 'Liberar' : 'Tirar'} o Gerencial ${pendingAccess.value ? 'para' : 'de'} ${pendingAccess.user.name}?`}
          size="sm"
          onClose={() => setPendingAccess(null)}
          busy={updateManagement.isPending}
        >
          <div className="confirmacao">
            <p>
              <b>{pendingAccess.user.email}</b>{' '}
              {pendingAccess.value
                ? 'passa a ver a seção Gerencial (objetos criados, consumo de flat, movimentações ZTE, obsoletos e produtividade do almoxarifado).'
                : 'deixa de ver a seção Gerencial; as abas e os cartões dela somem e o servidor recusa as consultas.'}
              {' '}A troca vale na próxima ação da pessoa e fica no log de edições.
            </p>
            <footer>
              <button type="button" className="btn" onClick={() => setPendingAccess(null)} disabled={updateManagement.isPending} data-autofocus>
                Cancelar
              </button>
              <button type="button" className="btn primario" onClick={confirmAccess} disabled={updateManagement.isPending}>
                {updateManagement.isPending ? 'Salvando…' : 'Confirmar'}
              </button>
            </footer>
          </div>
        </Dialog>
      )}

      {pending && (
        <Dialog
          title={`${ROLE_LABELS[pending.role]} para ${pending.user.name}?`}
          size="sm"
          onClose={() => setPending(null)}
          busy={updateRole.isPending}
        >
          <div className="confirmacao">
            <p>
              <b>{pending.user.email}</b> sai de <b>{ROLE_LABELS[pending.user.role]}</b> para <b>{ROLE_LABELS[pending.role]}</b>.
              {' '}{ROLE_EFFECT[pending.role]} A troca vale na próxima ação da pessoa e fica no log de edições.
            </p>
            <footer>
              <button type="button" className="btn" onClick={() => setPending(null)} disabled={updateRole.isPending} data-autofocus>
                Cancelar
              </button>
              <button type="button" className="btn primario" onClick={confirm} disabled={updateRole.isPending}>
                {updateRole.isPending ? 'Salvando…' : 'Confirmar'}
              </button>
            </footer>
          </div>
        </Dialog>
      )}
    </main>
  );
}
