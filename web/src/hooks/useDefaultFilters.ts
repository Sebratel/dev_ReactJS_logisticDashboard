import { useEffect, useState } from 'react';
import type { UrlFilters } from './useUrlFilters';

/**
 * Filtro padrão de uma tela: quem entra SEM filtro nenhum na URL (pela aba ou
 * pela capa) já cai com `defaults` marcado. Só na entrada — depois disso,
 * limpar o filtro mostra tudo.
 *
 * Devolve `true` enquanto o padrão ainda não chegou na URL: a tela segura a
 * consulta até lá. Não basta liberar logo depois de pedir a troca de URL — o
 * router aplica a navegação depois do estado local, e a primeira consulta saía
 * sem filtro (o recorte inteiro, à toa) antes da certa.
 */
export function useDefaultFilters(filters: UrlFilters, defaults: Record<string, string>): boolean {
  const [pending, setPending] = useState(() => Object.keys(filters.query).length === 0);

  useEffect(() => {
    if (pending) filters.setValues(defaults);
    // só na entrada da tela
  }, []);

  const applied = Object.entries(defaults).every(([key, value]) => filters.getValue(key) === value);
  useEffect(() => {
    if (pending && applied) setPending(false);
  }, [pending, applied]);

  return pending;
}
