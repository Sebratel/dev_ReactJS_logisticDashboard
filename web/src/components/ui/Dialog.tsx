import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** largura máxima do painel */
  size?: 'sm' | 'md';
  /** enquanto grava, Esc e clique fora não fecham (o pedido já saiu) */
  busy?: boolean;
}

/**
 * Diálogo modal (mesmo comportamento do cadastro de supervisores da agenda):
 * Esc ou clique fora fecham, o foco fica preso dentro enquanto está aberto e
 * volta para quem o abriu.
 */
export function Dialog({ title, description, onClose, children, size = 'md', busy = false }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current;
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!busyRef.current) closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const head = items[0];
      const tail = items[items.length - 1];
      if (!head || !tail) return;
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  return createPortal(
    <div className="dialogo-camada">
      <div className="dialogo-fundo" onClick={() => !busy && onClose()} aria-hidden="true" />
      <div
        ref={panel}
        className={`dialogo dialogo-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialogo-titulo"
        tabIndex={-1}
      >
        <header>
          <div>
            <h2 id="dialogo-titulo">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Fechar">
            <Icon name="fechar" size={16} />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
