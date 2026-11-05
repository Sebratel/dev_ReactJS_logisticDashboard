import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ReportQuery } from '../services/reportsService';

/**
 * Os filtros moram na URL, não em estado local: o link continua
 * compartilhável e a tela não precisa de estado novo para lembrar o recorte.
 *
 * Seletores da barra trocam a URL com `replace` (cada caixa marcada não vira
 * um passo no histórico); o clique num visual (`toggle`) empilha, para o botão
 * voltar desfazer a exploração.
 */
export function useUrlFilters() {
  const [params, setParams] = useSearchParams();

  const query = useMemo<ReportQuery>(() => {
    const out: ReportQuery = {};
    const keys = [...new Set(params.keys())].sort();
    for (const key of keys) {
      const values = params.getAll(key).filter((v) => v !== '');
      if (!values.length) continue;
      out[key] = values.length === 1 ? (values[0] as string) : values;
    }
    return out;
  }, [params]);

  const getList = useCallback((key: string): string[] => params.getAll(key).filter((v) => v !== ''), [params]);
  const getValue = useCallback((key: string): string => params.get(key) ?? '', [params]);

  const setList = useCallback((key: string, values: string[], push = false) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(key);
      values.forEach((v) => next.append(key, v));
      return next;
    }, { replace: !push });
  }, [setParams]);

  const setValues = useCallback((patch: Record<string, string | undefined>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    }, { replace: true });
  }, [setParams]);

  /** Clique num visual: liga/desliga um valor e empilha no histórico. */
  const toggle = useCallback((key: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      const current = next.getAll(key);
      next.delete(key);
      const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      updated.forEach((v) => next.append(key, v));
      return next;
    });
  }, [setParams]);

  const clear = useCallback((keys: string[]) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      keys.forEach((k) => next.delete(k));
      return next;
    }, { replace: true });
  }, [setParams]);

  return { query, getList, getValue, setList, setValues, toggle, clear };
}

export type UrlFilters = ReturnType<typeof useUrlFilters>;
