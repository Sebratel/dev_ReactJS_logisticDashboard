import { existsSync } from 'node:fs';
import { join } from 'node:path';
import compression from 'compression';
import express, { type Express } from 'express';
import { appConfig } from './config/env.config.js';
import { apiNotFoundHandler, errorHandler } from './common/middlewares/error-handler.middleware.js';
import { apiRateLimit, securityHeaders } from './common/middlewares/security.middleware.js';
import { logger } from './common/helpers/logger.helper.js';
import { auditEventsRouter } from './modules/audit/audit-events.controller.js';
import { authRouter } from './modules/auth/auth.controller.js';
import { dataSourcesRouter } from './modules/data-sources/data-sources.controller.js';
import { healthRouter } from './modules/health/health.controller.js';
import { managementReportsRouter, productivityStaffRouter } from './modules/management/management.controller.js';
import { productsRouter } from './modules/products/products.controller.js';
import { reportsRouter } from './modules/reports/reports.controller.js';
import { stockControlsRouter } from './modules/stock-controls/stock-controls.controller.js';
import { usersRouter } from './modules/users/users.controller.js';

/**
 * Monta a aplicação sem abrir porta — `main.ts` sobe o servidor; os testes
 * usam isto direto.
 *
 * Sem CORS: a SPA é servida por este mesmo servidor (em desenvolvimento o Vite
 * faz proxy de /api), então nenhuma outra origem precisa chamar a API.
 */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  if (appConfig.trustProxy > 0) app.set('trust proxy', appConfig.trustProxy);

  app.use(securityHeaders());
  app.use(compression());
  app.use(express.json({ limit: '10kb' }));

  const api = express.Router();
  api.use('/health', healthRouter);
  api.use(apiRateLimit);
  api.use('/auth', authRouter);
  api.use('/data-sources', dataSourcesRouter);
  api.use('/reports', reportsRouter);
  api.use('/management-reports', managementReportsRouter);
  api.use('/productivity-staff', productivityStaffRouter);
  api.use('/stock-controls', stockControlsRouter);
  api.use('/products', productsRouter);
  api.use('/users', usersRouter);
  api.use('/audit-events', auditEventsRouter);
  api.use(apiNotFoundHandler);
  app.use('/api/v1', api);
  app.use('/api', apiNotFoundHandler);

  // SPA (build do Vite copiado para server/public na imagem Docker)
  if (existsSync(appConfig.publicDir)) {
    app.use(express.static(appConfig.publicDir, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(appConfig.publicDir, 'index.html'));
    });
  } else {
    logger.warn('web', `pasta ${appConfig.publicDir} não encontrada — servindo só a API`);
  }

  app.use(errorHandler);
  return app;
}
