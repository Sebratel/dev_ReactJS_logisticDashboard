import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toCsv } from '../src/common/helpers/csv.helper.js';
import { lastThreeClosedMonths } from '../src/common/helpers/date.helper.js';
import { baseGroupOf, isCableProduct } from '../src/model/builders/activity.builder.js';

const BOM = String.fromCharCode(0xfeff);

describe('regras de negócio', () => {
  it('BaseGrupo pela região do protocolo (coluna DAX)', () => {
    assert.equal(baseGroupOf('✅Base São Leopoldo (Ativação)'), 'BASE SLE');
    assert.equal(baseGroupOf('Esteio (EIO)'), 'BASE CAN');
    assert.equal(baseGroupOf('Gravataí (GVT)'), 'OUTROS');
    assert.equal(baseGroupOf(null), 'OUTROS');
  });

  it('cabo é lista fechada — "CABO HDMI" não é cabo de rede', () => {
    assert.equal(isCableProduct('CABO DE FIBRA DROP FLATH 1FO'), true);
    assert.equal(isCableProduct('cabo de fibra drop flath 1fo'), true);
    assert.equal(isCableProduct('CABO HDMI 2M'), false);
  });

  it('média de 3 meses usa os três meses FECHADOS anteriores', () => {
    assert.deepEqual(lastThreeClosedMonths(new Date(2026, 10, 2)), { start: '2026-08-01', end: '2026-10-31' });
    assert.deepEqual(lastThreeClosedMonths(new Date(2026, 1, 15)), { start: '2025-11-01', end: '2026-01-31' });
  });
});

describe('CSV', () => {
  it('exporta com ; e BOM, e neutraliza fórmula vinda do ERP', () => {
    const csv = toCsv([{ header: 'NOME', value: (r: { n: string }) => r.n }], [{ n: '=HYPERLINK("x")' }, { n: 'ANA; BIA' }]);
    assert.ok(csv.startsWith(`${BOM}NOME`));
    assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
    assert.ok(csv.includes('"ANA; BIA"'));
  });
});
