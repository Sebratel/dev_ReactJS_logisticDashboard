import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { int } from '../../utils/format';
import { Icon } from '../ui/Icon';

export interface Column<T> {
  key: string;
  title: string;
  value: (row: T) => string | number | null;
  render?: (row: T) => ReactNode;
  /**
   * Sem `align`, a coluna se alinha sozinha: número, valor, quantidade, data e
   * código só de dígitos ficam CENTRALIZADOS; texto fica à esquerda (ver
   * `columnAlign`). Não existe alinhamento à direita, de propósito.
   */
  align?: 'left' | 'center';
  /** classe de estado da célula (formatação condicional do relatório) */
  cellClass?: (row: T) => string | undefined;
  /** barra de dados dentro da célula, proporcional ao maior valor da coluna */
  databar?: boolean;
  wrap?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  initialSort?: { key: string; dir: 'asc' | 'desc' } | null;
  footer?: Record<string, ReactNode> | null;
  total?: number;
  onRowClick?: (row: T) => void;
  isSelected?: (row: T) => boolean;
  /**
   * Tabela sem limite de linhas (dezenas de milhares): acima de
   * `VIRTUAL_FROM` linhas desenha só as que estão à vista, e o resto vira
   * espaço vazio da mesma altura — a barra de rolagem continua a da lista toda.
   */
  virtual?: boolean;
}

const VIRTUAL_FROM = 300;
/** linhas desenhadas a mais acima e abaixo da área visível (a rolagem rápida não mostra buraco) */
const OVERSCAN = 15;

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/** Data ISO ('2026-11-04', '2026-11-04 10:22:31') ou número escrito só com dígitos (código, nota, protocolo). */
const NUMERIC_TEXT = /^(\d{4}-\d{2}-\d{2}|-?\d+([.,]\d+)?$)/;

const isNumericLike = (value: string | number | null): boolean => (
  typeof value === 'number' || (typeof value === 'string' && NUMERIC_TEXT.test(value.trim()))
);

/**
 * Alinhamento de uma coluna sem `align` explícito, decidido UMA vez para a
 * coluna inteira (não célula a célula, que deixaria a coluna torta): se os
 * valores preenchidos são número, data ou código numérico, centraliza.
 */
export function columnAlign<T>(column: Pick<Column<T>, 'align' | 'value'>, rows: readonly T[]): 'left' | 'center' {
  if (column.align) return column.align;
  let seen = 0;
  for (const row of rows) {
    const value = column.value(row);
    if (value === null || value === '') continue;
    if (!isNumericLike(value)) return 'left';
    seen += 1;
    if (seen >= 200) break;
  }
  return seen > 0 ? 'center' : 'left';
}

/**
 * Tabela no estilo do tableEx do Power BI: cabeçalho com linha dourada,
 * número/valor/data centralizados, ordenação no clique do cabeçalho, barra de dados e
 * células com cor de estado. A ordem inicial é a do servidor (a mesma do
 * relatório) até a pessoa clicar num cabeçalho.
 */
export function DataTable<T>({
  columns, rows, rowKey, initialSort = null, footer = null, total, onRowClick, isSelected, virtual = false,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = column.value(a);
      const vb = column.value(b);
      if (typeof va === 'number' || typeof vb === 'number') return ((Number(va) || 0) - (Number(vb) || 0)) * factor;
      return collator.compare(String(va ?? ''), String(vb ?? '')) * factor;
    });
  }, [rows, sort, columns]);

  const maxima = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of columns) {
      if (!c.databar) continue;
      let max = 1;
      for (const r of rows) max = Math.max(max, Math.abs(Number(c.value(r)) || 0));
      out[c.key] = max;
    }
    return out;
  }, [columns, rows]);

  const aligns = useMemo(() => {
    const out: Record<string, 'left' | 'center'> = {};
    for (const c of columns) out[c.key] = columnAlign(c, rows);
    return out;
  }, [columns, rows]);

  // ---- linhas à vista (tabela virtual)
  const isVirtual = virtual && sorted.length > VIRTUAL_FROM;
  const wrapRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [view, setView] = useState({ top: 0, height: 600, width: 0 });
  const [rowHeight, setRowHeight] = useState(27);
  // larguras das colunas, medidas na primeira página e travadas: sem isso a coluna "dança" a cada rolagem
  const [lock, setLock] = useState<{ rows: T[]; columns: Column<T>[]; width: number; widths: number[] } | null>(null);
  const widths = isVirtual && lock && lock.rows === rows && lock.columns === columns && lock.width === view.width ? lock.widths : null;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!isVirtual || !el) return undefined;
    const update = () => setView((v) => (v.top === el.scrollTop && v.height === el.clientHeight && v.width === el.clientWidth
      ? v : { top: el.scrollTop, height: el.clientHeight, width: el.clientWidth }));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, [isVirtual]);

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!isVirtual || !table) return;
    if (!widths) {
      const measured = [...table.querySelectorAll<HTMLTableCellElement>('thead th')].map((th) => Math.ceil(th.getBoundingClientRect().width));
      setLock({ rows, columns, width: view.width, widths: measured });
      return;
    }
    const first = table.querySelector<HTMLTableRowElement>('tbody tr[data-linha]');
    const h = first?.getBoundingClientRect().height;
    if (h && Math.abs(h - rowHeight) > 0.25) setRowHeight(h);
  });

  let start = 0;
  let end = sorted.length;
  if (isVirtual) {
    start = Math.max(0, Math.floor(view.top / rowHeight) - OVERSCAN);
    end = Math.min(sorted.length, start + Math.ceil(view.height / rowHeight) + OVERSCAN * 2);
  }
  const visible = isVirtual ? sorted.slice(start, end) : sorted;

  const clickHeader = (key: string) => setSort((s) => (s?.key === key
    ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: 'desc' }));

  const tableClass = ['pbi', isVirtual ? 'virtual' : '', widths ? 'travada' : ''].filter(Boolean).join(' ');

  return (
    <>
      <div className="tbl-wrap" ref={wrapRef}>
        <table className={tableClass} ref={tableRef}>
          {widths && (
            <colgroup>
              {widths.map((w, i) => <col key={columns[i]?.key ?? i} style={{ width: w }} />)}
            </colgroup>
          )}
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.align === 'left' ? 'left' : ''} onClick={() => clickHeader(c.key)} title="Ordenar">
                  {c.title}
                  {sort?.key === c.key && <Icon name={sort.dir === 'asc' ? 'cima' : 'baixo'} size={11} className="ord" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isVirtual && start > 0 && (
              <tr className="vt-espaco" aria-hidden="true"><td colSpan={columns.length} style={{ height: start * rowHeight }} /></tr>
            )}
            {visible.map((row, j) => {
              const i = start + j;
              const selected = isSelected?.(row) ?? false;
              return (
                <tr
                  key={rowKey(row, i)}
                  data-linha={isVirtual ? '' : undefined}
                  className={`${onRowClick ? 'clicavel' : ''}${selected ? ' sel' : ''}`.trim() || undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  title={onRowClick ? (selected ? 'Clique para remover o filtro' : 'Clique para filtrar a tela por esta linha') : undefined}
                >
                  {columns.map((c) => {
                    const raw = c.value(row);
                    const content = c.render ? c.render(row) : (typeof raw === 'number' ? int(raw) : raw ?? '');
                    const align = aligns[c.key] ?? 'left';
                    const classes = [align, c.wrap ? 'wrap' : '', c.cellClass?.(row) ?? ''].filter(Boolean).join(' ');
                    if (c.databar && typeof raw === 'number') {
                      const pct = (Math.abs(raw) / (maxima[c.key] ?? 1)) * 100;
                      return (
                        <td key={c.key} className={classes}>
                          <span className="databar"><i style={{ width: `${Math.max(pct, 2)}%` }} /><span>{content}</span></span>
                        </td>
                      );
                    }
                    return (
                      <td key={c.key} className={classes} title={typeof raw === 'string' ? raw : undefined}>{content}</td>
                    );
                  })}
                </tr>
              );
            })}
            {isVirtual && end < sorted.length && (
              <tr className="vt-espaco" aria-hidden="true"><td colSpan={columns.length} style={{ height: (sorted.length - end) * rowHeight }} /></tr>
            )}
            {!sorted.length && (
              <tr><td colSpan={columns.length} className="center" style={{ padding: 22 }}>Sem dados para os filtros selecionados</td></tr>
            )}
          </tbody>
          {footer && (
            <tfoot>
              <tr>
                {columns.map((c, i) => (
                  <td key={c.key} className={i === 0 ? 'left' : aligns[c.key] ?? 'left'}>{footer[c.key] ?? ''}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {total !== undefined && total > rows.length && (
        <div className="rodape-tabela">
          <span>Mostrando {int(rows.length)} de {int(total)} linhas — o CSV leva todas.</span>
        </div>
      )}
    </>
  );
}
