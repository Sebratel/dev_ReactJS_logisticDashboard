import { Router } from 'express';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { toCsv, type CsvColumn } from '../../common/helpers/csv.helper.js';
import { todayIso } from '../../common/helpers/date.helper.js';
import { sendOk } from '../../common/http/api-response.js';
import { exportRateLimit, writeRateLimit } from '../../common/middlewares/security.middleware.js';
import { stockControlKey } from '../../model/builders/stock-control.builder.js';
import { getModel } from '../../model/model.store.js';
import type { StockControlEntity } from './stock-control.entity.js';
import {
  createStockControl, deleteStockControl, listStockControls, STOCK_CONTROL_LIMIT, updateStockControl,
} from './stock-control.service.js';

/**
 * Cadastro de controle de estoque (o que era a planilha "Controle Estoque").
 * Todo mundo logado consulta; criar, editar e excluir exigem EDITOR.
 */
export const stockControlsRouter = Router();

const byCodeAndBase = (a: StockControlEntity, b: StockControlEntity): number => (
  a.code - b.code || a.baseName.localeCompare(b.baseName, 'pt-BR')
);

/** O item com o que o Voalle diz dele na base: descrição, saldo e situação do estoque. */
function withVoalle(items: StockControlEntity[]) {
  const balances = new Map<string, { description: string; units: number; status: string }>();
  for (const row of getModel().stockBalances) {
    const key = stockControlKey(row.productNumber, row.baseName);
    if (!balances.has(key)) balances.set(key, { description: row.description, units: row.units, status: row.status });
  }
  return items.map((item) => ({ ...item, voalle: balances.get(stockControlKey(item.code, item.baseName)) ?? null }));
}

stockControlsRouter.get('/', requireAuth(), (_req, res) => {
  const store = listStockControls();
  const items = [...store.items].sort(byCodeAndBase);
  res.setHeader('Cache-Control', 'no-store');
  sendOk(res, withVoalle(items), { total: items.length, limit: STOCK_CONTROL_LIMIT, updatedAt: store.updatedAt });
});

const EXPORT_COLUMNS: CsvColumn<StockControlEntity>[] = [
  { header: 'CÓDIGO', value: (r) => r.code },
  { header: 'SITUAÇÃO', value: (r) => r.category },
  { header: 'ITEM', value: (r) => r.item },
  { header: 'BASE DE ORIGEM', value: (r) => r.baseName },
  { header: 'ALERTA ESTOQUE', value: (r) => r.alertLevel },
  { header: 'ESTOQUE MÍNIMO', value: (r) => r.minimumLevel },
  { header: 'COMPRADOR RESPONSÁVEL', value: (r) => r.buyer },
  { header: 'LEAD TIME (DIAS)', value: (r) => r.leadTimeDays },
  { header: 'PROCESSO EXTERNO', value: (r) => r.externalProcess },
  { header: 'ATUALIZADO POR', value: (r) => r.updatedBy },
  { header: 'ATUALIZADO EM', value: (r) => r.updatedAt },
];

/** Cópia do cadastro inteiro em CSV — também serve de backup antes de uma alteração em massa. */
stockControlsRouter.get('/export', exportRateLimit, requireAuth(), (_req, res) => {
  const items = [...listStockControls().items].sort(byCodeAndBase);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="controle-estoque_${todayIso()}.csv"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(toCsv(EXPORT_COLUMNS, items));
});

stockControlsRouter.post('/', writeRateLimit, requireAuth({ role: 'EDITOR' }), (req, res) => {
  const created = createStockControl(req.body, req.user!);
  res.setHeader('Location', `${req.baseUrl}/${created.id}`);
  sendOk(res, created, undefined, 201);
});

stockControlsRouter.put('/:id', writeRateLimit, requireAuth({ role: 'EDITOR' }), (req, res) => {
  sendOk(res, updateStockControl(req.params.id, req.body, req.user!));
});

stockControlsRouter.delete('/:id', writeRateLimit, requireAuth({ role: 'EDITOR' }), (req, res) => {
  deleteStockControl(req.params.id, req.user!);
  res.status(204).end();
});
