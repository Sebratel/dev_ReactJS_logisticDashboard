import { compareText } from '../../common/helpers/aggregation.helper.js';
import { logger } from '../../common/helpers/logger.helper.js';
import type { DataModel } from '../../model/model.types.js';
import { recordAudit } from '../audit/audit.service.js';
import { readProductivityStaff, writeProductivityStaff, type ProductivityStaffEntity } from './productivity-staff.repository.js';

export interface StaffCandidate {
  name: string;
  /** patrimônios que a pessoa enviou em romaneio nos dois meses da tela */
  patrimonies: number;
}

export interface ProductivityStaffView extends ProductivityStaffEntity {
  /** quem enviou romaneio nos dois meses da tela, do maior para o menor — as sugestões da Administração */
  candidates: StaffCandidate[];
}

export const getProductivityStaffNames = (): string[] => readProductivityStaff().names;

export function getProductivityStaff(model: DataModel): ProductivityStaffView {
  const totals = new Map<string, number>();
  for (const row of model.packingProductivity) totals.set(row.name, (totals.get(row.name) ?? 0) + row.patrimonies);
  const candidates = [...totals]
    .map(([name, patrimonies]) => ({ name, patrimonies }))
    .sort((a, b) => b.patrimonies - a.patrimonies || compareText(a.name, b.name));
  return { ...readProductivityStaff(), candidates };
}

/** Troca a lista inteira (nomes sem espaço sobrando, sem repetição, em ordem alfabética) e registra no log. */
export function setProductivityStaff(names: readonly string[], actor: { email: string; name: string }, model: DataModel): ProductivityStaffView {
  const next = [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort(compareText);
  const current = readProductivityStaff();
  const added = next.filter((n) => !current.names.includes(n));
  const removed = current.names.filter((n) => !next.includes(n));
  if (added.length || removed.length) {
    writeProductivityStaff({ names: next, updatedAt: new Date().toISOString(), updatedBy: actor.email });
    recordAudit(actor, 'productivity-staff.update', null, [
      ...added.map((n) => ({ field: 'Pessoa', from: null, to: n })),
      ...removed.map((n) => ({ field: 'Pessoa', from: n, to: null })),
    ]);
    logger.info('management', `produtividade almox: +${added.length} -${removed.length} por ${actor.email}`);
  }
  return getProductivityStaff(model);
}
