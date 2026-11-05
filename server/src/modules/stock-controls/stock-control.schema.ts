import { z } from 'zod';
import { OPERATIONAL_BASES } from '../../model/business-rules.js';

/**
 * Validação do que chega do formulário (criar e editar mandam o item inteiro).
 * Os limites são folgados para a operação real e existem contra uso indevido:
 * o maior estoque mínimo da planilha oficial é 50 mil, o maior lead time 120 dias.
 */
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

const requiredText = (max: number, message: string) => z
  .string({ error: message })
  .transform((v) => v.replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(1, message).max(max, `Use no máximo ${max} caracteres.`))
  .refine((v) => !CONTROL_CHARS.test(v), 'Texto com caractere inválido.');

const optionalText = (max: number) => z
  .string()
  .nullish()
  .transform((v) => (v ? v.replace(/\s+/g, ' ').trim() : ''))
  .pipe(z.string().max(max, `Use no máximo ${max} caracteres.`))
  .refine((v) => !CONTROL_CHARS.test(v), 'Texto com caractere inválido.')
  .transform((v) => (v === '' ? null : v));

/** Quantidade inteira não negativa; `subject` é o nome do campo na frase ("O estoque mínimo"). */
const quantity = (subject: string) => z
  .number({ error: `${subject} é obrigatório.` })
  .int(`${subject} deve ser um número inteiro.`)
  .min(0, `${subject} não pode ser negativo.`)
  .max(1_000_000, `${subject} acima do permitido.`);

export const StockControlInputSchema = z.strictObject({
  code: z
    .number({ error: 'Informe o código do produto.' })
    .int('O código é um número inteiro.')
    .min(1, 'Código inválido.')
    .max(99_999_999, 'Código inválido.'),
  category: requiredText(60, 'Informe a situação.'),
  item: optionalText(200),
  baseName: z.enum(OPERATIONAL_BASES, { error: 'Escolha uma base de origem.' }),
  alertLevel: quantity('O alerta de estoque'),
  minimumLevel: quantity('O estoque mínimo'),
  buyer: optionalText(80),
  leadTimeDays: z
    .number({ error: 'Lead time inválido.' })
    .int('O lead time é um número inteiro de dias.')
    .min(0, 'Lead time não pode ser negativo.')
    .max(3650, 'Lead time acima do permitido.')
    .nullish()
    .transform((v) => v ?? null),
  externalProcess: optionalText(200),
});

export type StockControlInput = z.infer<typeof StockControlInputSchema>;

export const StockControlIdSchema = z.uuid('Identificador inválido.');
