import type { Theme } from './theme';

/**
 * As cores que o Recharts precisa como VALOR (ele não lê variável CSS).
 * Espelham `styles/theme.css` — mudou lá, muda aqui.
 */
export interface ChartColors {
  primary: string;
  gold: string;
  goldLight: string;
  orange: string;
  ink: string;
  muted: string;
  grid: string;
  neutral: string;
  cursor: string;
  chipFill: string;
  chipText: string;
  available: string;
  unavailable: string;
}

const LIGHT: ChartColors = {
  primary: '#880F17',
  gold: '#D9B300',
  goldLight: '#F3EAC2',
  orange: '#E66C37',
  ink: '#252423',
  muted: '#605E5C',
  grid: '#E1DFDD',
  neutral: '#C8C6C4',
  cursor: 'rgba(136, 15, 23, 0.06)',
  chipFill: '#252423',
  chipText: '#FFFFFF',
  available: '#7BCA7E',
  unavailable: '#f0a787',
};

const DARK: ChartColors = {
  ...LIGHT,
  goldLight: '#7A6A2A',
  ink: '#ECEAE7',
  muted: '#A5A19B',
  grid: '#4A4744',
  neutral: '#8A8681',
  cursor: 'rgba(255, 255, 255, 0.06)',
  chipFill: '#ECEAE7',
  chipText: '#252423',
};

export const chartColorsFor = (theme: Theme): ChartColors => (theme === 'dark' ? DARK : LIGHT);

/**
 * Identidade FIXA das bases: a cor não muda quando um filtro tira uma base do
 * gráfico. SLE em dourado e Canoas em laranja são as cores que o relatório de
 * origem atribuía explicitamente; a sede fica na tinta da marca.
 */
export function baseColor(base: string, colors: ChartColors): string {
  const key = base.toUpperCase();
  if (key.includes('LEOPOLDO') || key === 'BASE SLE' || key === 'SLE') return colors.gold;
  if (key.includes('CANOAS') || key === 'BASE CAN' || key === 'CAN') return colors.orange;
  if (key.includes('PORTO ALEGRE') || key === 'PAE') return colors.primary;
  return colors.neutral;
}

/** Valor -> gradiente do Power BI (mínimo claro, máximo dourado). */
export function gradient(value: number, min: number, max: number, from: string, to: string): string {
  if (max === min) return to;
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const a = [1, 3, 5].map((i) => parseInt(from.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16));
  return `#${a.map((v, i) => Math.round(v + ((b[i] ?? v) - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
