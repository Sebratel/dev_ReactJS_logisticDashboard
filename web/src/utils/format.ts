const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const int = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : nf0.format(v));
export const dec1 = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : nf1.format(v));
const brlFormat = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
/** Moeda, como o formatString "R$ #,0.00" do Power BI. */
export const brl = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : brlFormat.format(v));
/** Inteiro arredondado, como o formatString "0" das medidas do Power BI. */
export const round0 = (v: number | null | undefined): string => int(v === null || v === undefined ? v : Math.round(v));

const nfPct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Variação com sinal: 0.123 -> "+12,3%", -0.04 -> "−4,0%" (sem valor: "—"). */
export const signedPct = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const text = nfPct.format(Math.abs(v) * 100);
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${text}%`;
};
/** Participação: 0.7 -> "70,0%". */
export const pct = (v: number | null | undefined): string => (
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${nfPct.format(v * 100)}%`
);
/** Diferença de participação em pontos percentuais: 0.05 -> "+5,0 p.p.". */
export const signedPoints = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${nfPct.format(Math.abs(v) * 100)} p.p.`;
};

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** '2026-08' -> 'ago/26' */
export const labelMonth = (key: string): string => (key ? `${MONTHS[Number(key.slice(5, 7)) - 1] ?? ''}/${key.slice(2, 4)}` : '');
/** '2026-08-14' -> '14/08' */
export const labelDay = (key: string): string => (key ? `${key.slice(8, 10)}/${key.slice(5, 7)}` : '');
/** '2026-08-14[ 10:22:00]' -> '14/08/2026' */
export const labelDate = (value: string | null | undefined): string => (
  value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : '—'
);
/** '2026-08-14 10:22:31' -> '14/08/2026 10:22' */
export const labelDateTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  const time = value.length > 10 ? value.slice(11, 16) : '';
  return `${labelDate(value)}${time ? ` ${time}` : ''}`;
};

/** ISO UTC -> '02/11/2026 às 19:40' no fuso do navegador. */
export function labelInstant(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** ISO UTC -> '15:42:10' no fuso do navegador. */
export function clockTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  const h = Math.floor(s / 3600);
  if (h >= 48) return `há ${Math.floor(h / 24)} dias`;
  const m = Math.round((s % 3600) / 60);
  return m ? `há ${h}h${String(m).padStart(2, '0')}` : `há ${h}h`;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const toIsoDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = (): string => toIsoDate(new Date());
