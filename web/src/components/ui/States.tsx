import type { ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Os três estados de toda tela: carregando, vazio e erro. Sem eles o usuário
 * vê card em branco e conclui que o número é zero.
 */
export function Loading({ text = 'Carregando…' }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <div className="spinner" />
      <span>{text}</span>
    </div>
  );
}

export function Empty({ text = 'Sem dados para os filtros selecionados' }: { text?: string }) {
  return <div className="empty">{text}</div>;
}

export function Banner({ children, tone = 'warning' }: { children: ReactNode; tone?: 'warning' | 'error' }) {
  return (
    <div className={`banner${tone === 'error' ? ' error' : ''}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={tone === 'error' ? 'alerta' : 'relogio'} size={14} />
      <span>{children}</span>
    </div>
  );
}

export function ErrorBanner({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Erro ao carregar os dados.';
  return <Banner tone="error">{message}</Banner>;
}
