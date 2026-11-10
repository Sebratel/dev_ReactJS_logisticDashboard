import type { StringPool } from '../../common/helpers/string-pool.js';
import { cleanText, toNumber } from '../../common/helpers/text.helper.js';
import { FLAT_EXCLUDED_RECEIVERS, FLAT_SUPPLIERS, MANAGEMENT_SINCE } from '../business-rules.js';
import type { DailyValue, PackingProductivityRow, ZteReturnDaily } from '../model.types.js';
import type {
  CreatedObjectsSourceRow, FlatConsumptionSourceRow, ObsoleteEquipmentSourceRow, PackingProductivitySourceRow,
  ZteDispatchSourceRow, ZteReturnSourceRow,
} from '../../sources/source.types.js';

/**
 * Tabelas da seção Gerencial (Power BI "LOG - Gerencial"). As consultas já
 * vêm somadas por dia; aqui só aplicam as regras que o Power BI fazia depois
 * da consulta e ficam em ordem de data.
 */

const dayOf = (value: string | null | undefined): string | null => (value ? String(value).slice(0, 10) : null);

function sumByDay<T>(rows: readonly T[], dayOfRow: (row: T) => string | null, valueOf: (row: T) => number): DailyValue[] {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const day = dayOfRow(row);
    if (!day) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + valueOf(row));
  }
  return [...byDay].map(([day, value]) => ({ day, value })).sort((a, b) => a.day.localeCompare(b.day));
}

/** Desde 2022 (o corte do Power BI). A consulta já corta pela mesma data; aqui é só a garantia. */
export const buildCreatedObjects = (rows: CreatedObjectsSourceRow[]): DailyValue[] => sumByDay(
  rows,
  (r) => {
    const day = dayOf(r.day);
    return day && day >= MANAGEMENT_SINCE.createdObjects ? day : null;
  },
  (r) => toNumber(r.objects),
);

export const buildZteDispatches = (rows: ZteDispatchSourceRow[]): DailyValue[] => (
  sumByDay(rows, (r) => dayOf(r.day), (r) => toNumber(r.dispatches))
);

const FLAT_SUPPLIER_SET: ReadonlySet<string> = new Set(FLAT_SUPPLIERS);
const FLAT_EXCLUDED_SET: ReadonlySet<string> = new Set(FLAT_EXCLUDED_RECEIVERS);

/**
 * "CONSUMO DE FLAT": o filtro do Power Query (quem entregou é do almoxarifado,
 * quem recebeu não é almoxarifado) e o filtro da página (sem ferramentas,
 * sucata e RMA). Recebedor vazio passa, como no Power Query (`null <> "x"`).
 */
export const buildFlatConsumption = (rows: FlatConsumptionSourceRow[]): DailyValue[] => sumByDay(
  rows.filter((r) => r.supplier !== null && FLAT_SUPPLIER_SET.has(r.supplier) && !(r.receiver !== null && FLAT_EXCLUDED_SET.has(r.receiver))),
  (r) => dayOf(r.day),
  (r) => toNumber(r.units),
);

export function buildZteReturns(rows: ZteReturnSourceRow[], pool: StringPool): ZteReturnDaily[] {
  const out: ZteReturnDaily[] = [];
  for (const row of rows) {
    const day = dayOf(row.day);
    if (!day) continue;
    out.push({ day, model: pool.intern(row.model) ?? '', origin: pool.intern(row.origin) ?? '', returns: toNumber(row.returns) });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

/** Primeira data de cada serial, em ordem; serial sem data não entra (no Power BI não casava com o calendário). */
export const buildObsoleteFirstDays = (rows: ObsoleteEquipmentSourceRow[]): string[] => (
  rows.map((r) => dayOf(r.first_day)).filter((d): d is string => d !== null).sort()
);

/** Quem lançou sem nome de usuário não entra (não tem como estar na lista da produtividade). */
export function buildPackingProductivity(rows: PackingProductivitySourceRow[], pool: StringPool): PackingProductivityRow[] {
  const out: PackingProductivityRow[] = [];
  for (const row of rows) {
    const name = pool.intern(cleanText(row.name));
    if (!name) continue;
    out.push({ name, month: String(row.month), description: row.description, patrimonies: toNumber(row.patrimonies) });
  }
  return out;
}
