import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { StringPool } from '../src/common/helpers/string-pool.js';
import {
  buildCreatedObjects, buildFlatConsumption, buildObsoleteFirstDays, buildPackingProductivity, buildZteReturns,
} from '../src/model/builders/management.builder.js';
import type { DataModel, DailyValue } from '../src/model/model.types.js';
import {
  buildCreatedObjectsReport, buildObsoleteEquipmentReport, buildProductivityReport, buildZteMovementsReport, buildZteUsedReport,
  countUntil, sumBetween,
} from '../src/modules/management/management.service.js';
import { comparisonPeriods, historyMonths, percentChange, productivityMonths } from '../src/modules/management/period-comparison.js';

/** Seção Gerencial (Power BI "LOG - Gerencial"): períodos, regras e telas. A lista da produtividade grava num diretório temporário. */
const dataPath = mkdtempSync(join(tmpdir(), 'management-'));
process.env.DATA_PATH = dataPath;

const daily = (pairs: Array<[string, number]>): DailyValue[] => pairs.map(([day, value]) => ({ day, value }));
const keys = (pair: { previous: { key: string }; current: { key: string } }) => [pair.previous.key, pair.current.key];

describe('Gerencial · períodos (colunas DAX do Calendario)', () => {
  it('mês, trimestre e ano: o último FECHADO contra o anterior e contra o do ano passado', () => {
    const p = comparisonPeriods('2026-11-05');
    assert.deepEqual(keys(p.months), ['2026-09', '2026-10']);
    assert.deepEqual(keys(p.monthsYearAgo), ['2025-10', '2026-10']);
    assert.deepEqual(keys(p.quarters), ['2026-T2', '2026-T3']);
    assert.deepEqual(keys(p.quartersYearAgo), ['2025-T3', '2026-T3']);
    assert.deepEqual(keys(p.years), ['2025', '2026']);
    assert.deepEqual([p.quarters.current.from, p.quarters.current.to], ['2026-07-01', '2026-09-30']);
  });

  it('virada de ano: em janeiro o mês fechado é dezembro e o trimestre é o 4º do ano anterior', () => {
    const p = comparisonPeriods('2027-01-10');
    assert.deepEqual(keys(p.months), ['2026-11', '2026-12']);
    assert.deepEqual(keys(p.quarters), ['2026-T3', '2026-T4']);
    assert.deepEqual(keys(p.quartersYearAgo), ['2025-T4', '2026-T4']);
    // no 2º trimestre, o anterior ao 1º é o 4º do ano passado
    assert.deepEqual(keys(comparisonPeriods('2026-05-02').quarters), ['2025-T4', '2026-T1']);
    assert.equal(comparisonPeriods('2028-03-01').months.previous.to, '2028-01-31');
  });

  it('histórico mês a mês, cortado no início e em hoje; produtividade nos dois meses fechados', () => {
    const h = historyMonths('2024-08-02', '2024-10-15');
    assert.deepEqual(h.map((m) => [m.key, m.from, m.to]), [
      ['2024-08', '2024-08-02', '2024-08-31'], ['2024-09', '2024-09-01', '2024-09-30'], ['2024-10', '2024-10-01', '2024-10-15'],
    ]);
    const { months, from, to } = productivityMonths('2026-01-20');
    assert.deepEqual([months[0].key, months[1].key, from, to], ['2025-11', '2025-12', '2025-11-01', '2026-01-01']);
  });

  it('variação: atual ÷ anterior − 1; sem anterior não há variação', () => {
    assert.equal(percentChange(150, 100), 0.5);
    assert.equal(percentChange(5, 0), null);
  });
});

describe('Gerencial · regras das consultas', () => {
  it('flat: só o que o almoxarifado entregou, sem almoxarifado, sucata e RMA como recebedor', () => {
    const rows = buildFlatConsumption([
      { day: '2026-10-01', receiver: 'TECNICO A', supplier: 'GERMANO DE PAULA', units: 100 },
      { day: '2026-10-01', receiver: null, supplier: 'GERMANO DE PAULA', units: 5 },
      { day: '2026-10-01', receiver: 'RMA', supplier: 'GERMANO DE PAULA', units: 50 },
      { day: '2026-10-01', receiver: 'A.ALMOXARIFADO / CANOAS', supplier: 'GERMANO DE PAULA', units: 70 },
      { day: '2026-10-02', receiver: 'TECNICO A', supplier: 'OUTRA PESSOA', units: 30 },
      { day: '2026-10-02', receiver: 'TECNICO B', supplier: null, units: 30 },
    ]);
    assert.deepEqual(rows, [{ day: '2026-10-01', value: 105 }]);
  });

  it('obsoletos: primeira data de cada serial, sem as sem data; acumulado por busca binária', () => {
    const days = buildObsoleteFirstDays([
      { serial_number: 'B', first_day: '2025-03-10' }, { serial_number: 'A', first_day: '2024-01-05' },
      { serial_number: null, first_day: '2025-03-10' }, { serial_number: 'C', first_day: null },
    ]);
    assert.deepEqual(days, ['2024-01-05', '2025-03-10', '2025-03-10']);
    assert.equal(countUntil(days, '2025-03-09'), 1);
    assert.equal(countUntil(days, '2025-03-10'), 3);
    assert.equal(sumBetween(daily([['2026-01-01', 1], ['2026-01-05', 2], ['2026-02-01', 4]]), '2026-01-02', '2026-01-31'), 2);
  });

  it('objetos criados: só desde 2022, mesmo que a fonte traga dia anterior', () => {
    assert.deepEqual(buildCreatedObjects([
      { day: '2021-12-31', objects: 9 }, { day: '2022-01-03', objects: 60 }, { day: '2022-01-03T00:00:00', objects: 1 },
    ]), [{ day: '2022-01-03', value: 61 }]);
  });

  it('produtividade: quem lançou sem nome de usuário não entra', () => {
    const rows = buildPackingProductivity([
      { name: 'ANA', month: '2026-10', description: 'R1', patrimonies: 3 },
      { name: null, month: '2026-10', description: 'R2', patrimonies: 9 },
    ], new StringPool());
    assert.deepEqual(rows.map((r) => r.name), ['ANA']);
  });
});

describe('Gerencial · telas', () => {
  const TODAY = '2026-11-05';
  const zteRows = buildZteReturns([
    { day: '2026-09-10', model: 'ONU GPON WIFI 6 ZTE F6600P AX3000 4 ANTENAS V9.0', origin: 'CANCELAMENTO', returns: 6 },
    { day: '2026-10-03', model: 'ONU GPON WIFI 6 ZTE F6600P AX3000 4 ANTENAS V9.0', origin: 'MANUTENÇÃO', returns: 8 },
    { day: '2026-10-04', model: 'ONU GPON WIFI 6 ZTE F6600P AX3000 4 ANTENAS V9.0', origin: 'CONSERTO INTERNO (fora do escopo)', returns: 2 },
    // fora da lista do USADOS CLASSIFICADO: conta nas movimentações, não nos usados
    { day: '2026-10-05', model: 'ONU GPON WIFI ZTE F670L AC1200 2 ANTENAS V9.0 - RE3023', origin: 'MANUTENÇÃO', returns: 5 },
    { day: '2025-06-01', model: 'ONU GPON WIFI 6 ZTE F6600P AX3000 4 ANTENAS V9.0', origin: 'CANCELAMENTO', returns: 10 },
  ], new StringPool());
  const MODEL = {
    createdObjects: daily([['2025-10-15', 40], ['2026-09-01', 50], ['2026-10-01', 60], ['2026-10-31', 15], ['2026-11-02', 7]]),
    zteDispatches: daily([['2026-09-02', 14], ['2026-10-02', 5]]),
    zteReturns: zteRows,
    obsoleteFirstDays: ['2024-05-01', '2025-12-20', '2026-09-30', '2026-10-01', '2026-11-03'],
    packingProductivity: [
      { name: 'ANA', month: '2026-09', description: 'R1', patrimonies: 4 },
      { name: 'ANA', month: '2026-10', description: 'R2', patrimonies: 6 },
      { name: 'ANA', month: '2026-10', description: 'R3', patrimonies: 2 },
      { name: 'BIA', month: '2026-10', description: 'R3', patrimonies: 1 },
      { name: 'CAIO', month: '2026-10', description: 'R9', patrimonies: 99 },
      { name: 'ANA', month: '2026-08', description: 'R0', patrimonies: 50 },
    ],
  } as unknown as DataModel;

  it('objetos criados: valor de cada período, variação e histórico mensal desde ago/2024', () => {
    const r = buildCreatedObjectsReport(MODEL, TODAY);
    assert.deepEqual([r.comparisons.months.previous.total, r.comparisons.months.current.total], [50, 75]);
    assert.equal(r.comparisons.months.change, 0.5);
    assert.deepEqual([r.comparisons.monthsYearAgo.previous.total, r.comparisons.monthsYearAgo.current.total], [40, 75]);
    assert.deepEqual([r.comparisons.years.previous.total, r.comparisons.years.current.total], [40, 132]);
    assert.equal(r.history[0]?.key, '2024-08');
    assert.equal(r.history.at(-1)?.key, '2026-11');
    assert.equal(r.history.at(-1)?.total, 7);
    assert.equal(r.comparisons.months.shares, undefined, 'série única não tem participação');
  });

  it('movimentações ZTE: novos x usados, participação de cada um e a diferença em pontos', () => {
    const r = buildZteMovementsReport(MODEL, TODAY);
    const m = r.comparisons.months;
    assert.deepEqual(m.previous.values, { used: 6, new: 14 });
    assert.deepEqual(m.current.values, { used: 15, new: 5 }, 'o RE3023 entra nas movimentações');
    assert.equal(m.change, 0);
    assert.deepEqual(m.shares?.previous, { used: 0.3, new: 0.7 });
    assert.ok(Math.abs((m.shares?.change.used ?? 0) - 0.45) < 1e-9);
  });

  it('ZTE usados: por origem, sem o RE3023; o conserto interno sai do gráfico do ano mas não do cartão', () => {
    const r = buildZteUsedReport(MODEL, TODAY);
    assert.deepEqual(r.series.map((s) => s.key), ['CANCELAMENTO', 'MANUTENÇÃO', 'CONSERTO INTERNO (fora do escopo)']);
    assert.deepEqual(r.comparisons.months.current.values, { CANCELAMENTO: 0, MANUTENÇÃO: 8, 'CONSERTO INTERNO (fora do escopo)': 2 });
    assert.equal(r.comparisons.years.current.total, 14, 'gráfico do ano: 6 + 8, sem o conserto');
    assert.equal(r.comparisons.years.change, (16 / 10) - 1, 'cartão do ano: com o conserto (16 contra 10)');
    assert.equal(r.history.at(-2)?.total, 8, 'histórico de outubro sem o conserto');
  });

  it('obsoletos: seriais acumulados até o fim de cada período; histórico dos últimos dois anos', () => {
    const r = buildObsoleteEquipmentReport(MODEL, TODAY);
    assert.deepEqual([r.comparisons.months.previous.total, r.comparisons.months.current.total], [3, 4]);
    assert.deepEqual([r.comparisons.years.previous.total, r.comparisons.years.current.total], [2, 5]);
    assert.equal(r.history[0]?.key, '2024-12', 'o mês que começa depois de hoje + 1 dia − 2 anos');
    assert.equal(r.history.at(-1)?.total, 5);
  });

  it('produtividade: só a lista; romaneio distinto (no total, entre as pessoas); médias como no Power BI', () => {
    const r = buildProductivityReport(MODEL, ['ANA', 'BIA', 'DANI'], TODAY);
    assert.deepEqual(r.months.map((m) => m.key), ['2026-09', '2026-10']);
    const ana = r.people.find((p) => p.name === 'ANA')!;
    assert.deepEqual(ana.months, [{ packings: 1, patrimonies: 4 }, { packings: 2, patrimonies: 8 }]);
    assert.equal(ana.patrimoniesChange, 1);
    assert.equal(ana.averagePackings, 1.5);
    assert.deepEqual(r.people.find((p) => p.name === 'DANI')?.months, [{ packings: 0, patrimonies: 0 }, { packings: 0, patrimonies: 0 }]);
    assert.ok(!r.people.some((p) => p.name === 'CAIO'), 'fora da lista');
    assert.deepEqual(r.total.months, [{ packings: 1, patrimonies: 4 }, { packings: 2, patrimonies: 9 }], 'R3 de ANA e BIA conta uma vez');
    // set: só ANA (4); out: ANA 8 e BIA 1 → média 4,5; média dos dois meses = (4 + 4,5) / 2
    assert.equal(r.total.averagePatrimoniesPerPerson, 4.25);
  });
});

describe('Gerencial · lista da produtividade (Administração)', () => {
  type Staff = typeof import('../src/modules/management/productivity-staff.service.js');
  type Audit = typeof import('../src/modules/audit/audit.service.js');
  let staff: Staff;
  let audit: Audit;
  before(async () => {
    staff = await import('../src/modules/management/productivity-staff.service.js');
    audit = await import('../src/modules/audit/audit.service.js');
  });
  after(() => rmSync(dataPath, { recursive: true, force: true }));

  const model = {
    packingProductivity: [
      { name: 'NOVA PESSOA', month: '2026-10', description: 'R1', patrimonies: 30 },
      { name: 'GERMANO DE PAULA', month: '2026-10', description: 'R2', patrimonies: 5 },
    ],
  } as unknown as DataModel;

  it('sem alteração vale a lista do Power BI; as sugestões vêm de quem enviou romaneio', () => {
    const view = staff.getProductivityStaff(model);
    assert.equal(view.names.length, 10);
    assert.equal(view.updatedAt, null);
    assert.deepEqual(view.candidates, [{ name: 'NOVA PESSOA', patrimonies: 30 }, { name: 'GERMANO DE PAULA', patrimonies: 5 }]);
  });

  it('trocar a lista grava, tira repetição e espaço, e registra quem entrou e quem saiu', () => {
    const admin = { email: 'dono@exemplo.com.br', name: 'Dono' };
    const view = staff.setProductivityStaff([' NOVA PESSOA ', 'GERMANO DE PAULA', 'NOVA PESSOA'], admin, model);
    assert.deepEqual(view.names, ['GERMANO DE PAULA', 'NOVA PESSOA']);
    assert.equal(view.updatedBy, 'dono@exemplo.com.br');
    assert.deepEqual(staff.getProductivityStaffNames(), ['GERMANO DE PAULA', 'NOVA PESSOA']);
    const [last] = audit.listAudit(1);
    assert.equal(last?.action, 'productivity-staff.update');
    assert.ok(last?.changes.some((c) => c.to === 'NOVA PESSOA'));
    assert.equal(last?.changes.filter((c) => c.to === null).length, 9, 'as outras nove pessoas saíram');
  });
});
