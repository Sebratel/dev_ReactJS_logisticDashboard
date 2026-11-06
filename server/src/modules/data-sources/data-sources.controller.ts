import { Router } from 'express';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { AppException } from '../../common/errors/app.exception.js';
import { sendOk } from '../../common/http/api-response.js';
import { getModel, getSourceStatuses } from '../../model/model.store.js';
import { getLiveRefreshState, LIVE_SOURCE_KEYS } from '../../sources/live-refresh.job.js';
import { getRefreshState, requestManualRefresh } from '../../sources/refresh.job.js';
import { MANAGEMENT_SOURCE_KEYS, SOURCES } from '../../sources/source.registry.js';

/** cadência própria de cada fonte (`everyMs`), quando ela não segue a carga horária */
const OWN_CADENCE = new Map<string, () => number>(
  Object.values(SOURCES).flatMap((s) => ('everyMs' in s && s.everyMs ? [[s.key, s.everyMs] as const] : [])),
);
import { recordAudit } from '../audit/audit.service.js';

/**
 * Situação das fontes de dados: quando cada uma foi lida, quantas linhas, se
 * falhou. Alimenta o indicador "atualizado há…" do topo e a capa.
 * A mensagem de erro técnica não sai daqui — a tela recebe só "falhou".
 */
export const dataSourcesRouter = Router();

dataSourcesRouter.get('/', requireAuth(), (req, res) => {
  const model = getModel();
  // as fontes da seção Gerencial só aparecem (e só contam na idade do dado) para quem tem acesso a ela
  const statuses = getSourceStatuses().filter((s) => req.user!.managementAccess || !MANAGEMENT_SOURCE_KEYS.includes(s.key));
  /**
   * Idade REAL do dado: a leitura bem-sucedida mais antiga entre as fontes.
   * `builtAt` não serve para isso — uma carga em que todas as fontes falham
   * ainda remonta o modelo com o dado anterior, e o topo diria "atualizado há
   * 2 min" sobre um dado de ontem (aconteceu numa queda de rede para o Voalle).
   */
  const loadedAt = statuses.map((s) => s.updatedAt).filter((v): v is string => v !== null).sort();
  const refresh = getRefreshState();
  const live = getLiveRefreshState();
  sendOk(res, {
    builtAt: model.version > 0 ? model.builtAt : null,
    dataAsOf: loadedAt[0] ?? null,
    modelVersion: model.version,
    stockControlAvailable: model.hasStockControl,
    refresh,
    live,
    sources: statuses.map((s) => ({
      key: s.key,
      label: s.label,
      origin: s.origin,
      rows: s.rows,
      durationMs: s.durationMs,
      updatedAt: s.updatedAt,
      failed: s.error !== null,
      // de quanto em quanto tempo a fonte é relida (o cadastro do app muda na hora: null)
      intervalMs: LIVE_SOURCE_KEYS.includes(s.key) ? live.intervalMs
        : OWN_CADENCE.get(s.key)?.() ?? (s.origin === 'APP' ? null : refresh.intervalMs),
    })),
  });
});

/** Ação não-CRUD: dispara a carga agora. Só administradores, com intervalo mínimo. */
dataSourcesRouter.post('/refresh', requireAuth({ role: 'ADMIN' }), (req, res) => {
  const result = requestManualRefresh();
  if (result === 'STARTED') recordAudit(req.user!, 'data-sources.refresh', null);
  if (result === 'TOO_SOON') {
    throw new AppException(429, 'REFRESH_TOO_SOON', 'A última atualização começou há menos de 5 minutos. Aguarde um pouco.');
  }
  sendOk(res, { result, refresh: getRefreshState() }, undefined, 202);
});
