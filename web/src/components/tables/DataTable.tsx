import { useMemo, useState, type ReactNode } from 'react';
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
}

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
  columns, rows, rowKey, initialSort = null, footer = null, total, onRowClick, isSelected,
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
      if (c.databar) out[c.key] = Math.max(1, ...rows.map((r) => Math.abs(Number(c.value(r)) || 0)));
    }
    return out;
  }, [columns, rows]);

  const aligns = useMemo(() => {
    const out: Record<string, 'left' | 'center'> = {};
    for (const c of columns) out[c.key] = columnAlign(c, rows);
    return out;
  }, [columns, rows]);

  const clickHeader = (key: string) => setSort((s) => (s?.key === key
    ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: 'desc' }));

  return (
    <>
      <div className="tbl-wrap">
        <table className="pbi">
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
            {sorted.map((row, i) => {
              const selected = isSelected?.(row) ?? false;
              return (
                <tr
                  key={rowKey(row, i)}
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
