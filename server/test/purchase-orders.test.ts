import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ZodError } from 'zod';
import { buildItemBalances, buildPurchaseOrders, purchaseOrderStatus, yesNo } from '../src/model/builders/purchasing.builder.js';
import type { ItemBalance, PurchaseOrderItem } from '../src/model/model.types.js';
import {
  buildPurchaseOrdersReport, distinctOrders, filterPurchasing, groupOrderItems, PURCHASING_SPEC, summarizeOrders,
} from '../src/modules/reports/purchase-orders.service.js';
import { parseSelection, type FilterSelection } from '../src/modules/reports/report-filter.js';
import { fingerprint, LIVE_SOURCE_KEYS } from '../src/sources/live-refresh.job.js';
import type { ItemBalanceSourceRow, PurchaseOrderItemSourceRow } from '../src/sources/source.types.js';

const balance = (productCode: string | null, base: string, units = 1, item = `ITEM ${productCode}`): ItemBalance => ({
  productCode, item, base, units, unitMeasure: 'UN', updatesStock: 'Sim', generatesPatrimony: 'Não',
});

const order = (orderId: number, itemId: number, productCode: string | null, extra: Partial<PurchaseOrderItem> = {}): PurchaseOrderItem => ({
  orderId, itemId, date: '2026-10-01', expectedDate: '2026-10-20', supplier: 'FORNECEDOR A', requestedBy: 'ANA',
  status: 'Recebido', deleted: 'Não', orderTotal: 100, base: 'SEDE - PORTO ALEGRE', productCode,
  description: productCode ? `ITEM ${productCode}` : null, unitMeasure: 'UN', units: 2, unitAmount: 10, itemAmount: 20,
  totalAmount: 25, updatesStock: 'Sim', generatesPatrimony: 'Não', ...extra,
});

const MODEL = {
  version: 1,
  builtAt: '2026-11-04T18:00:00.000Z',
  itemBalances: [
    balance('100', 'CANOAS', 5), balance('100', 'SÃO LEOPOLDO', 3),
    balance('200', 'CANOAS', 0), balance('300', 'SÃO LEOPOLDO', 7),
  ],
  purchaseOrders: [
    order(9, 1, '100', { supplier: 'FORNECEDOR B', orderTotal: 300 }),
    order(9, 2, '200', { supplier: 'FORNECEDOR B', orderTotal: 300 }),
    order(8, 3, '300', { status: 'Cancelado' }),
    order(7, null as unknown as number, null, { itemId: null, status: 'Inclusão', orderTotal: 0 }),
  ],
};

const sel = (lists: Record<string, string[]>): FilterSelection => ({ lists, searches: {} });

describe('Compras · trocas do Power Query', () => {
  it('status numérico vira nome; código fora da lista fica como o número', () => {
    assert.equal(purchaseOrderStatus(1), 'Inclusão');
    assert.equal(purchaseOrderStatus(2), 'Cancelado');
    assert.equal(purchaseOrderStatus(4), 'Aguardando Entrega');
    assert.equal(purchaseOrderStatus(5), 'Recebido');
    assert.equal(purchaseOrderStatus(9), '9');
    assert.equal(purchaseOrderStatus(null), null);
  });

  it('booleanos viram Sim/Não; sem produto fica em branco', () => {
    assert.equal(yesNo(true), 'Sim');
    assert.equal(yesNo(false), 'Não');
    assert.equal(yesNo(null), null);
  });

  it('monta as linhas do pedido com deletado, datas e valores', () => {
    const row: PurchaseOrderItemSourceRow = {
      order_id: 5, order_date: '2026-03-02', expected_date: '2026-03-20 00:00:00', supplier: ' FORN ', requested_by: 'ANA',
      status_code: 4, deleted: true, order_total: 1500.5, base_name: null, item_id: 11, product_code: '123',
      product_title: 'CABO', unit_measure: 'MT', units: 3, unit_amount: 10, item_amount: 30, total_amount: 33.3,
      updates_stock: true, generates_patrimony: false,
    };
    const [built] = buildPurchaseOrders([row]);
    assert.equal(built?.status, 'Aguardando Entrega');
    assert.equal(built?.deleted, 'Deletado');
    assert.equal(built?.supplier, 'FORN');
    assert.equal(built?.expectedDate, '2026-03-20');
    assert.equal(built?.base, null);
    assert.equal(built?.updatesStock, 'Sim');
    assert.equal(built?.generatesPatrimony, 'Não');
    assert.equal(buildPurchaseOrders([{ ...row, deleted: false }])[0]?.deleted, 'Não');
  });

  it('saldo sem quantidade conta como zero', () => {
    const row: ItemBalanceSourceRow = {
      product_code: '1', product_title: 'X', base_name: 'CANOAS', available_units: null,
      unit_measure: null, updates_stock: false, generates_patrimony: true,
    };
    assert.equal(buildItemBalances([row])[0]?.units, 0);
  });
});

describe('Compras · filtro nos dois sentidos (relacionamento por Código)', () => {
  it('sem filtro, cada tabela vem inteira', () => {
    const { balances, orders } = filterPurchasing(MODEL, sel({}));
    assert.equal(balances.length, 4);
    assert.equal(orders.length, 4);
  });

  it('filtro do pedido restringe o saldo aos itens dos pedidos filtrados', () => {
    const { balances, orders } = filterPurchasing(MODEL, sel({ supplier: ['FORNECEDOR B'] }));
    assert.deepEqual(orders.map((r) => r.itemId), [1, 2]);
    assert.deepEqual(balances.map((r) => `${r.productCode}|${r.base}`), ['100|CANOAS', '100|SÃO LEOPOLDO', '200|CANOAS']);
  });

  it('filtro do saldo restringe os pedidos aos códigos do saldo; pedido sem item sai', () => {
    const { balances, orders } = filterPurchasing(MODEL, sel({ base: ['SÃO LEOPOLDO'] }));
    assert.deepEqual(balances.map((r) => r.productCode), ['100', '300']);
    assert.deepEqual(orders.map((r) => r.itemId), [1, 3]);
  });

  it('as opções de um lado já vêm recortadas pelo filtro do outro, e o slicer não filtra a si mesmo', () => {
    const { options } = filterPurchasing(MODEL, sel({ status: ['Cancelado'] }));
    assert.deepEqual(options.productCode, ['300']);
    assert.deepEqual(options.base, ['SÃO LEOPOLDO']);
    assert.deepEqual(options.status, ['Cancelado', 'Inclusão', 'Recebido']);
  });

  it('Nº do pedido é listado do mais novo para o mais antigo', () => {
    const { options } = filterPurchasing(MODEL, sel({}));
    assert.deepEqual(options.orderNumber, ['9', '8', '7']);
  });

  it('a query string aceita só os campos da tela', () => {
    const parsed = parseSelection({ supplier: ['A', 'B'], orderNumber: '9' }, PURCHASING_SPEC);
    assert.deepEqual(parsed.lists, { supplier: ['A', 'B'], orderNumber: ['9'] });
    assert.throws(() => parseSelection({ supplier: 'x'.repeat(301) }, PURCHASING_SPEC), ZodError);
  });
});

describe('Compras · carga ao vivo', () => {
  it('as duas fontes da tela ficam fora da carga horária', () => {
    assert.deepEqual([...LIVE_SOURCE_KEYS].sort(), ['itemBalances', 'purchaseOrders']);
  });

  it('leitura igual não gera versão nova; qualquer mudança gera', () => {
    const rows = [{ order_id: 1, status_code: 4 }, { order_id: 2, status_code: 5 }];
    assert.equal(fingerprint(rows), fingerprint(rows.map((r) => ({ ...r }))));
    assert.notEqual(fingerprint(rows), fingerprint([{ order_id: 1, status_code: 5 }, rows[1]]));
  });
});

describe('Compras · tabelas e totais', () => {
  it('um pedido por linha; a coluna "." conta pedidos distintos (código 2 do Power BI)', () => {
    const summary = summarizeOrders(MODEL.purchaseOrders);
    assert.deepEqual(summary.map((r) => r.orderNumber), [9, 8, 7]);
    assert.equal(distinctOrders(MODEL.purchaseOrders), 3, 'o pedido 9 tem 2 itens e conta uma vez');
  });

  it('item repetido igual no mesmo pedido vira uma linha só (a tabela agrupa pelas colunas)', () => {
    const rows = [
      order(5, 1, '100'), order(5, 2, '100'), order(5, 3, '100', { units: 9 }), order(4, 4, '100'),
    ];
    assert.deepEqual(groupOrderItems(rows).map((r) => [r.orderId, r.itemId]), [[5, 1], [5, 3], [4, 4]]);
  });

  it('linha de total: códigos no saldo, pedidos distintos nas tabelas de pedido; e a hora da leitura', () => {
    const report = buildPurchaseOrdersReport(MODEL, sel({}), '2026-11-04T18:00:00.000Z');
    assert.equal(report.readAt, '2026-11-04T18:00:00.000Z');
    assert.deepEqual(report.balances.totals, { items: 4 });
    assert.deepEqual(report.orders.totals, { orders: 3 });
    assert.deepEqual(report.items.totals, { orders: 3 });
    assert.deepEqual(report.items.rows.map((r) => r.key), ['9|1', '9|2', '8|3', '7|-']);
    assert.deepEqual(report.balances.rows.map((r) => r.productCode), ['100', '100', '200', '300']);
  });
});
