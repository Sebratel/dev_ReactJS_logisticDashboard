/**
 * Token do Google (Google Identity Services, fluxo de token) — o mesmo desenho
 * das outras dashboards: o front obtém o access_token, o servidor confere no
 * Google a cada requisição (com cache), e não existe senha nossa.
 *
 * O token tem ~1 h de vida e escopo só de identidade (openid email profile).
 * Fica no localStorage para sobreviver ao F5, como nas dashboards irmãs; a CSP
 * do servidor é o que protege contra script injetado lê-lo.
 */

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const STORAGE_KEY = 'logistic-dashboard.auth';
const RENEW_BEFORE_MS = 5 * 60_000;

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: unknown) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

interface StoredToken {
  token: string;
  expiresAt: number;
}

function readStored(): StoredToken | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredToken>;
    if (typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'number') return null;
    return { token: parsed.token, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function writeStored(value: StoredToken | null): void {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // modo privado: o token vale só enquanto a aba estiver aberta
  }
}

let current: StoredToken | null = readStored();
let tokenClient: TokenClient | null = null;
let clientIdInUse: string | null = null;
let scriptPromise: Promise<void> | null = null;
let pending: { resolve: (token: string) => void; reject: (err: Error) => void } | null = null;
let renewing: Promise<string> | null = null;
let renewTimer: number | undefined;
const sessionEndListeners = new Set<(reason: SessionEndReason) => void>();

export type SessionEndReason = 'EXPIRED' | 'LOGOUT';

/** Token atual, mesmo perto de vencer: quem decide que expirou é o 401 da API. */
export const getAccessToken = (): string | null => current?.token ?? null;

function setToken(token: string | null, expiresInSeconds = 3600): void {
  current = token ? { token, expiresAt: Date.now() + expiresInSeconds * 1000 } : null;
  writeStored(current);
  scheduleRenewal();
}

/**
 * Renova sozinho cinco minutos antes do vencimento. Se a renovação antecipada
 * falhar, NÃO encerra a sessão: o token atual ainda vale, e quem decide que a
 * sessão acabou é o 401 de verdade da API.
 */
function scheduleRenewal(): void {
  window.clearTimeout(renewTimer);
  if (!current) return;
  const wait = Math.max(5000, current.expiresAt - Date.now() - RENEW_BEFORE_MS);
  renewTimer = window.setTimeout(() => {
    renewAccessToken().catch(() => undefined);
  }, wait);
}

function loadScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Falha ao carregar o login do Google.'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export async function initGoogleClient(clientId: string): Promise<void> {
  await loadScript();
  if (tokenClient && clientIdInUse === clientId) return;
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Login do Google indisponível.');
  clientIdInUse = clientId;
  tokenClient = oauth2.initTokenClient({
    client_id: clientId,
    scope: 'openid email profile',
    callback: (response) => {
      const waiting = pending;
      pending = null;
      if (!waiting) return;
      if (response.access_token) {
        setToken(response.access_token, Number(response.expires_in) || 3600);
        waiting.resolve(response.access_token);
      } else {
        waiting.reject(new Error('O Google não devolveu o token de acesso.'));
      }
    },
    error_callback: () => {
      const waiting = pending;
      pending = null;
      waiting?.reject(new Error('A janela do Google foi fechada antes de concluir.'));
    },
  });
}

function requestToken(silent: boolean): Promise<string> {
  if (!tokenClient) return Promise.reject(new Error('Login não inicializado.'));
  const client = tokenClient;
  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      if (pending) {
        pending = null;
        reject(new Error('Tempo esgotado ao falar com o Google.'));
      }
    }, 20_000);
    pending = {
      resolve: (token) => { window.clearTimeout(timeout); resolve(token); },
      reject: (err) => { window.clearTimeout(timeout); reject(err); },
    };
    try {
      client.requestAccessToken(silent ? { prompt: 'none' } : {});
    } catch (err) {
      window.clearTimeout(timeout);
      pending = null;
      reject(err instanceof Error ? err : new Error('Falha no login.'));
    }
  });
}

export const signInWithGoogle = (): Promise<string> => requestToken(false);

/** Renovação silenciosa (sem tela), usada antes do vencimento e no 401. */
export function renewAccessToken(): Promise<string> {
  if (renewing) return renewing;
  renewing = requestToken(true).finally(() => {
    renewing = null;
  });
  return renewing;
}

export function endSession(reason: SessionEndReason): void {
  if (!current && reason === 'EXPIRED') return;
  window.clearTimeout(renewTimer);
  setToken(null);
  sessionEndListeners.forEach((listener) => listener(reason));
}

export function onSessionEnd(listener: (reason: SessionEndReason) => void): () => void {
  sessionEndListeners.add(listener);
  return () => sessionEndListeners.delete(listener);
}

scheduleRenewal();
