import type { StringPool } from '../../common/helpers/string-pool.js';
import { cleanText, toNumber } from '../../common/helpers/text.helper.js';
import type { LabBacklogItem, LabEvent } from '../model.types.js';
import type { LabBacklogSourceRow, LabEventSourceRow } from '../../sources/source.types.js';

/**
 * Tabelas da tela do laboratório (Power BI "LAB - Produtividade
 * Laboratório"). As consultas são as do relatório, sem filtro a mais: aqui só
 * trocam os nomes das colunas, limpam texto e cortam a fração de segundo da
 * data. Em ordem: o mais recente primeiro, como a consulta.
 */
const dateTime = (value: unknown): string | null => (value ? String(value).slice(0, 19) : null);
const numberOrNull = (value: unknown): number | null => (value === null || value === undefined || value === '' ? null : toNumber(value));

export function buildLabEvents(rows: LabEventSourceRow[], pool: StringPool): LabEvent[] {
  const out: LabEvent[] = [];
  for (const row of rows) {
    const occurredAt = dateTime(row.data_movimento);
    if (!occurredAt) continue;
    out.push({
      occurredAt,
      day: row.data ? String(row.data).slice(0, 10) : occurredAt.slice(0, 10),
      eventType: pool.intern(row.tipo_evento) ?? '',
      entryReason: pool.intern(row.motivo_entrada),
      entryLab: pool.intern(row.laboratorio_entrada),
      baseLab: pool.intern(row.base_lab),
      warehouse: pool.intern(row.almoxarifado),
      discardReason: row.motivo ? String(row.motivo) : null,
      patrimonyId: Number(row.patrimonio_id),
      patrimonyTag: cleanText(row.patrimonio),
      serialNumber: cleanText(row.serial),
      productTitle: pool.intern(row.produto_titulo),
      cycle: toNumber(row.ciclo),
      cycleEntryAt: dateTime(row.data_entrada_ciclo),
      labDays: numberOrNull(row.dias_no_laboratorio),
      packingNumber: cleanText(row.nota_romaneio),
    });
  }
  return out.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function buildLabBacklog(rows: LabBacklogSourceRow[], pool: StringPool): LabBacklogItem[] {
  return rows.map((row) => ({
    patrimonyId: Number(row.patrimony_id),
    currentLab: pool.intern(row.laboratorio_atual),
    entryAt: dateTime(row.data_entrada_lab),
    openDays: numberOrNull(row.dias_em_aberto),
    over90: pool.intern(row.status_backlog_90),
  })).sort((a, b) => (b.entryAt ?? '').localeCompare(a.entryAt ?? ''));
}
