import { useEffect, useMemo, useState } from 'react';
import { StockControlDialog } from '../../components/stock-controls/StockControlDialog';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { Dialog } from '../../components/ui/Dialog';
import { Icon } from '../../components/ui/Icon';
import { Banner, ErrorBanner, Loading } from '../../components/ui/States';
import { Visual } from '../../components/ui/Visual';
import { useSession } from '../../context/SessionContext';
import { useDeleteStockControl, useStockControls } from '../../hooks/useStockControls';
import { downloadStockControls } from '../../services/stockControlsService';
import { OPERATIONAL_BASES, type StockControl } from '../../services/types';
import { int, labelInstant, timeAgo } from '../../utils/format';

const shortBase = (base: string): string => base.replace('BASE OPERACIONAL - ', '');

const normalize = (v: string): string => v.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();

const NOT_IN_VOALLE = 'SEM SALDO NO VOALLE';
const STATUS_OPTIONS = ['MÍNIMO', 'ALERTA', 'ACIMA', NOT_IN_VOALLE];

const statusClass = (r: StockControl): string | undefined => (
  r.voalle?.status === 'MÍNIMO' ? 'est-minimo' : r.voalle?.status === 'ALERTA' ? 'est-alerta' : undefined
);

/**
 * CONFIGURAÇÃO · Controle de estoque — o cadastro que substituiu a planilha
 * "Controle Estoque": situação, base de origem, alerta, mínimo, lead time e
 * processo externo de cada produto. Todo mundo consulta; quem é EDITOR altera.
 */
export default function StockControlsPage() {
  const { user } = useSession();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'EDITOR';
  const { data, error, isPending } = useStockControls();
  const remove = useDeleteStockControl();

  const [search, setSearch] = useState('');
  const [base, setBase] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<StockControl | 'new' | null>(null);
  const [deleting, setDeleting] = useState<StockControl | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [items]);
  const buyers = useMemo(() => (
    [...new Set(items.map((i) => i.buyer).filter((b): b is string => !!b))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  ), [items]);

  const rows = useMemo(() => {
    const term = normalize(search.trim());
    return items.filter((i) => {
      if (base && i.baseName !== base) return false;
      if (category && i.category !== category) return false;
      if (status && (i.voalle?.status ?? NOT_IN_VOALLE) !== status) return false;
      if (!term) return true;
      return normalize(`${i.code} ${i.item ?? ''} ${i.voalle?.description ?? ''} ${i.buyer ?? ''} ${i.externalProcess ?? ''}`).includes(term);
    });
  }, [items, search, base, category, status]);

  const columns = useMemo<Column<StockControl>[]>(() => {
    const list: Column<StockControl>[] = [
      { key: 'code', title: 'CÓDIGO', value: (r) => r.code, render: (r) => String(r.code), align: 'center' },
      { key: 'category', title: 'SITUAÇÃO', value: (r) => r.category },
      {
        key: 'item',
        title: 'ITEM',
        value: (r) => r.item ?? r.voalle?.description ?? null,
        render: (r) => r.item ?? <span className="apagado" title="Sem item cadastrado — descrição do Voalle">{r.voalle?.description ?? '—'}</span>,
        wrap: true,
      },
      { key: 'baseName', title: 'BASE DE ORIGEM', value: (r) => shortBase(r.baseName) },
      { key: 'alertLevel', title: 'ALERTA', value: (r) => r.alertLevel },
      { key: 'minimumLevel', title: 'MÍNIMO', value: (r) => r.minimumLevel },
      { key: 'buyer', title: 'COMPRADOR', value: (r) => r.buyer },
      { key: 'leadTimeDays', title: 'LEAD TIME', value: (r) => r.leadTimeDays, render: (r) => (r.leadTimeDays === null ? '' : `${int(r.leadTimeDays)} dias`) },
      { key: 'externalProcess', title: 'PROCESSO EXTERNO', value: (r) => r.externalProcess },
      {
        key: 'units',
        title: 'SALDO VOALLE',
        value: (r) => r.voalle?.units ?? null,
        render: (r) => (r.voalle ? int(r.voalle.units) : <span className="apagado" title="Código+base não aparece no saldo do Voalle">—</span>),
        align: 'center',
        cellClass: statusClass,
      },
      {
        key: 'updatedAt',
        title: 'ATUALIZADO EM',
        value: (r) => r.updatedAt,
        render: (r) => <span title={`${labelInstant(r.updatedAt)} por ${r.updatedBy}`}>{labelInstant(r.updatedAt).slice(0, 10)}</span>,
        align: 'center',
      },
    ];
    if (canEdit) {
      list.push({
        key: 'actions',
        title: '',
        value: () => null,
        align: 'center',
        render: (r) => (
          <span className="acoes-linha">
            <button type="button" className="icon-btn" onClick={() => setEditing(r)} title="Editar" aria-label={`Editar código ${r.code} na ${r.baseName}`}>
              <Icon name="editar" size={14} />
            </button>
            <button type="button" className="icon-btn perigo" onClick={() => setDeleting(r)} title="Excluir" aria-label={`Excluir código ${r.code} na ${r.baseName}`}>
              <Icon name="lixeira" size={14} />
            </button>
          </span>
        ),
      });
    }
    return list;
  }, [canEdit]);

  const exportCsv = async () => {
    setExportError(null);
    try {
      await downloadStockControls();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Falha ao exportar.');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setNotice(`Código ${deleting.code} removido da ${deleting.baseName}.`);
      setDeleting(null);
    } catch {
      // a mensagem aparece no próprio diálogo (remove.error)
    }
  };

  const filtered = Boolean(search || base || category || status);

  return (
    <main className="page sem-filtros">
      <section className="cadastro-barra" aria-label="Filtros do cadastro">
        <label className="busca-cadastro">
          <Icon name="busca" size={14} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar código, item, descrição ou comprador"
            aria-label="Buscar no cadastro"
          />
        </label>
        <select value={base} onChange={(e) => setBase(e.target.value)} aria-label="Base de origem">
          <option value="">Todas as bases</option>
          {OPERATIONAL_BASES.map((b) => <option key={b} value={b}>{shortBase(b)}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Situação">
          <option value="">Todas as situações</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status do estoque">
          <option value="">Qualquer status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === NOT_IN_VOALLE ? 'Sem saldo no Voalle' : s}</option>)}
        </select>
        {filtered && (
          <button type="button" className="btn" onClick={() => { setSearch(''); setBase(''); setCategory(''); setStatus(''); }}>
            Limpar
          </button>
        )}
        <span className="espaco" />
        {canEdit && (
          <button type="button" className="btn primario" onClick={() => setEditing('new')} disabled={!data}>
            <Icon name="mais" size={14} /> Novo item
          </button>
        )}
      </section>

      {notice && <div className="banner ok" role="status">{notice}</div>}
      {!canEdit && (
        <Banner>
          Você pode consultar o cadastro. Para incluir ou alterar itens, peça acesso de edição a um administrador.
        </Banner>
      )}
      {error && <ErrorBanner error={error} />}
      {isPending && <Loading text="Carregando o cadastro…" />}

      {data && (
        <Visual
          title="Controle de estoque · cadastro"
          subtitle={`${filtered ? `${int(rows.length)} de ` : ''}${int(data.total)} itens${data.updatedAt ? ` · última alteração ${timeAgo(data.updatedAt)}` : ''}`}
          className="v-cadastro"
          flush
          actions={(
            <button type="button" className="btn-exportar" onClick={exportCsv} title={exportError ?? 'Baixar o cadastro inteiro em CSV'}>
              <Icon name={exportError ? 'alerta' : 'baixar'} size={13} /> CSV
            </button>
          )}
        >
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
        </Visual>
      )}

      {editing && (
        <StockControlDialog
          item={editing === 'new' ? null : editing}
          categories={categories}
          buyers={buyers}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message);
          }}
        />
      )}

      {deleting && (
        <Dialog
          title={`Excluir o código ${deleting.code}?`}
          size="sm"
          onClose={() => { remove.reset(); setDeleting(null); }}
          busy={remove.isPending}
        >
          <div className="confirmacao">
            <p>
              <b>{deleting.item ?? deleting.voalle?.description ?? `Código ${deleting.code}`}</b> sai do controle na{' '}
              <b>{deleting.baseName}</b>: as telas de alerta deixam de ter mínimo, alerta e situação dele nessa base.
            </p>
            {remove.error && <div className="banner error" role="alert">{remove.error.message}</div>}
            <footer>
              <button type="button" className="btn" onClick={() => { remove.reset(); setDeleting(null); }} disabled={remove.isPending} data-autofocus>
                Cancelar
              </button>
              <button type="button" className="btn perigo" onClick={confirmDelete} disabled={remove.isPending}>
                {remove.isPending ? 'Excluindo…' : 'Excluir'}
              </button>
            </footer>
          </div>
        </Dialog>
      )}
    </main>
  );
}
