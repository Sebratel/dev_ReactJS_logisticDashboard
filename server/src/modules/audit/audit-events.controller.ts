import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { sendOk } from '../../common/http/api-response.js';
import { listAudit, MAX_AUDIT_EVENTS } from './audit.service.js';

/** Log de edições — só administradores (tela de Administração). */
export const auditEventsRouter = Router();

const LimitSchema = z.coerce.number().int().min(1).max(1000).default(300);

auditEventsRouter.get('/', requireAuth({ role: 'ADMIN' }), (req, res) => {
  const limit = LimitSchema.parse(req.query.limit);
  res.setHeader('Cache-Control', 'no-store');
  sendOk(res, listAudit(limit), { limit, kept: MAX_AUDIT_EVENTS });
});
