import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { StringPool } from '../src/common/helpers/string-pool.js';
import { buildFieldEquipment } from '../src/model/builders/activity.builder.js';
import { FIELD_EQUIPMENT_MODELS, USED_EQUIPMENT_MATRIX_MODELS } from '../src/model/business-rules.js';
import type { DataModel, FieldEquipmentDispatch } from '../src/model/model.types.js';
import {
  buildFieldEquipmentReport, buildMatrix, FIELD_EQUIPMENT_SPEC, groupDetail,
} from '../src/modules/reports/field-equipment.service.js';
import { parseSelection, type FilterSelection, type FilterSpec } from '../src/modules/reports/report-filter.js';

const F6600 = 'ONU GPON WIFI 6 ZTE F6600P AX3000 4 ANTENAS V9.0';
const H3601 = 'ROTEADOR WIFI 6 ZTE MESH AX3000 H3601PE 5 ANTENAS';
const RE947 = 'ONU GPON WIFI ZTE F670L AC1200 2 ANTENAS V9.0 - RE947';
const ROM1 = 'Enviado em Romaneio Nº 1 Sob Responsabilidade de TECNICO A.';
const ROM2 = 'Enviado em Romaneio Nº 2 Sob Responsabilidade de A.ALMOXARIFADO / CANOAS.';

const d = (patrimonyId: number, date: string, equipment: string, description = ROM1): FieldEquipmentDispatch => ({
  patrimonyId, date, equipment, description,
});

const MODEL = {
  newFieldEquipment: [
    d(1, '2026-03-02', F6600), d(2, '2026-03-02', F6600), d(3, '2026-03-15', RE947),
    d(4, '2025-03-10', F6600), d(5, '2026-04-01', H3601),
  ],
  usedFieldEquipment: [
    d(10, '2026-03-02', F6600, ROM2), d(11, '2026-04-20', H3601, ROM2), d(12, '2025-12-01', RE947, ROM2),
  ],
} as unknown as DataModel;

const sel = (lists: Record<string, string[]> = {}, extra: Partial<FilterSelection> = {}): FilterSelection => ({ lists, searches: {}, ...extra });

describe('Equipamentos para campo · regras', () => {
  it('os 9 modelos acompanhados; os visuais de usados por mês/dia mostram 7', () => {
    assert.equal(FIELD_EQUIPMENT_MODELS.length, 9);
    assert.equal(USED_EQUIPMENT_MATRIX_MODELS.length, 7);
    assert.ok(USED_EQUIPMENT_MATRIX_MODELS.every((m) => (FIELD_EQUIPMENT_MODELS as readonly string[]).includes(m)));
    assert.ok(!USED_EQUIPMENT_MATRIX_MODELS.includes(H3601));
  });

  it('a data perde a hora e a quebra de linha da ocorrência vira espaço', () => {
    const [row] = buildFieldEquipment([{
      patrimony_id: 7, created_at: '2026-03-02 10:03:06.402812', equipment: F6600,
      description: 'Enviado em Romaneio\nNº 9 Sob Responsabilidade de X.',
    }], new StringPool());
    assert.equal(row?.date, '2026-03-02');
    assert.equal(row?.description, 'Enviado em Romaneio Nº 9 Sob Responsabilidade de X.');
  });

  it('ano, mês e equipamento filtram as duas tabelas; o período também', () => {
    const r = buildFieldEquipmentReport(MODEL, sel({ year: ['2026'], month: ['Março'] }));
    assert.deepEqual(r.pie, [{ key: 'Novos', value: 3 }, { key: 'Usados', value: 1 }]);
    const byEquipment = buildFieldEquipmentReport(MODEL, sel({ equipment: [H3601] }));
    assert.deepEqual(byEquipment.pie.map((p) => p.value), [1, 1]);
    const byPeriod = buildFieldEquipmentReport(MODEL, sel({}, { startDate: '2026-04-01', endDate: '2026-04-30' }));
    assert.deepEqual(byPeriod.pie.map((p) => p.value), [1, 1]);
  });

  it('meses nas opções em ordem de calendário, e a query aceita só os campos da tela', () => {
    const r = buildFieldEquipmentReport(MODEL, sel());
    assert.deepEqual(r.options.month, ['Março', 'Abril', 'Dezembro']);
    assert.deepEqual(r.options.year, ['2025', '2026']);
    const parsed = parseSelection({ year: '2026', startDate: '2026-01-01' }, FIELD_EQUIPMENT_SPEC as FilterSpec<unknown>);
    assert.deepEqual(parsed.lists, { year: ['2026'] });
    assert.equal(parsed.startDate, '2026-01-01');
  });
});

describe('Equipamentos para campo · matrizes e tabelas', () => {
  it('matriz conta por nível e por coluna, com total da linha e geral', () => {
    const m = buildMatrix(MODEL.newFieldEquipment, [
      { key: (r) => r.date.slice(0, 4) }, { key: (r) => r.equipment ?? '' },
    ], (r) => String(Number(r.date.slice(5, 7))), (k) => k, (a, b) => Number(a) - Number(b));
    assert.deepEqual(m.columns.map((c) => c.key), ['3', '4']);
    assert.deepEqual(m.totals, { 3: 4, 4: 1 });
    assert.equal(m.total, 5);
    const y2026 = m.rows.find((r) => r.key === '2026');
    assert.equal(y2026?.total, 4);
    assert.deepEqual(y2026?.children?.map((c) => [c.key, c.total]), [[F6600, 2], [RE947, 1], [H3601, 1]]);
  });

  it('por data e por tipo trazem novos, usados e o total (TOTAL = novos + usados)', () => {
    const r = buildFieldEquipmentReport(MODEL, sel({ year: ['2026'] }));
    assert.deepEqual(r.byDate.columns.map((c) => c.key), ['novos', 'usados']);
    assert.deepEqual([r.byDate.totals.novos, r.byDate.totals.usados, r.byDate.total], [4, 2, 6]);
    const march = r.byDate.rows[0]?.children?.find((m) => m.label === 'Março');
    assert.deepEqual([march?.values.novos, march?.values.usados, march?.total], [3, 1, 4]);
    const f6600 = r.byType.rows[0]?.children?.find((c) => c.key === F6600);
    assert.deepEqual([f6600?.values.novos, f6600?.values.usados], [2, 1]);
  });

  it('novos por mês: modelo com mais envios primeiro; usados por mês sem os 2 modelos fora do filtro do visual', () => {
    const r = buildFieldEquipmentReport(MODEL, sel());
    assert.equal(r.newByMonth.rows[0]?.key, F6600);
    assert.ok(!r.usedByMonth.rows.some((n) => n.key === H3601));
    assert.equal(r.usedByMonth.total, 2);
    assert.equal(r.pie[1]?.value, 3, 'a pizza mostra os 9 modelos');
  });

  it('dia a dia: mês em ordem de calendário e colunas pelo dia do mês', () => {
    const r = buildFieldEquipmentReport(MODEL, sel());
    assert.deepEqual(r.newDaily.rows.map((n) => n.label), ['Março', 'Abril']);
    assert.deepEqual(r.newDaily.columns.map((c) => c.key), ['1', '2', '10', '15']);
  });

  it('tabela detalhada agrupa data, modelo e ocorrência com a contagem (coluna "Qtd.")', () => {
    const rows = groupDetail(MODEL.newFieldEquipment);
    assert.deepEqual(rows.find((x) => x.date === '2026-03-02')?.count, 2);
    const r = buildFieldEquipmentReport(MODEL, sel());
    assert.equal(r.newDetail.totals.count, 5);
    assert.deepEqual(r.usedDetail.rows.map((x) => x.date), ['2025-12-01', '2026-03-02', '2026-04-20']);
  });
});
