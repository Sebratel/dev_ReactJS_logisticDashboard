import { useMemo, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Banner, ErrorBanner, Loading } from '../../components/ui/States';
import { Visual } from '../../components/ui/Visual';
import { useProductivityStaff, useSaveProductivityStaff } from '../../hooks/useAdmin';
import { int, labelInstant } from '../../utils/format';

const SUGGESTIONS = 12;

/**
 * Quem aparece na "Produtividade almox" (seção Gerencial). Começa com as
 * pessoas do Power BI; as sugestões são quem mais enviou romaneio nos dois
 * meses da tela e ainda não está na lista. Salvar troca a lista inteira e
 * entra no log de edições.
 */
export function ProductivityStaffEditor() {
  const staff = useProductivityStaff(true);
  const save = useSaveProductivityStaff();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [typed, setTyped] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const names = draft ?? staff.data?.names ?? [];
  const dirty = draft !== null;
  const candidates = useMemo(
    () => (staff.data?.candidates ?? []).filter((c) => !names.includes(c.name)),
    [staff.data, names],
  );

  const add = (name: string) => {
    const clean = name.trim();
    if (!clean || names.includes(clean)) return;
    setDraft([...names, clean].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    setTyped('');
    setMessage(null);
  };
  const remove = (name: string) => {
    setDraft(names.filter((n) => n !== name));
    setMessage(null);
  };
  const submit = async () => {
    if (!draft) return;
    try {
      await save.mutateAsync(draft);
      setDraft(null);
      setMessage('Lista salva — a tela de produtividade já usa a nova lista.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível salvar a lista.');
    }
  };

  const updated = staff.data?.updatedAt
    ? `alterada em ${labelInstant(staff.data.updatedAt)} por ${staff.data.updatedBy ?? '—'}`
    : 'lista inicial (a do Power BI)';

  return (
    <Visual
      title="Gerencial · quem aparece na produtividade almox"
      subtitle={staff.data ? `${int(names.length)} pessoas · ${updated}` : undefined}
      className="v-auto"
    >
      {staff.error && <ErrorBanner error={staff.error} />}
      {staff.isPending && <Loading text="Carregando a lista…" />}
      {staff.data && (
        <div className="equipe-editor">
          <ul className="equipe-nomes" aria-label="Pessoas na produtividade">
            {names.map((n) => (
              <li key={n}>
                {n}
                <button type="button" onClick={() => remove(n)} aria-label={`Tirar ${n}`} title="Tirar da lista" disabled={save.isPending}>
                  <Icon name="fechar" size={12} />
                </button>
              </li>
            ))}
            {!names.length && <li className="vazio">Ninguém na lista — a tela fica vazia.</li>}
          </ul>

          <form className="equipe-incluir" onSubmit={(e) => { e.preventDefault(); add(typed); }}>
            <input
              list="equipe-candidatos"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Nome como está no Voalle"
              aria-label="Incluir pessoa"
              maxLength={120}
            />
            <datalist id="equipe-candidatos">
              {candidates.map((c) => <option key={c.name} value={c.name} />)}
            </datalist>
            <button type="submit" className="btn" disabled={!typed.trim() || save.isPending}>
              <Icon name="mais" size={13} /> Incluir
            </button>
          </form>

          {candidates.length > 0 && (
            <div className="equipe-sugestoes">
              <span>Enviaram romaneio nos dois meses da tela e não estão na lista:</span>
              {candidates.slice(0, SUGGESTIONS).map((c) => (
                <button key={c.name} type="button" className="chip" onClick={() => add(c.name)} disabled={save.isPending} title="Incluir na lista">
                  <Icon name="mais" size={11} /> {c.name} <small>{int(c.patrimonies)}</small>
                </button>
              ))}
            </div>
          )}

          {message && <Banner tone={save.isError ? 'error' : undefined}>{message}</Banner>}

          {dirty && (
            <footer className="equipe-acoes">
              <button type="button" className="btn" onClick={() => { setDraft(null); setMessage(null); }} disabled={save.isPending}>
                Descartar
              </button>
              <button type="button" className="btn primario" onClick={submit} disabled={save.isPending}>
                {save.isPending ? 'Salvando…' : 'Salvar lista'}
              </button>
            </footer>
          )}
        </div>
      )}
    </Visual>
  );
}
