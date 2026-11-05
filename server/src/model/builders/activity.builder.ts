import { StringPool } from '../../common/helpers/string-pool.js';
import { cleanText, normalizeKey, toNumber, toProductNumber } from '../../common/helpers/text.helper.js';
import {
  CABLE_PRODUCTS, HOLDER_CITY_BASES, OTHER_BASE_GROUP, OTHER_HOLDER_BASE, PATRIMONY_AVAILABLE,
  PATRIMONY_UNAVAILABLE, REGION_BASE_GROUPS,
} from '../business-rules.js';
import type {
  ChargedPatrimony, ChargedProduct, FieldEquipmentDispatch, PatrimonyAllocation, PatrimonyPacking, PatrimonyPackingNote, PatrimonyStatus, PendingPatrimony,
  ProductAllocation, ProductPacking,
} from '../model.types.js';
import type {
  ChargedPatrimonySourceRow, ChargedProductSourceRow, FieldEquipmentSourceRow, PatrimonyAllocationSourceRow, PatrimonyPackingNoteSourceRow, PatrimonyPackingSourceRow,
  PatrimonyStatusSourceRow, PendingPatrimonySourceRow, ProductAllocationSourceRow,
  ProductPackingSourceRow, SeniorCollaboratorSourceRow, UserSourceRow,
} from '../../sources/source.types.js';
import { yesNo } from './purchasing.builder.js';

/**
 * Conversão das consultas "de movimento" para as tabelas do modelo.
 *
 * Todas recebem o mesmo `StringPool`: o nome de um técnico aparece em
 * alocações, romaneios e status, e precisa existir uma vez só na memória.
 */

const CABLE_KEYS = new Set(CABLE_PRODUCTS.map((title) => normalizeKey(title)));
export const isCableProduct = (title: string | null): boolean => (title ? CABLE_KEYS.has(normalizeKey(title)) : false);

const BASE_GROUP_BY_REGION = new Map<string, string>();
for (const [group, regions] of Object.entries(REGION_BASE_GROUPS)) {
  for (const region of regions) BASE_GROUP_BY_REGION.set(normalizeKey(region), group);
}
/** Coluna DAX `BaseGrupo`. */
export const baseGroupOf = (region: string | null): string => BASE_GROUP_BY_REGION.get(normalizeKey(region)) ?? OTHER_BASE_GROUP;

const asText = (value: unknown): string | null => (value === null || value === undefined ? null : cleanText(String(value)));

/**
 * As tabelas saem JÁ na ordem em que as telas mostram o detalhe (a ordem do
 * relatório). Ordenar 700 mil linhas a cada requisição custava ~2 s; ordenar
 * uma vez por carga custa o mesmo uma vez por hora, e o filtro preserva a ordem.
 * Datas ISO comparam como texto simples — sem collator, que é lento.
 */
export const compareDesc = (a: string | null, b: string | null): number => {
  const x = a ?? '';
  const y = b ?? '';
  return x < y ? 1 : x > y ? -1 : 0;
};
const compareAsc = (a: string | null, b: string | null): number => -compareDesc(a, b);

export function buildProductAllocations(
  rows: ProductAllocationSourceRow[],
  pool: StringPool,
): ProductAllocation[] {
  const out = rows.map((row): ProductAllocation => {
    const productNumber = toProductNumber(row.product_code);
    const product = pool.intern(row.product_title);
    return {
      id: row.allocation_id,
      technician: pool.intern(row.technician),
      productCode: pool.intern(row.product_code),
      productNumber,
      product,
      units: toNumber(row.allocated_units),
      unitMeasure: pool.intern(row.unit_measure),
      invoiceNumber: asText(row.invoice_number),
      createdAt: row.created_at,
      issueDate: row.issue_date ? row.issue_date.slice(0, 10) : null,
      protocolNumber: asText(row.protocol_number),
      baseGroup: baseGroupOf(row.region),
      isCable: isCableProduct(product),
    };
  });
  // "RELATÓRIO DE ALOCAÇÃO": mais recente primeiro
  return out.sort((a, b) => compareDesc(a.createdAt, b.createdAt) || b.id - a.id);
}

/** STATUS RETORNO: 1 -> "Retorno", 0 -> "-" (Table.ReplaceValue do Power Query). */
const returnedLabel = (value: number | boolean | null): string => (value === 1 || value === true ? 'Retorno' : '-');

export function buildPatrimonyAllocations(rows: PatrimonyAllocationSourceRow[], pool: StringPool): PatrimonyAllocation[] {
  const out = rows.map((row): PatrimonyAllocation => ({
    protocolNumber: asText(row.protocol_number),
    equipment: pool.intern(row.equipment),
    patrimonyTag: cleanText(row.patrimony_tag),
    serialNumber: cleanText(row.serial_number),
    outAt: row.out_at,
    returned: returnedLabel(row.returned),
    returnedDate: row.returned_date ? row.returned_date.slice(0, 10) : null,
    allocatedBy: pool.intern(row.allocated_by),
    currentHolder: pool.intern(row.current_holder),
    city: pool.intern(row.city),
    site: pool.intern(row.site),
  }));
  // "HISTÓRICO POR PATRIMÔNIO": saída mais recente primeiro
  return out.sort((a, b) => compareDesc(a.outAt, b.outAt));
}

export function buildProductPackings(rows: ProductPackingSourceRow[], pool: StringPool): ProductPacking[] {
  const out = rows.map((row): ProductPacking => {
    const product = pool.intern(row.product_title);
    return {
      movementId: row.movement_id,
      documentNumber: asText(row.document_number),
      units: toNumber(row.units),
      productCode: pool.intern(row.product_code),
      product,
      baseName: pool.intern(row.base_name),
      // DATA era convertida para data (sem hora) no Power Query
      date: row.created_at ? row.created_at.slice(0, 10) : null,
      receiver: pool.intern(row.receiver),
      supplier: pool.intern(row.supplier),
      isCable: isCableProduct(product),
    };
  });
  // "RELATÓRIO DE ROMANEIO": número do romaneio, do maior para o menor
  return out.sort((a, b) => Number(b.documentNumber ?? 0) - Number(a.documentNumber ?? 0) || compareDesc(a.date, b.date));
}

export function buildPatrimonyPackings(rows: PatrimonyPackingSourceRow[], pool: StringPool): PatrimonyPacking[] {
  const out = rows.map((row): PatrimonyPacking => ({
    movedAt: row.moved_at,
    productCode: pool.intern(row.product_code),
    product: pool.intern(row.product_title),
    baseName: pool.intern(row.base_name),
    patrimonyId: row.patrimony_id,
    serialNumber: cleanText(row.serial_number),
    patrimonyTag: cleanText(row.patrimony_tag),
    packingNumber: cleanText(row.packing_number),
    supplier: pool.intern(row.supplier),
    receiver: pool.intern(row.receiver),
  }));
  return out.sort((a, b) => compareDesc(a.movedAt, b.movedAt) || compareAsc(a.patrimonyTag, b.patrimonyTag));
}

/** Coluna DAX `Status`: só "Disponível" é disponível; todo o resto é indisponível. */
export const generalStatusOf = (currentStatus: string): string => (
  currentStatus === PATRIMONY_AVAILABLE ? PATRIMONY_AVAILABLE : PATRIMONY_UNAVAILABLE
);

export function buildPatrimonyStatuses(
  rows: PatrimonyStatusSourceRow[],
  senior: SeniorCollaboratorSourceRow[],
  pool: StringPool,
): PatrimonyStatus[] {
  // merge com Base_Senior pelo nome do responsável (LEFT JOIN do Power Query)
  const seniorByName = new Map<string, SeniorCollaboratorSourceRow>();
  for (const person of senior) {
    if (person.name && !seniorByName.has(person.name)) seniorByName.set(person.name, person);
  }
  const out = rows.map((row): PatrimonyStatus => {
    const person = row.responsible ? seniorByName.get(row.responsible) : undefined;
    const currentStatus = pool.intern(row.current_status) ?? '';
    return {
      patrimonyId: row.patrimony_id,
      productCode: pool.intern(row.product_code),
      product: pool.intern(row.product_title),
      baseName: pool.intern(row.base_name),
      serialNumber: cleanText(row.serial_number),
      patrimonyTag: cleanText(row.patrimony_tag),
      currentStatus,
      generalStatus: generalStatusOf(currentStatus),
      responsible: pool.intern(row.responsible),
      operationalBase: pool.intern(person?.operational_base ?? null),
      team: pool.intern(person?.team ?? null),
      active: yesNo(row.is_active),
      deleted: yesNo(row.is_deleted),
    };
  });
  // tabela de status: STATUS GERAL (A-Z), depois o status específico e o patrimônio
  return out.sort((a, b) => compareAsc(a.generalStatus, b.generalStatus)
    || compareAsc(a.currentStatus, b.currentStatus) || compareAsc(a.patrimonyTag, b.patrimonyTag));
}

export function buildPatrimonyPackingNotes(rows: PatrimonyPackingNoteSourceRow[], pool: StringPool): PatrimonyPackingNote[] {
  const out = rows.map((row): PatrimonyPackingNote => ({
    createdAt: row.created_at,
    responsible: pool.intern(row.responsible),
    receivedBy: pool.intern(row.received_by),
    description: pool.intern(row.description),
    patrimonyTag: cleanText(row.patrimony_tag),
    serialNumber: cleanText(row.serial_number),
  }));
  return out.sort((a, b) => compareDesc(a.createdAt, b.createdAt));
}

/**
 * Saídas de equipamento para campo. A data perde a hora (o Power BI fazia
 * DateTime.Date) e a quebra de linha da ocorrência vira espaço.
 */
export function buildFieldEquipment(rows: FieldEquipmentSourceRow[], pool: StringPool): FieldEquipmentDispatch[] {
  return rows
    .filter((row) => row.created_at)
    .map((row) => ({
      patrimonyId: Number(row.patrimony_id),
      date: row.created_at.slice(0, 10),
      equipment: pool.intern(row.equipment),
      description: pool.intern(row.description === null ? null : row.description.replace(/\s+/g, ' ')),
    }));
}

const CITY_BASE = new Map<string, string>(
  HOLDER_CITY_BASES.flatMap(({ base, cities }) => cities.map((city) => [normalizeKey(city), base] as const)),
);

/** Base pela cidade do responsável (coluna DAX BASE2); cidade fora da lista é OUTROS. */
export const baseOfCity = (city: string | null): string => CITY_BASE.get(normalizeKey(city)) ?? OTHER_HOLDER_BASE;

const dateOnly = (value: string | null): string | null => (value ? value.slice(0, 10) : null);

/** Saldo patrimônio da tela "em carga": um patrimônio por linha, com o responsável. */
export function buildChargedPatrimonies(rows: ChargedPatrimonySourceRow[], pool: StringPool): ChargedPatrimony[] {
  const out: ChargedPatrimony[] = [];
  for (const row of rows) {
    const holder = pool.intern(row.holder);
    if (!holder) continue;
    out.push({
      patrimonyId: Number(row.patrimony_id),
      patrimonyTag: cleanText(row.patrimony_tag),
      serialNumber: cleanText(row.serial_number),
      description: pool.intern(row.description),
      productCode: pool.intern(row.product_code),
      value: row.item_value === null ? null : toNumber(row.item_value),
      holder,
      base: baseOfCity(row.holder_city),
      movedAt: dateOnly(row.moved_at),
      active: yesNo(row.is_active),
      deleted: yesNo(row.is_deleted),
    });
  }
  return out;
}

/**
 * Saldo produto da tela "em carga": agrupado por pessoa, cidade, produto,
 * unidade e preço unitário somando o saldo — o Table.Group do Power Query —
 * com o valor como quantidade x preço. Pessoa sem nome fica de fora.
 */
export function buildChargedProducts(rows: ChargedProductSourceRow[], pool: StringPool): ChargedProduct[] {
  const groups = new Map<string, ChargedProduct>();
  for (const row of rows) {
    const holder = pool.intern(row.holder);
    if (!holder) continue;
    const unitValue = row.unit_value === null ? null : toNumber(row.unit_value);
    const key = JSON.stringify([holder, row.holder_city, row.product_code, row.description, row.unit_measure, unitValue]);
    let group = groups.get(key);
    if (!group) {
      group = {
        holder,
        base: baseOfCity(row.holder_city),
        productCode: pool.intern(row.product_code),
        description: pool.intern(row.description),
        unitMeasure: pool.intern(row.unit_measure),
        unitValue,
        quantity: 0,
        totalValue: 0,
        // do cadastro do produto: iguais em todas as linhas do mesmo código
        active: yesNo(row.is_active),
        deleted: yesNo(row.is_deleted),
      };
      groups.set(key, group);
    }
    group.quantity += toNumber(row.balance);
  }
  for (const g of groups.values()) g.totalValue = g.quantity * (g.unitValue ?? 0);
  return [...groups.values()];
}

export function buildPendingPatrimonies(rows: PendingPatrimonySourceRow[]): PendingPatrimony[] {
  return rows.map((row) => ({
    invoiceNumber: asText(row.invoice_number),
    entryDate: row.entry_date ? row.entry_date.slice(0, 10) : null,
    productCode: cleanText(row.product_code),
    description: cleanText(row.product_title),
    baseName: cleanText(row.base_name),
    totalUnits: toNumber(row.total_units),
    pendingUnits: toNumber(row.pending_units),
  }));
}

/** "Usuários": nome -> situações. Um nome pode ter usuário ativo e inativo ao mesmo tempo. */
export function buildUserActivity(rows: UserSourceRow[]): Map<string, Set<string>> {
  const activity = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.name) continue;
    const set = activity.get(row.name) ?? new Set<string>();
    set.add(row.active ? 'Ativo' : 'Desativado');
    activity.set(row.name, set);
  }
  return activity;
}
