import { appConfig, hasMaria, hasVoalle } from './config/env.config.js';
import { logger } from './common/helpers/logger.helper.js';
import { closeMaria } from './database/maria.client.js';
import { closeVoalle } from './database/voalle.client.js';
import { onStockControlChange } from './modules/stock-controls/stock-control.service.js';
import { startLiveRefresh, stopLiveRefresh } from './sources/live-refresh.job.js';
import { applyStockControls, startRefreshScheduler, stopRefreshScheduler } from './sources/refresh.job.js';
import { createApp } from './app.js';

/**
 * Em produção, subir SEM login é falha de configuração, não opção silenciosa:
 * sem GOOGLE_CLIENT_ID o middleware deixaria qualquer um que alcance a URL ver
 * dado do ERP. Quem realmente quiser isso declara AUTH_ENABLED=false.
 */
if (appConfig.isProduction && !appConfig.auth.enabled) {
  if (appConfig.auth.requested) {
    logger.error('auth', 'GOOGLE_CLIENT_ID não definido — sem ele não há login. Defina-o (e ADMIN_EMAILS) na stack.');
    process.exit(1);
  }
  logger.warn('auth', 'AUTH_ENABLED=false em produção: o dashboard está ABERTO para quem alcançar a URL.');
}

/**
 * Painel de LEITURA: uma promessa rejeitada sem tratamento não derruba o
 * processo (a tela segue com o dado anterior), mas fica registrada. Exceção
 * não capturada derruba, de propósito: o estado do processo é desconhecido e
 * servir número errado é pior do que não servir.
 */
process.on('unhandledRejection', (reason) => {
  logger.error('processo', `promessa rejeitada sem tratamento: ${reason instanceof Error ? reason.stack : String(reason)}`);
});
process.on('uncaughtException', (err) => {
  logger.error('processo', `exceção não capturada — encerrando: ${err.stack ?? err.message}`);
  process.exit(1);
});

logger.info('config', `dados da aplicação em ${appConfig.dataPath}`);
logger.info('config', `arquivos .env carregados: ${appConfig.loadedEnvFiles.length ? appConfig.loadedEnvFiles.join(', ') : 'nenhum (só variáveis do ambiente)'}`);
logger.info('config', `Voalle: ${hasVoalle ? 'ok' : 'NÃO configurado'} · MariaDB: ${hasMaria ? 'ok' : 'NÃO configurado'} · login: ${appConfig.auth.enabled ? 'Google' : 'DESLIGADO'}`);

const server = createApp().listen(appConfig.port, appConfig.host, () => {
  logger.info('web', `Estoque Sebratel em http://${appConfig.host === '0.0.0.0' ? 'localhost' : appConfig.host}:${appConfig.port}`);
});
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

// alteração no cadastro de controle de estoque vale na hora nas telas de alerta
onStockControlChange(applyStockControls);
startRefreshScheduler();
// tela de Compras: saldo de itens e pedidos lançados, relidos a cada minuto
startLiveRefresh();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info('web', `${signal} recebido, encerrando…`);
    stopRefreshScheduler();
    stopLiveRefresh();
    server.close(() => {
      void Promise.allSettled([closeVoalle(), closeMaria()]).then(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
