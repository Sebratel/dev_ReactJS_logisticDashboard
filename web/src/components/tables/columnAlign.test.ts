import { describe, expect, it } from 'vitest';
import { columnAlign } from './DataTable';

type Row = { v: string | number | null };
const col = (align?: 'left' | 'center') => ({ align, value: (r: Row) => r.v });
const rows = (...values: Array<string | number | null>): Row[] => values.map((v) => ({ v }));

describe('alinhamento das colunas das tabelas', () => {
  it('número, valor e quantidade ficam centralizados', () => {
    expect(columnAlign(col(), rows(1643, 0, 12.5, null))).toBe('center');
  });

  it('data e data/hora ficam centralizadas', () => {
    expect(columnAlign(col(), rows('2026-11-04', '2026-11-04 10:22:31', null))).toBe('center');
  });

  it('código, nota e protocolo só com dígitos ficam centralizados', () => {
    expect(columnAlign(col(), rows('00032', '123456', '1874780'))).toBe('center');
  });

  it('texto fica à esquerda — basta um valor que não seja número', () => {
    expect(columnAlign(col(), rows('ONU GPON WIFI', 'CABO DROP'))).toBe('left');
    expect(columnAlign(col(), rows('12345', 'ZTEG12AB'))).toBe('left');
  });

  it('coluna vazia fica à esquerda e o alinhamento explícito é respeitado', () => {
    expect(columnAlign(col(), rows(null, ''))).toBe('left');
    expect(columnAlign(col('center'), rows('BASE OPERACIONAL'))).toBe('center');
    expect(columnAlign(col('left'), rows(10, 20))).toBe('left');
  });
});
