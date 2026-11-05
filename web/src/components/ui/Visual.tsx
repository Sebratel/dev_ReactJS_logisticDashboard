import type { CSSProperties, ReactNode } from 'react';

interface VisualProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  flush?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}

/** Card padrão de todo visual: barra de título vinho, subtítulo e ações (exportar, granularidade). */
export function Visual({ title, subtitle, actions, className = 'v-grafico', flush = false, style, children }: VisualProps) {
  return (
    <section className={`visual ${className}`} style={style}>
      <header>
        <span className="titulo">
          <span>{title}</span>
          {actions}
        </span>
        {subtitle && <span className="sub">{subtitle}</span>}
      </header>
      <div className={`body${flush ? ' flush' : ''}`}>{children}</div>
    </section>
  );
}
