import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { AppException } from '../../common/errors/app.exception.js';
import { sendOk } from '../../common/http/api-response.js';
import { cacheKey, getCached, setCached } from '../../common/http/response-cache.js';
import { todayIso } from '../../common/helpers/date.helper.js';
import { exportRateLimit } from '../../common/middlewares/security.middleware.js';
import { ITEM_TYPE } from '../../model/business-rules.js';
import { getModel, getPurchasingModel, getSourceStatuses } from '../../model/model.store.js';
import type { DataModel } from '../../model/model.types.js';
import {
  buildPatrimonyAllocationReport, buildProductAllocationReport, PATRIMONY_ALLOCATION_SPEC, productAllocationSpec,
} from './allocations.service.js';
import {
  buildPatrimonyPackingReport, buildProductPackingReport, patrimonyPackingSpec, productPackingSpec,
} from './packing-lists.service.js';
import {
  buildPackingHistory, buildPatrimonyStatusPanel, buildPendingTable, PATRIMONY_STATUS_SPEC, pendingTotal,
} from './patrimony-status.service.js';
import { LIVE_SOURCE_KEYS } from '../../sources/live-refresh.job.js';
import { buildFieldEquipmentReport, FIELD_EQUIPMENT_SPEC } from './field-equipment.service.js';
import {
  buildChargedPatrimoniesReport, buildChargedProductsReport, chargedPatrimonySpec, chargedProductSpec,
} from './charged-items.service.js';
import { buildPurchaseOrdersReport, PURCHASING_SPEC } from './purchase-orders.service.js';
import { REPORT_EXPORTS } from './report-exports.js';
import { parseSelection, type FilterSpec } from './report-filter.js';
import { buildStockAlerts, stockAlertSpec } from './stock-alerts.service.js';

/**
 * Um endpoint por tela: cada página faz UMA chamada que devolve o painel
 * inteiro (filtros, cartões, gráficos e tabelas). Um clique no filtro custa uma
 * requisição, e não uma por visual.
 */
export const reportsRouter = Router();
reportsRouter.use(requireAuth());

const spec = (s: FilterSpec<never>) => s as FilterSpec<unknown>;

function respond<T>(req: Request, res: Response, route: string, build: (model: DataModel) => T): void {
  const model = getModel();
  const key = cacheKey(model.version, route, req.query as Record<string, unknown>);
  let data = getCached<T>(key);
  if (data === undefined) {
    data = build(model);
    setCached(key, data);
  }
  sendOk(res, data, { modelVersion: model.version, builtAt: model.builtAt });
}

reportsRouter.get('/product-stock-alerts', (req, res) => {
  const selection = parseSelection(req.query, spec(stockAlertSpec(ITEM_TYPE.PRODUCT, true)));
  respond(req, res, 'product-stock-alerts', (model) => buildStockAlerts(model, ITEM_TYPE.PRODUCT, selection));
});

reportsRouter.get('/patrimony-stock-alerts', (req, res) => {
  const stockSelection = parseSelection(req.query, spec(stockAlertSpec(ITEM_TYPE.PATRIMONY, false)));
  const statusSelection = parseSelection(req.query, spec(PATRIMONY_STATUS_SPEC));
  respond(req, res, 'patrimony-stock-alerts', (model) => {
    const stock = buildStockAlerts(model, ITEM_TYPE.PATRIMONY, stockSelection);
    const pending = pendingTotal(model.pendingPatrimonies);
    return {
      ...stock,
      kpis: { ...stock.kpis, pendingUnits: pending, availablePlusPending: stock.kpis.availableUnits + pending },
      statuses: buildPatrimonyStatusPanel(model, statusSelection),
      pending: buildPendingTable(model.pendingPatrimonies),
      packingHistory: buildPackingHistory(model),
    };
  });
});

reportsRouter.get('/patrimony-packing-lists', (req, res) => {
  const selection = parseSelection(req.query, spec(patrimonyPackingSpec(getModel())));
  respond(req, res, `patrimony-packing-lists@${todayIso()}`, (model) => buildPatrimonyPackingReport(model, selection));
});

reportsRouter.get('/patrimony-allocations', (req, res) => {
  const selection = parseSelection(req.query, spec(PATRIMONY_ALLOCATION_SPEC));
  respond(req, res, 'patrimony-allocations', (model) => buildPatrimonyAllocationReport(model, selection));
});

reportsRouter.get('/product-packing-lists', (req, res) => {
  const selection = parseSelection(req.query, spec(productPackingSpec(getModel())));
  // a média de 3 meses depende do dia de hoje: o dia entra na chave do cache
  respond(req, res, `product-packing-lists@${todayIso()}`, (model) => buildProductPackingReport(model, selection));
});

reportsRouter.get('/product-allocations', (req, res) => {
  const selection = parseSelection(req.query, spec(productAllocationSpec(getModel())));
  respond(req, res, 'product-allocations', (model) => buildProductAllocationReport(model, selection));
});

reportsRouter.get('/charged-patrimonies', (req, res) => {
  const selection = parseSelection(req.query, spec(chargedPatrimonySpec(getModel())));
  // "TEMPO (DIAS)" depende do dia de hoje: o dia entra na chave do cache
  const today = todayIso();
  respond(req, res, `charged-patrimonies@${today}`, (model) => buildChargedPatrimoniesReport(model, selection, today));
});

reportsRouter.get('/charged-products', (req, res) => {
  const selection = parseSelection(req.query, spec(chargedProductSpec(getModel())));
  respond(req, res, 'charged-products', (model) => buildChargedProductsReport(model, selection));
});

reportsRouter.get('/field-equipment', (req, res) => {
  const selection = parseSelection(req.query, spec(FIELD_EQUIPMENT_SPEC));
  respond(req, res, 'field-equipment', (model) => buildFieldEquipmentReport(model, selection));
});

/**
 * COMPRAS · LANÇAMENTO E SALDOS. As tabelas desta tela são relidas a cada
 * minuto e têm versão própria: o cache desta rota vira a cada leitura, o das
 * outras telas não.
 */
reportsRouter.get('/purchase-orders', (req, res) => {
  const selection = parseSelection(req.query, PURCHASING_SPEC);
  const live = getPurchasingModel();
  const key = cacheKey(live.version, 'purchase-orders', req.query as Record<string, unknown>);
  let data = getCached<ReturnType<typeof buildPurchaseOrdersReport>>(key);
  if (data === undefined) {
    const readAt = getSourceStatuses()
      .filter((s) => LIVE_SOURCE_KEYS.includes(s.key))
      .map((s) => s.updatedAt)
      .filter((v): v is string => v !== null)
      .sort()[0] ?? null;
    data = buildPurchaseOrdersReport(live, selection, readAt);
    setCached(key, data);
  }
  sendOk(res, data, { modelVersion: live.version, builtAt: live.builtAt });
});

reportsRouter.get('/:report/exports/:table', exportRateLimit, (req, res) => {
  const definition = REPORT_EXPORTS[`${req.params.report}/${req.params.table}`];
  if (!definition) throw new AppException(404, 'EXPORT_NOT_FOUND', 'Exportação não encontrada.');
  const csv = definition.build(getModel(), req.query as Record<string, unknown>);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${definition.fileName}_${todayIso()}.csv"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(csv);
});
