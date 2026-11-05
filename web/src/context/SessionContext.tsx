import { useQueryClient } from '@tanstack/react-query';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import {
  endSession, getAccessToken, initGoogleClient, onSessionEnd, signInWithGoogle, type SessionEndReason,
} from '../services/authService';
import { ApiError } from '../services/httpClient';
import { fetchAuthConfig, fetchCurrentUser, recordLogin } from '../services/sessionService';
import type { AuthConfig, SessionUser } from '../services/types';

interface SessionValue {
  config: AuthConfig | null;
  user: SessionUser | null;
  loading: boolean;
  bootError: string | null;
  endReason: SessionEndReason | null;
  isAdmin: boolean;
  /** vê a seção Gerencial (admin sempre vê) */
  hasManagement: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Sessão: configuração pública do login, usuário logado e o fim da sessão.
 *
 * Encerrar a sessão é um EVENTO (vem do authService): limpa o usuário e o cache
 * do React Query, para ninguém reencontrar os números da conta anterior e para
 * a tela não ficar montada com cards em branco depois de um 401.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<SessionEndReason | null>(null);

  useEffect(() => onSessionEnd((reason) => {
    setUser(null);
    setEndReason(reason);
    queryClient.clear();
  }), [queryClient]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cfg = await fetchAuthConfig();
        if (!alive) return;
        setConfig(cfg);
        if (!cfg.enabled) {
          setUser(await fetchCurrentUser());
          return;
        }
        await initGoogleClient(cfg.clientId).catch(() => undefined);
        if (getAccessToken()) {
          const me = await fetchCurrentUser().catch(() => null);
          if (alive && me) setUser(me);
        }
      } catch (err) {
        if (alive) setBootError(err instanceof ApiError ? err.message : 'Não foi possível falar com o servidor.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const signIn = useCallback(async () => {
    if (!config?.clientId) throw new Error('Login com Google não configurado no servidor.');
    await initGoogleClient(config.clientId);
    await signInWithGoogle();
    try {
      const me = await fetchCurrentUser();
      setEndReason(null);
      setUser(me);
      // só registro: se falhar, o login segue normal
      void recordLogin().catch(() => undefined);
    } catch (err) {
      endSession('LOGOUT');
      throw err instanceof ApiError ? new Error(err.message) : err;
    }
  }, [config]);

  const signOut = useCallback(() => {
    endSession('LOGOUT');
  }, []);

  const value = useMemo<SessionValue>(() => ({
    config,
    user,
    loading,
    bootError,
    endReason,
    isAdmin: user?.role === 'ADMIN',
    hasManagement: user?.role === 'ADMIN' || user?.managementAccess === true,
    signIn,
    signOut,
  }), [config, user, loading, bootError, endReason, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession fora do SessionProvider');
  return ctx;
}
