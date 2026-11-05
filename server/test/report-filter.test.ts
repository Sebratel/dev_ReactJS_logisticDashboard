import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ZodError } from 'zod';
import { applyFilters, parseSelection, type FilterSpec } from '../src/modules/reports/report-filter.js';

interface Row { base: string; tech: string | null; date: string; tag: string }

const ROWS: Row[] = [
  { base: 'CAN', tech: 'ANA', date: '2026-10-01', tag: 'P-001' },
  { base: 'CAN', tech: 'BIA', date: '2026-10-15', tag: 'P-002' },
  { base: 'SLE', tech: 'ANA', date: '2026-11-01', tag: 'P-003' },
  { base: 'POA', tech: null, date: '2026-09-30', tag: 'X-004' },
];

const SPEC: FilterSpec<Row> = {
  date: (r) => r.date,
  lists: [
    { key: 'base', values: (r) => r.base },
    { key: 'tech', values: (r) => r.tech },
  ],
  searches: [{ key: 'tag', value: (r) => r.tag }],
};

describe('applyFilters — comportamento dos slicers do Power BI', () => {
  it('sem seleção devolve tudo e as opções completas, com "(Em branco)"', () => {
    const { rows, options } = applyFilters(ROWS, SPEC, { lists: {}, searches: {} });
    assert.equal(rows.length, 4);
    assert.deepEqual(options.base, ['CAN', 'POA', 'SLE']);
    assert.deepEqual(options.tech, ['(Em branco)', 'ANA', 'BIA']);
  });

  it('um slicer filtra os outros, mas não a si mesmo', () => {
    const { rows, options } = applyFilters(ROWS, SPEC, { lists: { base: ['CAN'] }, searches: {} });
    assert.equal(rows.length, 2);
    assert.deepEqual(options.base, ['CAN', 'POA', 'SLE']);
    assert.deepEqual(options.tech, ['ANA', 'BIA']);
  });

  it('período, busca e listas se cruzam', () => {
    const { rows } = applyFilters(ROWS, SPEC, {
      lists: { tech: ['ANA'] }, searches: { tag: 'p-00' }, startDate: '2026-10-01', endDate: '2026-10-31',
    });
    assert.deepEqual(rows.map((r) => r.tag), ['P-001']);
  });

  it('valor marcado que sumiu do recorte continua na lista (para poder desmarcar)', () => {
    const { options } = applyFilters(ROWS, SPEC, { lists: { base: ['SLE'], tech: ['BIA'] }, searches: {} });
    assert.ok(options.tech?.includes('BIA'));
    assert.ok(options.base?.includes('SLE'));
  });

  it('campo sem "(Em branco)" não lista nem casa linha sem valor', () => {
    const spec: FilterSpec<Row> = { lists: [{ key: 'tech', includeBlank: false, values: (r) => r.tech }] };
    const { options } = applyFilters(ROWS, spec, { lists: {}, searches: {} });
    assert.deepEqual(options.tech, ['ANA', 'BIA']);
  });
});

describe('parseSelection — validação da query string', () => {
  const spec = SPEC as FilterSpec<unknown>;

  it('aceita parâmetro repetido e ignora campos desconhecidos', () => {
    const s = parseSelection({ base: ['CAN', 'SLE'], other: 'x', tag: 'P' }, spec);
    assert.deepEqual(s.lists.base, ['CAN', 'SLE']);
    assert.equal(s.searches.tag, 'P');
  });

  it('recusa data fora do formato ISO', () => {
    assert.throws(() => parseSelection({ startDate: '01/10/2026' }, spec), ZodError);
  });

  it('recusa lista enorme e valor gigante (abuso de memória/CPU)', () => {
    assert.throws(() => parseSelection({ base: Array.from({ length: 301 }, (_, i) => `B${i}`) }, spec), ZodError);
    assert.throws(() => parseSelection({ base: 'x'.repeat(301) }, spec), ZodError);
  });
});
