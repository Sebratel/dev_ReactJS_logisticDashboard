import { useMemo, useState } from 'react';
import type { Matrix, MatrixNode } from '../../services/types';
import { int } from '../../utils/format';
import { Icon } from '../ui/Icon';

interface MatrixTableProps {
  matrix: Matrix;
  /** título da coluna das linhas — os níveis, ex.: "ANO / MÊS / DIA" */
  rowHeader: string;
  /** título da coluna de total da linha; null esconde a coluna */
  totalHeader?: string | null;
  /** formato das células (padrão: inteiro) — ex.: moeda */
  format?: (value: number) => string;
}

interface VisibleRow {
  node: MatrixNode;
  path: string;
  depth: number;
}

const SEPARATOR = ' > ';

function expandablePaths(nodes: MatrixNode[], parent = ''): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    if (!node.children?.length) continue;
    const path = parent + SEPARATOR + node.key;
    out.push(path, ...expandablePaths(node.children, path));
  }
  return out;
}

/**
 * Matriz no estilo do pivot do Power BI: linhas em níveis que abrem e fecham
 * (+/−), colunas de valor, total da linha e linha de total. Começa recolhida,
 * como as matrizes do relatório original. Célula sem valor fica em branco.
 */
export function MatrixTable({ matrix, rowHeader, totalHeader = 'TOTAL', format = int }: MatrixTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const allPaths = useMemo(() => expandablePaths(matrix.rows), [matrix]);

  const visible = useMemo(() => {
    const out: VisibleRow[] = [];
    const walk = (nodes: MatrixNode[], depth: number, parent: string) => {
      for (const node of nodes) {
        const path = parent + SEPARATOR + node.key;
        out.push({ node, path, depth });
        if (node.children?.length && expanded.has(path)) walk(node.children, depth + 1, path);
      }
    };
    walk(matrix.rows, 0, '');
    return out;
  }, [matrix, expanded]);

  const toggle = (path: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  });

  const showTotal = totalHeader !== null;

  return (
    <div className="tbl-wrap">
      <table className="pbi matriz">
        <thead>
          <tr>
            <th className="left">
              <span className="matriz-cabeca">
                {rowHeader}
                {allPaths.length > 0 && (
                  <span className="matriz-acoes">
                    <button type="button" onClick={() => setExpanded(new Set(allPaths))} title="Abrir todos os níveis" aria-label="Abrir todos os níveis">
                      <Icon name="mais" size={11} />
                    </button>
                    <button type="button" onClick={() => setExpanded(new Set())} title="Recolher tudo" aria-label="Recolher tudo">
                      <Icon name="cima" size={11} />
                    </button>
                  </span>
                )}
              </span>
            </th>
            {matrix.columns.map((c) => <th key={c.key}>{c.label}</th>)}
            {showTotal && <th className="total">{totalHeader}</th>}
          </tr>
        </thead>
        <tbody>
          {visible.map(({ node, path, depth }) => {
            const canOpen = Boolean(node.children?.length);
            const isOpen = canOpen && expanded.has(path);
            return (
              <tr key={path} className={`nivel-${Math.min(depth, 3)}`}>
                <td className="left rotulo" style={{ paddingLeft: 6 + depth * 18 }} title={node.label}>
                  {canOpen ? (
                    <button
                      type="button"
                      className="matriz-abrir"
                      onClick={() => toggle(path)}
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? 'Recolher' : 'Abrir'} ${node.label}`}
                    >
                      {isOpen ? '−' : '+'}
                    </button>
                  ) : <span className="matriz-folha" />}
                  {node.label}
                </td>
                {matrix.columns.map((c) => {
                  const value = node.values[c.key];
                  return <td key={c.key} className="center">{value === undefined ? '' : format(value)}</td>;
                })}
                {showTotal && <td className="center total">{format(node.total)}</td>}
              </tr>
            );
          })}
          {!visible.length && (
            <tr><td colSpan={matrix.columns.length + (showTotal ? 2 : 1)} className="center" style={{ padding: 22 }}>Sem dados para os filtros selecionados</td></tr>
          )}
        </tbody>
        {visible.length > 0 && (
          <tfoot>
            <tr>
              <td className="left">Total</td>
              {matrix.columns.map((c) => {
                const value = matrix.totals[c.key];
                return <td key={c.key} className="center">{value === undefined ? '' : format(value)}</td>;
              })}
              {showTotal && <td className="center total">{format(matrix.total)}</td>}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
