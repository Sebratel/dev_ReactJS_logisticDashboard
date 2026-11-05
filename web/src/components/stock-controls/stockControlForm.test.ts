import { describe, expect, it } from 'vitest';
import { EMPTY_FORM, StockControlFormSchema, toInput } from './stockControlForm';

const valid = {
  ...EMPTY_FORM,
  code: '05601',
  category: '  Manutenção /  Curva A ',
  baseName: 'SEDE - PORTO ALEGRE',
  alertLevel: '20',
  minimumLevel: '10',
};

const messages = (values: typeof EMPTY_FORM) => {
  const result = StockControlFormSchema.safeParse(values);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
};

describe('formulário do controle de estoque', () => {
  it('converte o texto do formulário no que a API espera', () => {
    expect(StockControlFormSchema.safeParse(valid).success).toBe(true);
    expect(toInput(valid)).toEqual({
      code: 5601,
      category: 'Manutenção / Curva A',
      item: null,
      baseName: 'SEDE - PORTO ALEGRE',
      alertLevel: 20,
      minimumLevel: 10,
      buyer: null,
      leadTimeDays: null,
      externalProcess: null,
    });
  });

  it('obrigatórios e números inteiros', () => {
    const errors = messages({ ...EMPTY_FORM, alertLevel: '1,5', minimumLevel: '-1' });
    expect(Object.keys(errors).sort()).toEqual(['alertLevel', 'baseName', 'category', 'code', 'minimumLevel']);
  });

  it('alerta abaixo do mínimo não passa', () => {
    expect(messages({ ...valid, alertLevel: '5' })).toEqual({ alertLevel: 'O alerta não pode ser menor que o estoque mínimo.' });
  });

  it('base fora da lista não passa', () => {
    expect(messages({ ...valid, baseName: 'BASE X' })).toHaveProperty('baseName');
  });
});
