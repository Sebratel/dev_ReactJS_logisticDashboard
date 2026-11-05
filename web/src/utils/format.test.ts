import { describe, expect, it } from 'vitest';
import { baseColor, chartColorsFor, gradient } from './chartColors';
import { labelDate, labelDateTime, labelDay, labelMonth, round0 } from './format';

describe('format', () => {
  it('rótulos de data no formato brasileiro, sem conversão de fuso', () => {
    expect(labelMonth('2026-08')).toBe('ago/26');
    expect(labelDay('2026-08-14')).toBe('14/08');
    expect(labelDate('2026-08-14 23:59:00')).toBe('14/08/2026');
    expect(labelDateTime('2026-08-14 07:05:31.2')).toBe('14/08/2026 07:05');
    expect(labelDate(null)).toBe('—');
  });

  it('medidas com formatString "0" saem arredondadas', () => {
    expect(round0(512263.8)).toBe('512.264');
    expect(round0(null)).toBe('—');
  });
});

describe('cores dos gráficos', () => {
  const colors = chartColorsFor('light');

  it('cada base tem cor fixa, independente do nome longo ou da sigla', () => {
    expect(baseColor('BASE OPERACIONAL - SÃO LEOPOLDO', colors)).toBe(colors.gold);
    expect(baseColor('BASE SLE', colors)).toBe(colors.gold);
    expect(baseColor('BASE OPERACIONAL - CANOAS', colors)).toBe(colors.orange);
    expect(baseColor('OUTROS', colors)).toBe(colors.neutral);
  });

  it('gradiente vai do claro (mínimo) ao dourado (máximo)', () => {
    expect(gradient(0, 0, 10, '#000000', '#ffffff')).toBe('#000000');
    expect(gradient(10, 0, 10, '#000000', '#ffffff')).toBe('#ffffff');
    expect(gradient(5, 5, 5, '#000000', '#ffffff')).toBe('#ffffff');
  });
});
