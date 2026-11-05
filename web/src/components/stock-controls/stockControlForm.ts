import { z } from 'zod';
import { OPERATIONAL_BASES, type OperationalBase, type StockControl, type StockControlInput } from '../../services/types';

/**
 * Regras do formulário — as mesmas do servidor (`stock-control.schema.ts`),
 * repetidas aqui só para a pessoa ver o erro no campo antes de enviar. Quem
 * manda é o servidor.
 *
 * Os campos ficam como TEXTO no formulário (é o que o input devolve) e viram
 * número só em `toInput`.
 */
const quantity = (subject: string) => z
  .string()
  .trim()
  .min(1, `Informe ${subject}.`)
  .regex(/^\d{1,7}$/, 'Use um número inteiro, sem sinal.')
  .refine((v) => Number(v) <= 1_000_000, 'Acima do permitido.');

export const StockControlFormSchema = z
  .object({
    code: z.string().trim().regex(/^\d{1,8}$/, 'Informe o código do produto (só números).'),
    category: z.string().trim().min(1, 'Informe a situação.').max(60, 'Use no máximo 60 caracteres.'),
    item: z.string().trim().max(200, 'Use no máximo 200 caracteres.'),
    baseName: z.string().refine((v) => (OPERATIONAL_BASES as readonly string[]).includes(v), 'Escolha a base de origem.'),
    alertLevel: quantity('o alerta de estoque'),
    minimumLevel: quantity('o estoque mínimo'),
    buyer: z.string().trim().max(80, 'Use no máximo 80 caracteres.'),
    leadTimeDays: z
      .string()
      .trim()
      .regex(/^\d{0,4}$/, 'Use o número de dias (inteiro).')
      .refine((v) => v === '' || Number(v) <= 3650, 'Lead time acima de 10 anos.'),
    externalProcess: z.string().trim().max(200, 'Use no máximo 200 caracteres.'),
  })
  .refine((v) => Number(v.alertLevel) >= Number(v.minimumLevel), {
    path: ['alertLevel'],
    message: 'O alerta não pode ser menor que o estoque mínimo.',
  });

export type StockControlFormValues = z.infer<typeof StockControlFormSchema>;

export const EMPTY_FORM: StockControlFormValues = {
  code: '',
  category: '',
  item: '',
  baseName: '',
  alertLevel: '',
  minimumLevel: '',
  buyer: '',
  leadTimeDays: '',
  externalProcess: '',
};

export function toFormValues(item: StockControl): StockControlFormValues {
  return {
    code: String(item.code),
    category: item.category,
    item: item.item ?? '',
    baseName: item.baseName,
    alertLevel: String(item.alertLevel),
    minimumLevel: String(item.minimumLevel),
    buyer: item.buyer ?? '',
    leadTimeDays: item.leadTimeDays === null ? '' : String(item.leadTimeDays),
    externalProcess: item.externalProcess ?? '',
  };
}

const textOrNull = (v: string): string | null => {
  const text = v.replace(/\s+/g, ' ').trim();
  return text === '' ? null : text;
};

export function toInput(values: StockControlFormValues): StockControlInput {
  return {
    code: Number(values.code),
    category: values.category.replace(/\s+/g, ' ').trim(),
    item: textOrNull(values.item),
    baseName: values.baseName as OperationalBase,
    alertLevel: Number(values.alertLevel),
    minimumLevel: Number(values.minimumLevel),
    buyer: textOrNull(values.buyer),
    leadTimeDays: values.leadTimeDays.trim() === '' ? null : Number(values.leadTimeDays),
    externalProcess: textOrNull(values.externalProcess),
  };
}
