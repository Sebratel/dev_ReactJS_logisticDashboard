import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { StringPool } from '../src/common/helpers/string-pool.js';
import { buildLabBacklog, buildLabEvents } from '../src/model/builders/lab.builder.js';
import type { DataModel } from '../src/model/model.types.js';
import { buildLabMovementsReport } from '../src/modules/reports/lab-movements.service.js';
import type { FilterSelection } from '../src/modules/reports/report-filter.js';
import type { LabEventSourceRow } from '../src/sources/source.types.js';

/** Laboratório · entrada/saída (Power BI "LAB - Produtividade Laboratório"); as colunas são as da consulta original. */
const ev = (id: number, at: string, type: string, extra: Partial<LabEventSourceRow> = {}): LabEventSourceRow => ({
  data_movimento: at, data: at.slice(0, 10), tipo_evento: type, motivo_entrada: 'Cancelamento', laboratorio_entrada: 'Lab Cancelamento CAN',
  base_lab: 'CAN', almoxarifado: null, motivo: null, patrimonio_id: id, patrimonio: String(1000 + id), serial: `S${id}`,
  produto_codigo: '05601', produto_titulo: 'ONU X', base_descricao: 'BASE OPERACIONAL - CANOAS', ciclo: 1, data_entrada_ciclo: '2026-10-01 08:00:00',
  dias_no_laboratorio: null, nota_romaneio: '1', fornecedor: 'ALMOX', ...extra,
});

const pool = new StringPool();
const MODEL = {
  labEvents: buildLabEvents([
    ev(1, '2026-10-01 08:00:00.123', 'ENTRADA'),
    ev(1, '2026-10-05 09:00:00', 'SAIDA', { almoxarifado: 'Almox CAN', dias_no_laboratorio: '4.0' }),
    ev(1, '2026-10-20 10:00:00', 'ENTRADA', { ciclo: 2, motivo_entrada: 'Manutenção', laboratorio_entrada: 'Lab Manutenção CAN' }),
    ev(2, '2026-10-05 11:00:00', 'ENTRADA', { produto_titulo: 'ROTEADOR Y', base_lab: 'SLE' }),
    ev(3, '2026-10-06 11:00:00', 'DESCARTE INTERNO', { patrimonio: null, motivo: 'queimado', dias_no_laboratorio: 9 }),
  ], pool),
  labBacklog: buildLabBacklog([
    { patrimony_id: 1, laboratorio_atual: 'MANUTENÇÃO / LABORATÓRIO / CANOAS', data_entrada_lab: '2026-10-20 10:00:00', dias_em_aberto: '17.0', status_backlog_90: 'Até 90 dias' },
    { patrimony_id: 2, laboratorio_atual: 'CANCELAMENTO / LABORATÓRIO / SLE', data_entrada_lab: '2026-07-05 11:00:00', dias_em_aberto: 124.3, status_backlog_90: 'Acima de 90 dias' },
    { patrimony_id: 99, laboratorio_atual: 'CANCELAMENTO / LABORATÓRIO / SLE', data_entrada_lab: '2025-01-01 11:00:00', dias_em_aberto: 674, status_backlog_90: 'Acima de 90 dias' },
  ], pool),
} as unknown as DataModel;

const sel = (lists: Record<string, string[]> = {}, extra: Partial<FilterSelection> = {}): FilterSelection => ({ lists, searches: {}, ...extra });

describe('Laboratório · entrada/saída', () => {
  it('lê as colunas da consulta original sem cortar nada; do mais recente para o mais antigo, data/hora sem fração', () => {
    const old = buildLabEvents([ev(4, '2025-12-31 23:00:00', 'ENTRADA')], pool);
    assert.equal(old.length, 1, 'sem piso de data no app: o que a consulta trouxer, a tela mostra');
    assert.deepEqual(MODEL.labEvents.map((e) => e.occurredAt).slice(-1), ['2026-10-01 08:00:00']);
    assert.equal(MODEL.labEvents[0]?.occurredAt, '2026-10-20 10:00:00');
    const saida = MODEL.labEvents.find((e) => e.eventType === 'SAIDA')!;
    assert.equal(saida.labDays, 4);
    assert.equal(saida.warehouse, 'Almox CAN');
    assert.equal(MODEL.labEvents.find((e) => e.eventType === 'DESCARTE INTERNO')?.discardReason, 'queimado');
  });

  it('cartão conta eventos; gráfico conta patrimônios (o sem número sai) por dia e tipo', () => {
    const r = buildLabMovementsReport(MODEL, sel());
    assert.equal(r.kpis.events, 5);
    assert.deepEqual(r.series.map((s) => s.key), ['ENTRADA', 'SAIDA', 'DESCARTE INTERNO']);
    assert.deepEqual(r.byDay.find((d) => d.key === '2026-10-05')?.values, { SAIDA: 1, ENTRADA: 1 });
    assert.equal(r.byDay.find((d) => d.key === '2026-10-06'), undefined, 'descarte sem número de patrimônio não conta no gráfico');
  });

  it('matriz item x evento · motivo; por item conta patrimônios distintos; listas inteiras, sem limite', () => {
    const r = buildLabMovementsReport(MODEL, sel());
    assert.deepEqual(r.matrix.columns.map((c) => c.label), [
      'ENTRADA · Cancelamento', 'ENTRADA · Manutenção', 'SAIDA · Cancelamento', 'DESCARTE INTERNO · Cancelamento',
    ]);
    const onu = r.matrix.rows.find((x) => x.key === 'ONU X')!;
    assert.equal(onu.total, 4);
    assert.deepEqual(r.byItem.rows, [{ key: 'ONU X', value: 2 }, { key: 'ROTEADOR Y', value: 1 }]);
    assert.deepEqual(r.patrimonies.map((p) => [p.patrimonyTag, p.cycle]), [['1001', 1], ['1001', 2], ['1002', 1], [null, 1]]);
    assert.equal(r.detail.length, 5);
    assert.equal(r.detail[0], MODEL.labEvents[0], 'a tabela de eventos leva os próprios eventos do modelo (sem cópia)');
  });

  it('backlog: só os patrimônios que sobram nos eventos filtrados, com os dias e o status da consulta', () => {
    const all = buildLabMovementsReport(MODEL, sel());
    assert.deepEqual(all.backlog.rows.map((b) => [b.patrimonyTag, b.item, b.openDays, b.over90]), [
      ['1001', 'ONU X', 17, 'Até 90 dias'],
      ['1002', 'ROTEADOR Y', 124.3, 'Acima de 90 dias'],
    ]);
    assert.equal(all.backlog.over90, 1);
    assert.deepEqual(all.backlog.byItem, [{ key: 'ONU X', value: 1 }, { key: 'ROTEADOR Y', value: 1 }]);
    const sle = buildLabMovementsReport(MODEL, sel({ base: ['SLE'] }));
    assert.deepEqual(sle.backlog.rows.map((b) => b.patrimonyTag), ['1002']);
    const period = buildLabMovementsReport(MODEL, sel({}, { startDate: '2026-10-06', endDate: '2026-10-31' }));
    assert.deepEqual(period.backlog.rows.map((b) => b.patrimonyTag), ['1001'], 'o filtro de data chega ao backlog pelos eventos');
  });

  it('clique no gráfico: o dia (ou mês) filtra a tela, mas o gráfico continua com todos os períodos', () => {
    const day = buildLabMovementsReport(MODEL, sel({ day: ['2026-10-05'] }));
    assert.equal(day.kpis.events, 2);
    assert.deepEqual(day.detail.map((e) => e.day), ['2026-10-05', '2026-10-05']);
    assert.deepEqual(day.byDay.map((d) => d.key), ['2026-10-01', '2026-10-05', '2026-10-20'], 'o gráfico não se recorta pelo próprio clique');
    assert.deepEqual(day.backlog.rows.map((b) => b.patrimonyTag), ['1001', '1002']);

    const two = buildLabMovementsReport(MODEL, sel({ day: ['2026-10-01', '2026-10-20'] }));
    assert.equal(two.kpis.events, 2, 'Ctrl+clique: mais de um dia');

    const month = buildLabMovementsReport(MODEL, sel({ month: ['2026-10'], event: ['ENTRADA'] }));
    assert.equal(month.kpis.events, 3);
    assert.deepEqual(month.series.map((s) => s.key), ['ENTRADA'], 'os outros filtros continuam valendo no gráfico');
    assert.equal(month.options.day, undefined, 'dia e mês não viram lista de opções');
  });
});
