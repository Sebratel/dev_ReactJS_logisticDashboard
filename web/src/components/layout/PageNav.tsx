import { Fragment, useCallback, useEffect, useId, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSession } from '../../context/SessionContext';
import { useDismiss } from '../../hooks/useDismiss';
import { Icon } from '../ui/Icon';
import { AREA_GROUPS, AREA_ROW_LABEL, MANAGEMENT_GROUP, PAGE_BY_PATH, REPORT_GROUPS } from './pages';

/** Uma linha de abas: um grupo (patrimônios, produtos & cabos, gerencial) ou as áreas próprias. */
interface NavRow {
  key: string;
  label: string;
  kind: 'report' | 'management' | 'area';
  paths: readonly string[];
  /** nome da área antes da tela ("COMPRAS · LANÇAMENTO E SALDOS") */
  areas?: readonly string[];
}

const AREA_SCREENS = AREA_GROUPS.flatMap((g) => g.paths.map((path) => ({ area: g.label, path })));
const REPORT_ROWS: NavRow[] = REPORT_GROUPS.map((g) => ({ key: g.key, label: g.label, kind: 'report', paths: g.paths }));
const MANAGEMENT_ROW: NavRow = { key: MANAGEMENT_GROUP.key, label: MANAGEMENT_GROUP.label, kind: 'management', paths: MANAGEMENT_GROUP.paths };
const AREA_ROW: NavRow = {
  key: 'areas', label: AREA_ROW_LABEL, kind: 'area', paths: AREA_SCREENS.map((s) => s.path), areas: AREA_SCREENS.map((s) => s.area),
};
const REPORT_COLUMNS = REPORT_GROUPS[0].paths.length;

interface RowCellsProps {
  row: NavRow;
  gridRow: number;
  pathname: string;
  /** primeira linha da grade: sem a divisória de cima */
  first: boolean;
}

/** As células de uma linha na grade: coluna 1 = grupo; cada tela ocupa um par (ícone, aba). */
function RowCells({ row, gridRow, pathname, first }: RowCellsProps) {
  const below = first ? '' : ' baixo';
  const label = (
    <span className={`nav-grupo${below}${row.paths.includes(pathname) ? ' ativo' : ''}`} style={{ gridRow }} aria-hidden="true">
      {row.label}
    </span>
  );
  if (row.kind === 'management') {
    return (
      <>
        {label}
        <div className={`nav-linha-ger${below}`} style={{ gridRow }}>
          {row.paths.map((path) => {
            const page = PAGE_BY_PATH.get(path);
            if (!page) return null;
            return (
              <NavLink key={path} to={path} className={({ isActive }) => (isActive ? 'active' : undefined)} aria-label={page.label}>
                <Icon name={page.icon ?? 'grade'} size={15} />
                {page.shortLabel ?? page.label}
              </NavLink>
            );
          })}
        </div>
      </>
    );
  }
  return (
    <>
      {label}
      {row.paths.map((path, col) => {
        const page = PAGE_BY_PATH.get(path);
        if (!page) return null;
        return (
          <Fragment key={path}>
            <span
              className={`nav-icone${below}${pathname === path ? ' ativo' : ''}`}
              style={{ gridRow, gridColumn: col * 2 + 2 }}
              aria-hidden="true"
            >
              <Icon name={page.icon ?? 'grade'} size={18} />
            </span>
            <NavLink
              to={path}
              style={{ gridRow, gridColumn: col * 2 + 3 }}
              className={({ isActive }) => `${below.trim()}${isActive ? ' active' : ''}`.trim() || undefined}
              aria-label={page.label}
            >
              {row.areas && <span className="nav-area">{row.areas[col]}</span>}
              {page.shortLabel ?? page.label}
            </NavLink>
          </Fragment>
        );
      })}
      {row.paths.length < REPORT_COLUMNS && (
        <span className={`nav-vazio${below}`} style={{ gridRow, gridColumn: `${row.paths.length * 2 + 2} / -1` }} aria-hidden="true" />
      )}
    </>
  );
}

/**
 * Abas das telas, RECOLHIDAS: fica à vista só a linha do grupo da tela aberta
 * (ex.: Patrimônios › alerta, romaneio, alocação, em carga) — uma linha de
 * altura em vez de quatro. "Mais telas" abre os OUTROS grupos logo abaixo, POR
 * CIMA do conteúdo (a página não pula); o painel se fecha ao escolher uma
 * tela, ao clicar fora ou com Esc.
 */
export function PageNav() {
  const { pathname } = useLocation();
  const { hasManagement } = useSession();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  const panelId = useId();

  // escolheu uma tela: o bloco se recolhe
  useEffect(() => setOpen(false), [pathname]);

  const rows = [...REPORT_ROWS, ...(hasManagement ? [MANAGEMENT_ROW] : []), AREA_ROW];
  const current = rows.find((r) => r.paths.includes(pathname));
  const others = rows.filter((r) => r !== current);

  return (
    <div className={`pagenav-wrap${open ? ' aberta' : ''}`} ref={ref}>
      <nav className="pagenav" aria-label="Telas do grupo aberto">
        {current ? (
          <RowCells row={current} gridRow={1} pathname={pathname} first />
        ) : (
          <>
            <span className="nav-grupo" style={{ gridRow: 1 }} aria-hidden="true">Telas</span>
            <span className="nav-dica" style={{ gridRow: 1 }}>Escolha uma tela em “Mais telas”</span>
          </>
        )}
      </nav>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        title={open ? 'Recolher as abas' : 'Mostrar as telas dos outros grupos'}
      >
        <Icon name={open ? 'cima' : 'baixo'} size={14} />
        <span>{open ? 'Recolher' : 'Mais telas'}</span>
      </button>
      {open && (
        <nav
          id={panelId}
          className="pagenav pagenav-painel"
          style={{ gridTemplateRows: `repeat(${others.length}, var(--h-nav-linha))` }}
          aria-label="Telas dos outros grupos"
        >
          {others.map((row, i) => (
            <RowCells key={row.key} row={row} gridRow={i + 1} pathname={pathname} first={i === 0} />
          ))}
        </nav>
      )}
    </div>
  );
}
