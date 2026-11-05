import { cleanText } from './text.helper.js';

/**
 * Interning de strings: o mesmo nome de técnico aparece em centenas de milhares
 * de linhas. Guardar uma única instância por valor derruba a memória do modelo
 * sem mudar nada no comportamento.
 */
export class StringPool {
  private readonly values = new Map<string, string>();

  intern(value: unknown): string | null {
    const text = cleanText(value);
    if (text === null) return null;
    const existing = this.values.get(text);
    if (existing !== undefined) return existing;
    this.values.set(text, text);
    return text;
  }
}
