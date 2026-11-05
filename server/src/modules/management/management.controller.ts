import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { todayIso } from '../../common/helpers/date.helper.js';
import { sendOk } from '../../common/http/api-response.js';
import { cacheKey, getCached, setCached } from '../../common/http/response-cache.js';
import { writeRateLimit } from '../../common/middlewares/security.middleware.js';
import { getModel } from '../../model/model.store.js';
import type { DataModel } from '../../model/model.types.js';
import {
  buildCreatedObjectsReport, buildFlatConsumptionReport, buildObsoleteEquipmentReport, buildProductivityReport,
  buildZteMovementsReport, buildZteUsedReport,
} from './management.service.js';
import { getProductivityStaff, getProductivityStaffNames, setProductivityStaff } from './productivity-staff.service.js';

/**
 * Seção GERENCIAL (Power BI "LOG - Gerencial"): só quem um administrador
 * liberou (e os próprios administradores). Sem filtros de tela — os períodos
 * são os do relatório, contados a partir de hoje, então o dia entra na chave
 * do cache junto com a versão do modelo.
 */
export const managementReportsRouter = Router();

managementReportsRouter.use(requireAuth({ management: true }));

function respond<T>(res: Response, route: string, build: (model: DataModel, today: string) => T): void {
  const model = getModel();
  const today = todayIso();
  const key = cacheKey(model.version, `management/${route}@${today}`, {});
  let data = getCached<T>(key);
  if (data === undefined) {
    data = build(model, today);
    setCached(key, data);
  }
  sendOk(res, data, { modelVersion: model.version, builtAt: model.builtAt });
}

managementReportsRouter.get('/created-objects', (_req, res) => respond(res, 'created-objects', buildCreatedObjectsReport));
managementReportsRouter.get('/flat-consumption', (_req, res) => respond(res, 'flat-consumption', buildFlatConsumptionReport));
managementReportsRouter.get('/zte-movements', (_req, res) => respond(res, 'zte-movements', buildZteMovementsReport));
managementReportsRouter.get('/zte-used', (_req, res) => respond(res, 'zte-used', buildZteUsedReport));
managementReportsRouter.get('/obsolete-equipment', (_req, res) => respond(res, 'obsolete-equipment', buildObsoleteEquipmentReport));
managementReportsRouter.get('/warehouse-productivity', (_req: Request, res) => {
  // a lista é editável: ela entra na chave, e uma alteração vale na hora
  const staff = getProductivityStaffNames();
  respond(res, `warehouse-productivity:${staff.join('|')}`, (model, today) => buildProductivityReport(model, staff, today));
});

/**
 * Quem aparece na "PRODUTIVIDADE ALMOX" — lista editável só por
 * administradores (tela de Administração), com as sugestões de quem enviou
 * romaneio nos dois meses da tela.
 */
export const productivityStaffRouter = Router();

productivityStaffRouter.get('/', requireAuth({ role: 'ADMIN' }), (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  sendOk(res, getProductivityStaff(getModel()));
});

const StaffBodySchema = z.strictObject({
  names: z.array(
    z.string().trim().min(1, 'Nome vazio.').max(120, 'Nome longo demais.'),
    { error: 'Envie a lista de nomes.' },
  ).max(100, 'No máximo 100 pessoas.'),
});

productivityStaffRouter.put('/', writeRateLimit, requireAuth({ role: 'ADMIN' }), (req, res) => {
  const { names } = StaffBodySchema.parse(req.body);
  sendOk(res, setProductivityStaff(names, req.user!, getModel()));
});
