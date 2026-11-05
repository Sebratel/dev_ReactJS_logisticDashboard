import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminKeys, fetchAuditEvents, fetchProductivityStaff, fetchUsers, saveProductivityStaff, updateUserManagementAccess, updateUserRole,
} from '../services/adminService';
import { reportKeys } from '../services/reportsService';
import type { UserRole } from '../services/types';

/** A tela relê sozinha a cada 20 s: quem está online muda o tempo todo. */
const POLL_MS = 20_000;
const AUDIT_LIMIT = 300;

/** `enabled` = é admin: para quem não é, nem consulta (o servidor recusaria). */
export function useAdminUsers(enabled: boolean) {
  return useQuery({ queryKey: adminKeys.users, queryFn: ({ signal }) => fetchUsers(signal), refetchInterval: POLL_MS, enabled });
}

export function useAuditEvents(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.audit,
    queryFn: ({ signal }) => fetchAuditEvents(AUDIT_LIMIT, signal),
    refetchInterval: POLL_MS,
    enabled,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: UserRole }) => updateUserRole(email, role),
    // a troca entra no log de edições: relê as duas listas
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.users }),
      queryClient.invalidateQueries({ queryKey: adminKeys.audit }),
    ]),
  });
}

export function useUpdateUserManagementAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, managementAccess }: { email: string; managementAccess: boolean }) => updateUserManagementAccess(email, managementAccess),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.users }),
      queryClient.invalidateQueries({ queryKey: adminKeys.audit }),
    ]),
  });
}

export function useProductivityStaff(enabled: boolean) {
  return useQuery({ queryKey: adminKeys.productivityStaff, queryFn: ({ signal }) => fetchProductivityStaff(signal), enabled });
}

export function useSaveProductivityStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (names: string[]) => saveProductivityStaff(names),
    // a tela de produtividade muda na hora
    onSuccess: (data) => {
      queryClient.setQueryData(adminKeys.productivityStaff, data);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.audit }),
        queryClient.invalidateQueries({ queryKey: reportKeys.all('warehouse-productivity') }),
      ]);
    },
  });
}
