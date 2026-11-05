/** Classe CSS do status real do patrimônio (formatação condicional do relatório). */
export function patrimonyStatusClass(status: string): string {
  if (status === 'Disponível') return 'st st-disponivel';
  if (status === 'Indisponível') return 'st st-indisponivel';
  if (status === 'Extraviado') return 'st st-extraviado';
  if (status === 'Aguardando Retorno') return 'st st-aguardando';
  if (status === 'Descarte') return 'st st-descarte';
  if (status === 'Vendido') return 'st st-vendido';
  return 'st st-indisponivel';
}

/**
 * Cor do status para o gráfico (o Recharts precisa do valor, não da variável).
 * Espelha as variables --status-* de styles/theme.css, que não mudam com o tema.
 */
const STATUS_COLORS: Record<string, string> = {
  Disponível: '#7BCA7E',
  Indisponível: '#f0a787',
  Extraviado: '#a666b0',
  'Aguardando Retorno': '#70bbff',
  Descarte: '#de6a73',
  Vendido: '#b3b3b3',
};

export const patrimonyStatusColor = (status: string): string => STATUS_COLORS[status] ?? '#f0a787';
