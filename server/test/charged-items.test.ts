import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { StringPool } from '../src/common/helpers/string-pool.js';
import { baseOfCity, buildChargedPatrimonies, buildChargedProducts } from '../src/model/builders/activity.builder.js';
import type { ChargedPatrimony, ChargedProduct, DataModel } from '../src/model/model.types.js';
import {
  buildChargedPatrimoniesReport, buildChargedProductsReport, daysSince, groupChargedProducts,
} from '../src/modules/reports/charged-items.service.js';
import { applyFilters, parseSelection, type FilterSelection, type FilterSpec } from '../src/modules/reports/report-filter.js';
import type { ChargedProductSourceRow } from '../src/sources/source.types.js';

const pat = (id: number, tag: string | null, holder: string, value: number | null, extra: Partial<ChargedPatrimony> = {}): ChargedPatrimony => ({
  patrimonyId: id, patrimonyTag: tag, serialNumber: `S${id}`, description: 'ONU X', productCode: '00013',
  value, holder, base: 'SÃO LEO/SPS/NHO', movedAt: '2026-10-25', active: 'Sim', deleted: 'Não', ...extra,
});

const prod = (holder: string, description: string, quantity: number, unitValue: number, extra: Partial<ChargedProduct> = {}): ChargedProduct => ({
  holder, base: 'EIO/CANOAS/POA', productCode: description.slice(0, 3), description, unitMeasure: 'UN', unitValue,
  quantity, totalValue: quantity * unitValue, active: 'Sim', deleted: 'Não', ...extra,
});

const MODEL = {
  chargedPatrimonies: [
    pat(1, '100', 'ANA', 500), pat(2, '101', 'ANA', 300), pat(3, '102', 'BIA', 1000, { base: 'OUTROS', description: 'ROTEADOR' }),
    pat(4, null, 'CAIO', 50), pat(5, null, 'CAIO', 50, { active: 'Não', deleted: 'Sim' }),
  ],
  chargedProducts: [
    prod('ANA', 'CONECTOR', 10, 2), prod('ANA', 'CONECTOR', 5, 3), prod('ANA', 'CABO', 100, 1.5),
    prod('BIA', 'CABO', 20, 1.5, { base: 'OUTROS', active: 'Não' }),
  ],
  userActivity: new Map([['ANA', new Set(['Ativo'])], ['BIA', new Set(['Desativado'])]]),
} as unknown as DataModel;

const sel = (lists: Record<string, string[]> = {}): FilterSelection => ({ lists, searches: {} });

describe('Em carga · base pela cidade e montagem das tabelas', () => {
  it('cidade vira a base da coluna DAX BASE2 (sem acento e maiúscula também casam); o resto é OUTROS', () => {
    assert.equal(baseOfCity('São Leopoldo'), 'SÃO LEO/SPS/NHO');
    assert.equal(baseOfCity('SAO LEOPOLDO'), 'SÃO LEO/SPS/NHO');
    assert.equal(baseOfCity('Porto Alegre'), 'EIO/CANOAS/POA');
    assert.equal(baseOfCity('Gravataí'), 'OUTROS');
    assert.equal(baseOfCity(null), 'OUTROS');
  });

  it('patrimônio: data sem hora e responsável obrigatório', () => {
    const rows = buildChargedPatrimonies([
      { patrimony_id: 1, patrimony_tag: '7', serial_number: null, description: 'ONU', product_code: '1', item_value: 10, holder: 'ANA', holder_city: 'Canoas', moved_at: '2026-10-01 09:00:00.12', is_active: true, is_deleted: true },
      { patrimony_id: 2, patrimony_tag: '8', serial_number: null, description: 'ONU', product_code: '1', item_value: 10, holder: ' ', holder_city: null, moved_at: null, is_active: true, is_deleted: false },
    ], new StringPool());
    assert.equal(rows.length, 1);
    assert.deepEqual([rows[0]?.movedAt, rows[0]?.base, rows[0]?.active, rows[0]?.deleted], ['2026-10-01', 'EIO/CANOAS/POA', 'Sim', 'Sim']);
  });

  it('produto: agrupa por pessoa, produto, unidade e preço somando o saldo; valor = quantidade x preço', () => {
    const src = (balance: number, unit: number, movement: number): ChargedProductSourceRow => ({
      holder: 'ANA', holder_city: 'Esteio', product_code: '050', description: 'CONECTOR', balance, unit_measure: 'UN', unit_value: unit, movement_id: movement,
      is_active: false, is_deleted: false,
    });
    const rows = buildChargedProducts([src(3, 2, 1), src(4, 2, 2), src(1, 5, 3), { ...src(9, 2, 4), holder: null }], new StringPool());
    assert.deepEqual(rows.map((r) => [r.unitValue, r.quantity, r.totalValue, r.active, r.deleted]), [[2, 7, 14, 'Não', 'Não'], [5, 1, 5, 'Não', 'Não']]);
  });

  it('"TEMPO (DIAS)" conta os dias até hoje', () => {
    assert.equal(daysSince('2026-10-25', '2026-11-04'), 10);
    assert.equal(daysSince(null, '2026-11-04'), null);
  });
});

describe('Em carga · saldo patrimônio', () => {
  it('quantidade é contagem distinta do patrimônio (o vazio conta uma vez) e o valor soma cada patrimônio', () => {
    const r = buildChargedPatrimoniesReport(MODEL, sel(), '2026-11-04');
    assert.deepEqual(r.kpis, { holders: 3, value: 1900, quantity: 4 });
    assert.deepEqual(r.byHolder.rows.map((h) => [h.holder, h.quantity, h.value]), [['BIA', 1, 1000], ['ANA', 2, 800], ['CAIO', 1, 100]]);
    assert.deepEqual(r.byBase, [{ key: 'SÃO LEO/SPS/NHO', value: 3 }, { key: 'OUTROS', value: 1 }]);
    assert.equal(r.detail.rows[0]?.holder, 'ANA');
    assert.equal(r.detail.rows[0]?.days, 10);
  });

  it('"ATIVO?" casa o responsável com os usuários do Voalle; quem não é usuário sai do recorte', () => {
    const r = buildChargedPatrimoniesReport(MODEL, sel({ active: ['Ativo'] }), '2026-11-04');
    assert.deepEqual(r.byHolder.rows.map((h) => h.holder), ['ANA']);
    assert.deepEqual(r.options.active, ['Ativo', 'Desativado']);
  });
});

describe('Em carga · saldo produto', () => {
  it('por responsável: produtos distintos e valor (quantidade x preço); gráfico soma a quantidade por base', () => {
    const r = buildChargedProductsReport(MODEL, sel());
    assert.deepEqual(r.byHolder.rows.map((h) => [h.holder, h.quantity, h.value]), [['ANA', 2, 185], ['BIA', 1, 30]]);
    assert.deepEqual(r.byHolder.totals, { quantity: 2, value: 215 });
    assert.deepEqual(r.byBase, [{ key: 'EIO/CANOAS/POA', value: 115 }, { key: 'OUTROS', value: 20 }]);
    assert.deepEqual(r.kpis, { holders: 2, value: 215 });
  });

  it('a visão geral junta os lotes de preços diferentes numa linha por pessoa e produto', () => {
    const rows = groupChargedProducts(MODEL.chargedProducts);
    assert.deepEqual(rows.map((x) => [x.holder, x.description, x.quantity]), [['ANA', 'CABO', 100], ['ANA', 'CONECTOR', 15], ['BIA', 'CABO', 20]]);
  });
});

describe('Em carga · ativo? e deletado? do cadastro do item', () => {
  it('patrimônio: filtra por p.active / p.deleted', () => {
    const tags = (lists: Record<string, string[]>) => buildChargedPatrimoniesReport(MODEL, sel(lists), '2026-11-04').detail.rows.map((r) => r.patrimonyTag);
    assert.deepEqual(buildChargedPatrimoniesReport(MODEL, sel(), '2026-11-04').options.itemDeleted, ['Não', 'Sim']);
    assert.equal(tags({ itemDeleted: ['Não'] }).length, 4);
    assert.deepEqual(tags({ itemActive: ['Não'] }), [null]);
    // tirar os deletados tira o valor deles da conta
    assert.equal(buildChargedPatrimoniesReport(MODEL, sel({ itemDeleted: ['Não'] }), '2026-11-04').kpis.value, 1850);
  });

  it('produto: filtra por sp.active / sp.deleted', () => {
    const r = buildChargedProductsReport(MODEL, sel({ itemActive: ['Sim'] }));
    assert.deepEqual(r.byHolder.rows.map((h) => h.holder), ['ANA']);
    assert.deepEqual(buildChargedProductsReport(MODEL, sel()).options.itemActive, ['Não', 'Sim']);
    assert.deepEqual(buildChargedProductsReport(MODEL, sel()).options.itemDeleted, ['Não']);
  });
});

describe('report-filter · segundo recorte de data (ranges)', () => {
  interface Row { a: string; b: string }
  const SPEC: FilterSpec<Row> = { lists: [], date: (r) => r.a, ranges: [{ key: 'other', value: (r) => r.b }] };
  it('valida <key>From/<key>To e aplica junto com o período principal', () => {
    const selection = parseSelection({ otherFrom: '2026-02-01', startDate: '2026-01-01' }, SPEC as FilterSpec<unknown>);
    assert.deepEqual(selection.ranges, { other: { from: '2026-02-01', to: undefined } });
    const rows: Row[] = [{ a: '2026-01-05', b: '2026-01-10' }, { a: '2026-01-05', b: '2026-03-01' }, { a: '2025-12-01', b: '2026-03-01' }];
    assert.equal(applyFilters(rows, SPEC, selection).rows.length, 1);
  });
});
