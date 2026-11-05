import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { sendOk } from '../../common/http/api-response.js';
import { writeRateLimit } from '../../common/middlewares/security.middleware.js';
import { USER_ROLES } from './user.entity.js';
import { listUsers, ONLINE_WINDOW_MS, setUserManagementAccess, setUserRole } from './user.service.js';

/** Usuários e permissões — só administradores (tela de Administração). */
export const usersRouter = Router();

usersRouter.get('/', requireAuth({ role: 'ADMIN' }), (_req, res) => {
  const users = listUsers();
  res.setHeader('Cache-Control', 'no-store');
  sendOk(res, users, { total: users.length, online: users.filter((u) => u.online).length, onlineWindowMs: ONLINE_WINDOW_MS });
});

const EmailParamSchema = z.email('E-mail inválido.').max(254);
/** Uma alteração por vez: a permissão OU o acesso à seção Gerencial. */
const UserPatchSchema = z.union([
  z.strictObject({ role: z.enum(USER_ROLES, { error: 'Escolha Padrão, Edição ou Admin.' }) }),
  z.strictObject({ managementAccess: z.boolean({ error: 'Informe se a pessoa vê a seção Gerencial.' }) }),
], { error: 'Envie a permissão (role) ou o acesso ao Gerencial (managementAccess).' });

usersRouter.patch('/:email', writeRateLimit, requireAuth({ role: 'ADMIN' }), (req, res) => {
  const email = EmailParamSchema.parse(req.params.email);
  const patch = UserPatchSchema.parse(req.body);
  sendOk(res, 'role' in patch
    ? setUserRole(email, patch.role, req.user!)
    : setUserManagementAccess(email, patch.managementAccess, req.user!));
});
