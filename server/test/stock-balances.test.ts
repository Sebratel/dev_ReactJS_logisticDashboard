import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildStockBalances, stockDeficit, stockExcess, stockStatus } from '../src/model/builders/stock-balances.builder.js';
import { buildPatrimonyStatuses } from '../src/model/builders/activity.builder.js';
import { buildStockControlIndex } from '../src/model/builders/stock-control.builder.js';
import type { DataModel } from '../src/model/model.types.js';
import { buildPatrimonyStatusPanel } from '../src/modules/reports/patrimony-status.service.js';
import { buildStockAlerts } from '../src/modules/reports/stock-alerts.service.js';
import { StringPool } from '../src/common/helpers/string-pool.js';
import type { StockControlEntity } from '../src/modules/stock-controls/stock-control.entity.js';
import type { PatrimonyStatusSourceRow, PurchaseRequestSourceRow, StockBalanceSourceRow } from '../src/sources/source.types.js';

const balance = (
  code: string, base: string, units: number, minimum = 0, flags: { active?: boolean; deleted?: boolean } = {},
): StockBalanceSourceRow => ({
  product_code: code, product_id: Number(code), product_title: `ITEM ${code}`, base_name: base,
  available_units: units, minimum_inventory: minimum, item_type: 'PRODUCT',
  is_active: flags.active ?? true, is_deleted: flags.deleted ?? false,
});

const purchase = (code: string, base: string, units: number): PurchaseRequestSourceRow => ({
  request_id: 1, product_code: code, product_title: `ITEM ${code}`, request_date: '2026-10-01',
  requested_by: 'COMPRADOR', expected_date: '2026-11-10 00:00:00', units, observation: '', base_name: base,
});

describe('STATUS2 (coluna DAX)', () => {
  it('compara com mínimo e alerta do cadastro', () => {
    assert.equal(stockStatus(5, 5, 10), 'MÍNIMO');
    assert.equal(stockStatus(8, 5, 10), 'ALERTA');
    assert.equal(stockStatus(11, 5, 10), 'ACIMA');
  });
  it('sem cadastro, BLANK vale zero como no DAX', () => {
    assert.equal(stockStatus(0, null, null), 'MÍNIMO');
    assert.equal(stockStatus(-2, null, null), 'MÍNIMO');
    assert.equal(stockStatus(1, null, null), 'ACIMA');
  });
});

describe('% EXCESSO / % DEFICIT', () => {
  it('usam o estoque mínimo do cadastro do Voalle', () => {
    assert.equal(stockExcess(130, 100), 32.5);
    assert.equal(stockExcess(125, 100), 0);
    assert.equal(stockDeficit(40, 100), 60);
    assert.equal(stockDeficit(100, 100), 0);
  });
});

const controlItem = (code: number, baseName: string, extra: Partial<StockControlEntity> = {}): StockControlEntity => ({
  id: `${code}-${baseName}`, code, category: 'ONU', item: null, baseName, alertLevel: 20, minimumLevel: 10,
  buyer: null, leadTimeDays: null, externalProcess: null, createdAt: '', updatedAt: '', updatedBy: 'teste', ...extra,
});

describe('índice do cadastro de controle de estoque', () => {
  it('junta as situações do mesmo código em bases diferentes', () => {
    const index = buildStockControlIndex([
      controlItem(5601, 'BASE OPERACIONAL - CANOAS', { category: 'ONU' }),
      controlItem(5601, 'SEDE - PORTO ALEGRE', { category: 'CRÍTICO' }),
    ]);
    assert.equal(index.categoryByProduct.get(5601), 'CRÍTICO / ONU');
    assert.equal(index.size, 2);
  });

  it('código+base repetido (arquivo editado à mão) vale o primeiro e é contado', () => {
    const index = buildStockControlIndex([
      controlItem(7, 'SEDE - PORTO ALEGRE', { minimumLevel: 1 }),
      controlItem(7, 'SEDE - PORTO ALEGRE', { minimumLevel: 99 }),
    ]);
    assert.equal(index.duplicatedKeys, 1);
    assert.equal([...index.byProductBase.values()][0]?.minimumLevel, 1);
  });
});

describe('buildStockBalances', () => {
  const control = buildStockControlIndex([
    controlItem(5601, 'BASE OPERACIONAL - CANOAS', { leadTimeDays: 15, buyer: 'COMPRAS' }),
    controlItem(5601, 'BASE OPERACIONAL - SÃO LEOPOLDO'),
  ]);

  it('casa o cadastro por código numérico (05601 = 5601) e base', () => {
    const rows = buildStockBalances([balance('05601', 'BASE OPERACIONAL - CANOAS', 15)], control, []);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.isControlled, true);
    assert.equal(rows[0]?.status, 'ALERTA');
    assert.equal(rows[0]?.baseAcronym, 'CAN');
    assert.equal(rows[0]?.category, 'ONU');
    assert.equal(rows[0]?.leadTimeDays, 15);
    assert.equal(rows[0]?.buyer, 'COMPRAS');
  });

  it('sem cadastro o saldo continua, com status pelo mínimo zero', () => {
    const rows = buildStockBalances([balance('05601', 'BASE OPERACIONAL - CANOAS', 0)], null, []);
    assert.equal(rows[0]?.isControlled, false);
    assert.equal(rows[0]?.category, null);
    assert.equal(rows[0]?.status, 'MÍNIMO');
  });

  it('o merge com pedidos de compra repete a linha por pedido, como no Power Query', () => {
    const rows = buildStockBalances(
      [balance('05601', 'BASE OPERACIONAL - CANOAS', 3)],
      control,
      [purchase('05601', 'BASE OPERACIONAL - CANOAS', 50), purchase('05601', 'BASE OPERACIONAL - CANOAS', 20)],
    );
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((r) => r.purchaseUnits), [50, 20]);
    assert.equal(rows[0]?.purchaseStatus, 'Aguardando Entrega');
    assert.equal(rows[0]?.expectedDate, '2026-11-10');
  });

  it('A RECEBER = excesso do mesmo código nas outras bases, quando cobre o déficit', () => {
    const rows = buildStockBalances([
      balance('05601', 'BASE OPERACIONAL - CANOAS', 20, 50), // déficit 30
      balance('05601', 'BASE OPERACIONAL - SÃO LEOPOLDO', 200, 50), // excesso 50
    ], control, []);
    assert.equal(rows[0]?.transferQty, 50);
    assert.equal(rows[1]?.transferQty, 0);
  });

  it('não transfere quando o excesso não cobre o déficit', () => {
    const rows = buildStockBalances([
      balance('05601', 'BASE OPERACIONAL - CANOAS', 0, 100),
      balance('05601', 'BASE OPERACIONAL - SÃO LEOPOLDO', 130, 100),
    ], control, []);
    assert.equal(rows[0]?.transferQty, 0);
  });

  it('traz ativo? e deletado? do cadastro do produto como Sim/Não', () => {
    const rows = buildStockBalances([
      balance('05601', 'BASE OPERACIONAL - CANOAS', 3),
      balance('05602', 'BASE OPERACIONAL - CANOAS', 3, 0, { active: false, deleted: true }),
    ], control, []);
    assert.deepEqual(rows.map((r) => [r.active, r.deleted]), [['Sim', 'Não'], ['Não', 'Sim']]);
  });
});

describe('alerta de estoque · filtros ativo? e deletado?', () => {
  const stockBalances = buildStockBalances([
    balance('05601', 'BASE OPERACIONAL - CANOAS', 3),
    balance('05602', 'BASE OPERACIONAL - CANOAS', 4, 0, { active: false }),
    balance('05603', 'BASE OPERACIONAL - CANOAS', 5, 0, { active: false, deleted: true }),
  ], null, []);
  const model = { stockBalances, hasStockControl: false } as unknown as DataModel;
  const codes = (selection: Record<string, string[]>) =>
    buildStockAlerts(model, 'PRODUCT', { lists: selection, searches: {} }).table.rows.map((r) => r.productCode);

  it('as opções saem do dado', () => {
    const { options } = buildStockAlerts(model, 'PRODUCT', { lists: {}, searches: {} });
    assert.deepEqual(options.active, ['Não', 'Sim']);
    assert.deepEqual(options.deleted, ['Não', 'Sim']);
  });

  it('filtra por um, pelo outro e pelos dois', () => {
    assert.deepEqual(codes({ active: ['Sim'] }), ['05601']);
    assert.deepEqual(codes({ active: ['Não'] }).sort(), ['05602', '05603']);
    assert.deepEqual(codes({ deleted: ['Não'] }).sort(), ['05601', '05602']);
    assert.deepEqual(codes({ active: ['Não'], deleted: ['Não'] }), ['05602']);
  });
});

describe('alerta de patrimônios · ativo? e deletado? vêm do cadastro de CADA patrimônio', () => {
  const status = (id: number, active: boolean, deleted: boolean, current = 'Disponível'): PatrimonyStatusSourceRow => ({
    product_id: 13, product_code: '00013', product_title: 'BATERIA', patrimony_title: 'BATERIA', responsible: null,
    base_name: 'BASE OPERACIONAL - CANOAS', patrimony_id: id, serial_number: `S${id}`, patrimony_tag: `0${id}`,
    is_active: active, is_deleted: deleted, current_status: current,
  });
  const patrimonyStatuses = buildPatrimonyStatuses([
    status(1, true, false),
    status(2, false, true, 'Descarte'),
    status(3, true, true, 'Vendido'),
  ], [], new StringPool());
  const model = { patrimonyStatuses } as unknown as DataModel;
  const tags = (lists: Record<string, string[]>) =>
    buildPatrimonyStatusPanel(model, { lists, searches: {} }).detail.rows.map((r) => r.patrimonyTag).sort();

  it('o status real filtra por p.active e p.deleted', () => {
    assert.deepEqual(tags({}), ['01', '02', '03']);
    assert.deepEqual(tags({ statusActive: ['Não'] }), ['02']);
    assert.deepEqual(tags({ statusDeleted: ['Sim'] }), ['02', '03']);
    assert.deepEqual(tags({ statusActive: ['Sim'], statusDeleted: ['Não'] }), ['01']);
  });

  it('o saldo de patrimônios (item x base) não tem esses filtros', () => {
    const stockBalances = buildStockBalances([{ ...balance('00013', 'BASE OPERACIONAL - CANOAS', 2), item_type: 'PATRIMONY' }], null, []);
    const report = buildStockAlerts({ stockBalances, hasStockControl: false } as unknown as DataModel, 'PATRIMONY', { lists: {}, searches: {} });
    assert.equal('active' in report.options, false);
    assert.equal('deleted' in report.options, false);
  });
});
