/**
 * Normalização de texto e números vindos das fontes.
 */

/** Chave de comparação: sem acento, maiúscula, espaços colapsados. */
export function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** Texto limpo ou null — vazio e só-espaço viram a mesma coisa. */
export function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

/**
 * Código de produto como inteiro ("05601" -> 5601), igual ao Int64 do Power BI.
 * É a chave que liga Voalle e o cadastro de controle de estoque (o código perde os zeros à esquerda).
 */
export function toProductNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  // número com vírgula decimal: "1.234,5"
  const text = String(value).trim();
  const normalized = /,\d+$/.test(text) ? text.replace(/\./g, '').replace(',', '.') : text;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
