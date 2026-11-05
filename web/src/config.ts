/**
 * Configuração do front. Nada aqui é segredo: tudo que vai para o bundle é
 * público. O ID do cliente Google vem do servidor (/auth/config), e não de
 * variável VITE_, para existir um lugar só onde ele é configurado.
 */
export const API_BASE_URL = '/api/v1';

/** Releitura automática das telas: o servidor recarrega as fontes de hora em hora. */
export const AUTO_REFRESH_MS = 5 * 60_000;

/**
 * Tela de Compras: o servidor relê as fontes a cada minuto. A tela confere a
 * cada 15 s a versão do dado (`/data-sources`, resposta pequena) e só baixa as
 * tabelas quando ela muda — o dado novo aparece até 15 s depois da leitura.
 */
export const LIVE_STATUS_POLL_MS = 15_000;

export const SUPPORT_EMAIL = 'intel@sebratel.com.br';
