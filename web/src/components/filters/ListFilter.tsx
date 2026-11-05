import { useCallback, useMemo, useState } from 'react';
import { useDismiss } from '../../hooks/useDismiss';
import { Icon } from '../ui/Icon';

interface ListFilterProps {
  label: string;
  options: string[];
  value: string[];
  onChange: (values: string[]) => void;
}

const MAX_RENDERED = 400;
/** largura máxima da lista (`.pop` no CSS) mais uma folga da borda da tela */
const POP_MAX_WIDTH = 360 + 16;

/** Seletor de lista com busca interna — o slicer "Dropdown" do relatório. */
export function ListFilter({ label, options, value, onChange }: ListFilterProps) {
  const [open, setOpen] = useState(false);
  // a lista abre para a direita do botão; só abre para a esquerda quando não
  // cabe — a posição do botão depende de quantos filtros a barra quebrou em linhas
  const [alignRight, setAlignRight] = useState(false);
  const [search, setSearch] = useState('');
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (term ? options.filter((o) => o.toLowerCase().includes(term)) : options).slice(0, MAX_RENDERED);
  }, [options, search]);

  const toggle = (option: string) => onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  const summary = value.length === 1 ? value[0] : value.length ? `${value.length} selecionados` : 'todos';

  return (
    <div className={`filtro${value.length ? ' ativo' : ''}`} ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          if (!open) setAlignRight(e.currentTarget.getBoundingClientRect().left + POP_MAX_WIDTH > window.innerWidth);
          setOpen((o) => !o);
        }}
        title={value.join(', ') || 'todos'}
        aria-label={`${label}: ${summary}`}
        aria-expanded={open}
      >
        <span className="nome">{label}</span>
        <span className="valor">{summary}</span>
        {value.length > 1 && <span className="contador">{value.length}</span>}
        <Icon name="baixo" size={12} className="seta" />
      </button>
      {open && (
        <div className={`pop${alignRight ? ' direita' : ''}`}>
          <input
            className="busca-interna"
            autoFocus
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={`Buscar em ${label}`}
          />
          <div className="lista">
            {visible.map((option) => (
              <label key={option}>
                <input type="checkbox" checked={value.includes(option)} onChange={() => toggle(option)} />
                <span title={option}>{option}</span>
              </label>
            ))}
            {!visible.length && <div className="nada">Nada encontrado</div>}
          </div>
          <div className="acoes">
            <button type="button" onClick={() => onChange([])}>Limpar</button>
            <span>
              {options.length > MAX_RENDERED && !search ? `${MAX_RENDERED} de ${options.length} — use a busca` : `${options.length} opções`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
