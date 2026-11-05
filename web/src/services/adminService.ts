import { getData, httpClient, toApiError } from './httpClient';
import type { AdminUser, AdminUserList, AuditEvent, ProductivityStaff, UserRole } from './types';

/** Tela de Administração (só administradores): usuários, permissões e log de edições. */
export const adminKeys = {
  users: ['admin', 'users'] as const,
  audit: ['admin', 'audit-events'] as const,
  productivityStaff: ['admin', 'productivity-staff'] as const,
};

interface UsersEnvelope {
  data: AdminUser[];
  meta: { total: number; online: number };
}

export async function fetchUsers(signal?: AbortSignal): Promise<AdminUserList> {
  try {
    const { data } = await httpClient.get<UsersEnvelope>('/users', { signal });
    return { users: data.data, total: data.meta.total, online: data.meta.online };
  } catch (err) {
    throw toApiError(err);
  }
}

export async function updateUserRole(email: string, role: UserRole): Promise<AdminUser> {
  try {
    const { data } = await httpClient.patch<{ data: AdminUser }>(`/users/${encodeURIComponent(email)}`, { role });
    return data.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/** Libera ou tira a seção Gerencial (não vale para admin, que sempre vê). */
export async function updateUserManagementAccess(email: string, managementAccess: boolean): Promise<AdminUser> {
  try {
    const { data } = await httpClient.patch<{ data: AdminUser }>(`/users/${encodeURIComponent(email)}`, { managementAccess });
    return data.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/** Quem aparece na "Produtividade almox" (seção Gerencial), com as sugestões. */
export const fetchProductivityStaff = (signal?: AbortSignal): Promise<ProductivityStaff> => (
  getData<ProductivityStaff>('/productivity-staff', {}, signal)
);

export async function saveProductivityStaff(names: string[]): Promise<ProductivityStaff> {
  try {
    const { data } = await httpClient.put<{ data: ProductivityStaff }>('/productivity-staff', { names });
    return data.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export const fetchAuditEvents = (limit: number, signal?: AbortSignal): Promise<AuditEvent[]> => (
  getData<AuditEvent[]>('/audit-events', { limit }, signal)
);
