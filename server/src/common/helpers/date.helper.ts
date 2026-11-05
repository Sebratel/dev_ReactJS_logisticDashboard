/**
 * Datas como texto ISO local ('AAAA-MM-DD'). O processo roda com
 * TZ=America/Sao_Paulo (Dockerfile), então "hoje" é o dia civil da operação.
 */
const pad = (n: number): string => String(n).padStart(2, '0');

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Os três meses FECHADOS anteriores ao mês corrente — a janela das medidas
 * MEDIA_3_MESES do Power BI: de EOMONTH(TODAY(), -4) + 1 até EOMONTH(TODAY(), -1).
 */
export function lastThreeClosedMonths(now = new Date()): { start: string; end: string } {
  const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: todayIso(start), end: todayIso(end) };
}

/** A data (sem hora) de um texto 'AAAA-MM-DD[ HH:mm:ss]'. */
export const datePart = (value: string | null): string | null => (value ? value.slice(0, 10) : null);

export function isWithin(value: string | null, start?: string, end?: string): boolean {
  if (!start && !end) return true;
  const day = datePart(value);
  if (!day) return false;
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

/** Soma (ou subtrai) dias de uma data ISO — usado para recortar "últimos N dias". */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days);
  return todayIso(date);
}
