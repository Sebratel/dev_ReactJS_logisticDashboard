import type { CSSProperties, ReactNode } from 'react';

/** Ícones em SVG traçado, sem emoji e sem dependência externa. Herdam a cor do texto. */
const PATHS: Record<string, ReactNode> = {
  busca: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  fechar: <path d="M18 6 6 18M6 6l12 12" />,
  cadeado: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  alerta: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></>,
  relogio: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  atualizar: <><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></>,
  baixo: <path d="m6 9 6 6 6-6" />,
  cima: <path d="m6 15 6-6 6 6" />,
  direita: <path d="m9 6 6 6-6 6" />,
  baixar: <><path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" /></>,
  sair: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  sol: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></>,
  lua: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  caixa: <><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
  mais: <path d="M12 5v14M5 12h14" />,
  editar: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></>,
  lixeira: <><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></>,
  caminhao: <><path d="M10 17h4V5H2v12h3" /><path d="M20 17h2v-3.3a4 4 0 0 0-1.2-2.8L19 9h-5" /><circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
  rastro: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  ajustes: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  engrenagem: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  brilho: <><path d="M12 3l1.8 4.9L19 9.8l-5.2 1.9L12 17l-1.8-5.3L5 9.8l5.2-1.9Z" /><path d="M19 15v4M17 17h4" /></>,
  carrinho: <><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h3l2.6 12.3a1.8 1.8 0 0 0 1.8 1.4h8.3a1.8 1.8 0 0 0 1.7-1.3L21.6 7H6" /></>,
  roteador: <><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 16.5h.01M11 16.5h.01" /><path d="M8 13 6 6M16 13l2-7" /><path d="M15 16.5h3" /></>,
  carga: <><circle cx="9" cy="6" r="3" /><path d="M3 21v-2a5 5 0 0 1 5-5h2" /><rect x="13" y="13" width="8" height="8" rx="1" /><path d="M13 16.5h8M17 13v3.5" /></>,
  laboratorio: <><path d="M9 3h6M10 3v6.5L4.6 18.2A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.8L14 9.5V3" /><path d="M7.5 14h9" /></>,
  // seção Gerencial
  grafico: <path d="M3 3v18h18M7 16v-5M12 16V8M17 16v-8" />,
  novo: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M12 8v8M8 12h8" /></>,
  cabo: <><path d="M4 20c0-6 4-6 8-10s8-4 8-10" /><circle cx="4" cy="20" r="1.6" /><circle cx="20" cy="4" r="1.6" /></>,
  troca: <><path d="M7 4 3 8l4 4" /><path d="M3 8h13a4 4 0 0 1 4 4" /><path d="m17 20 4-4-4-4" /><path d="M21 16H8a4 4 0 0 1-4-4" /></>,
  reciclar: <><path d="M21 12a9 9 0 0 1-15.5 6.2" /><path d="M3 12a9 9 0 0 1 15.5-6.2" /><path d="M18.5 2v4h-4M5.5 22v-4h4" /></>,
  arquivo: <><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" /><path d="M10 13h4" /></>,
  equipe: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20v-1a6 6 0 0 1 12 0v1" /><path d="M16 4.5a3 3 0 0 1 0 6M21 20v-1a5 5 0 0 0-3.5-4.8" /></>,
  grade: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
};

interface IconProps {
  name: keyof typeof PATHS | string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 15, className, style }: IconProps) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}
