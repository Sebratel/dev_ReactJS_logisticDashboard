import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface AutoSizerProps {
  children: (size: { width: number; height: number }) => ReactNode;
  minHeight?: number;
}

/**
 * Mede o contêiner e entrega largura/altura para o gráfico. Substitui o
 * ResponsiveContainer do Recharts, que nas dashboards irmãs deixou gráficos
 * invisíveis sem erro no console. `useLayoutEffect` para medir antes da
 * primeira pintura.
 */
export function AutoSizer({ children, minHeight = 180 }: AutoSizerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const height = Math.max(rect.height, minHeight);
      setSize((s) => (Math.abs(s.width - rect.width) > 1 || Math.abs(s.height - height) > 1 ? { width: rect.width, height } : s));
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    window.addEventListener('resize', measure);
    const late = window.setTimeout(measure, 120);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.clearTimeout(late);
    };
  }, [minHeight]);

  return (
    <div ref={ref} style={{ flex: 1, width: '100%', height: '100%', minHeight }}>
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  );
}
