/**
 * Formatação condicional do Power BI "CMP - Lançamento e Saldos": fundo da
 * célula STATUS por status do pedido, e verde no "Sim" de atualiza estoque /
 * gera patrimônio. As cores ficam no tema (`--compra-*`).
 */
const STATUS_CLASS: Record<string, string> = {
  Cancelado: 'st cmp-cancelado',
  'Aguardando Entrega': 'st cmp-aguardando',
  'Inclusão': 'st cmp-inclusao',
  Recebido: 'st cmp-recebido',
};

export const purchaseStatusClass = (status: string | null): string | undefined => (status ? STATUS_CLASS[status] : undefined);

export const yesClass = (value: string | null): string | undefined => (value === 'Sim' ? 'st cmp-sim' : undefined);
