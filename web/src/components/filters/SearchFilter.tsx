import { useEffect, useState } from 'react';
import { Icon } from '../ui/Icon';

interface SearchFilterProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Busca por texto para campo com centenas de milhares de valores (patrimônio,
 * serial, protocolo): no relatório era um slicer com busca; listar tudo não cabe.
 * Espera a pessoa parar de digitar (400 ms) antes de filtrar.
 */
export function SearchFilter({ label, value, onChange }: SearchFilterProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return undefined;
    const timer = window.setTimeout(() => onChange(draft.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [draft, value, onChange]);

  return (
    <label className={`busca${value ? ' ativo' : ''}`} title={`Buscar por ${label.toLowerCase()}`}>
      <Icon name="busca" size={13} />
      <input type="search" value={draft} placeholder={label} maxLength={100} onChange={(e) => setDraft(e.target.value)} />
    </label>
  );
}
