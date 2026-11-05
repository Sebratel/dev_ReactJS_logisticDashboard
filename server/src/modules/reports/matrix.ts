import { compareText } from '../../common/helpers/aggregation.helper.js';

/**
 * Matriz no formato do pivot do Power BI: linhas em níveis (que a tela abre e
 * fecha), colunas de valor, total por linha e linha de total.
 */

export interface MatrixColumn {
  key: string;
  label: string;
}

/** Linha da matriz: valor por coluna, total da linha e os filhos (nível seguinte). */
export interface MatrixNode {
  key: string;
  label: string;
  values: Record<string, number>;
  total: number;
  children?: MatrixNode[];
}

export interface Matrix {
  columns: MatrixColumn[];
  rows: MatrixNode[];
  /** linha de total: por coluna e geral */
  totals: Record<string, number>;
  total: number;
}

export interface MatrixLevel<T> {
  key: (row: T) => string;
  label?: (key: string) => string;
  /** ordem dos irmãos neste nível (padrão: rótulo A-Z) */
  sort?: (a: MatrixNode, b: MatrixNode) => number;
}

interface Building {
  node: MatrixNode;
  children: Map<string, Building>;
}

export const byLabel = (a: MatrixNode, b: MatrixNode) => compareText(a.label, b.label);
export const byKeyNumber = (a: MatrixNode, b: MatrixNode) => Number(a.key) - Number(b.key);
export const byTotalDesc = (a: MatrixNode, b: MatrixNode) => b.total - a.total || compareText(a.label, b.label);
export const byLabelDesc = (a: MatrixNode, b: MatrixNode) => compareText(b.label, a.label);

/**
 * Agrupa as linhas pelos níveis (linhas da matriz) e pela coluna. Sem
 * `valueOf`, conta uma ocorrência por linha; com ele, soma o valor.
 * Coluna sem nenhuma linha não aparece.
 */
export function buildMatrix<T>(
  rows: readonly T[],
  levels: MatrixLevel<T>[],
  columnOf: (row: T) => string,
  columnLabel: (key: string) => string,
  columnSort: (a: string, b: string) => number,
  valueOf: (row: T) => number = () => 1,
): Matrix {
  const root: Building = { node: { key: '', label: '', values: {}, total: 0 }, children: new Map() };
  const columnKeys = new Set<string>();
  for (const row of rows) {
    const col = columnOf(row);
    const value = valueOf(row);
    columnKeys.add(col);
    root.node.values[col] = (root.node.values[col] ?? 0) + value;
    root.node.total += value;
    let current = root;
    for (const level of levels) {
      const key = level.key(row);
      let child = current.children.get(key);
      if (!child) {
        child = { node: { key, label: level.label ? level.label(key) : key, values: {}, total: 0 }, children: new Map() };
        current.children.set(key, child);
      }
      child.node.values[col] = (child.node.values[col] ?? 0) + value;
      child.node.total += value;
      current = child;
    }
  }
  const finish = (building: Building, depth: number): MatrixNode[] => {
    const level = levels[depth];
    const nodes = [...building.children.values()].map((b) => {
      if (b.children.size) b.node.children = finish(b, depth + 1);
      return b.node;
    });
    return nodes.sort(level?.sort ?? byLabel);
  };
  return {
    columns: [...columnKeys].sort(columnSort).map((key) => ({ key, label: columnLabel(key) })),
    rows: finish(root, 0),
    totals: root.node.values,
    total: root.node.total,
  };
}
