import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { AppException } from '../../common/errors/app.exception.js';
import { sendOk } from '../../common/http/api-response.js';
import { getModel } from '../../model/model.store.js';

/**
 * Consulta de produto pelo código, no saldo do Voalle da última carga. O
 * formulário do cadastro usa para mostrar a descrição oficial e as bases onde
 * o produto tem saldo enquanto a pessoa digita o código.
 */
export const productsRouter = Router();

const ProductCodeSchema = z.coerce
  .number({ error: 'Código inválido.' })
  .int('Código inválido.')
  .min(1, 'Código inválido.')
  .max(99_999_999, 'Código inválido.');

productsRouter.get('/:code', requireAuth(), (req, res) => {
  const code = ProductCodeSchema.parse(req.params.code);
  const rows = getModel().stockBalances.filter((r) => r.productNumber === code);
  const first = rows[0];
  if (!first) throw new AppException(404, 'PRODUCT_NOT_FOUND', `O código ${code} não aparece no saldo do Voalle.`);

  const bases = new Map<string, number>();
  for (const row of rows) if (row.baseName && !bases.has(row.baseName)) bases.set(row.baseName, row.units);
  sendOk(res, {
    code,
    productCode: first.productCode,
    description: first.description,
    itemType: first.itemType,
    bases: [...bases].map(([baseName, units]) => ({ baseName, units })),
  });
});
