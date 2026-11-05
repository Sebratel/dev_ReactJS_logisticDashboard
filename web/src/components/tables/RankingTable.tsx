import type { KeyValue } from '../../services/types';
import { DataTable } from './DataTable';

interface RankingTableProps {
  label: string;
  valueLabel?: string;
  data: KeyValue[];
  onSelect?: (key: string) => void;
  selected?: string[];
}

/** Tabela "nome x quantidade" com barra de dados e total no rodapé. */
export function RankingTable({ label, valueLabel = 'QTD', data, onSelect, selected = [] }: RankingTableProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <DataTable<KeyValue>
      columns={[
        { key: 'key', title: label, value: (r) => r.key, wrap: true },
        { key: 'value', title: valueLabel, value: (r) => r.value, databar: true },
      ]}
      rows={data}
      rowKey={(r) => r.key}
      footer={{ key: `Total (${data.length})`, value: new Intl.NumberFormat('pt-BR').format(total) }}
      onRowClick={onSelect ? (r) => onSelect(r.key) : undefined}
      isSelected={(r) => selected.includes(r.key)}
    />
  );
}
