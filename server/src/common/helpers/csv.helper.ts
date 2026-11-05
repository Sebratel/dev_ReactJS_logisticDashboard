/**
 * Escrita de CSV para as exportações.
 */

const BOM = '\ufeff';

/**
 * Neutraliza injeção de fórmula: célula que começa com = + - @ (ou tab/CR) é
 * executada pelo Excel ao abrir o arquivo. Nomes vindos do ERP são texto livre,
 * então qualquer um deles pode virar fórmula na máquina de quem exportou.
 */
function sanitizeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    // número cru, com vírgula decimal, para a planilha em português somar
    return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
  }
  const text = sanitizeCell(String(value));
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/** CSV que abre direto no Excel em português: separador ";" e BOM UTF-8. */
export function toCsv<T>(columns: CsvColumn<T>[], rows: Iterable<T>): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(';')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(';'));
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
