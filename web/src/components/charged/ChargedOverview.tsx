import { DataTable, type Column } from '../tables/DataTable';
import { RankingTable } from '../tables/RankingTable';
import { Kpi } from '../ui/Kpi';
import { Visual } from '../ui/Visual';
import type { UrlFilters } from '../../hooks/useUrlFilters';
import type { HolderRow, KeyValue } from '../../services/types';
import { brl, int } from '../../utils/format';

interface ChargedOverviewProps {
  filters: UrlFilters;
  byHolder: { rows: HolderRow[]; totals: { quantity: number; value: number } };
  kpis: { holders: number; value: number };
  byBase: KeyValue[];
  /** o que a QUANTIDADE conta nesta tela (vai no subtítulo e no gráfico) */
  quantityMeaning: string;
  baseValueLabel: string;
  valueMeaning: string;
}

/**
 * Parte de cima das duas telas "em carga" (Power BI "LOG - Objetos em Carga"):
 * QUANTIDADE por RESPONSÁVEL, os dois cartões e o total por base. Clicar numa
 * linha filtra pelo responsável; numa base, pela base.
 */
export function ChargedOverview({
  filters, byHolder, kpis, byBase, quantityMeaning, baseValueLabel, valueMeaning,
}: ChargedOverviewProps) {
  const columns: Column<HolderRow>[] = [
    { key: 'holder', title: 'RESPONSÁVEL', value: (r) => r.holder, wrap: true },
    { key: 'quantity', title: 'QUANTIDADE', value: (r) => r.quantity },
    { key: 'value', title: 'VALOR TOTAL', value: (r) => r.value, render: (r) => brl(r.value), align: 'center' },
  ];
  const selectedHolders = filters.getList('holder');

  return (
    <div className="grid linha-carga">
      <Visual
        title="Quantidade por responsável"
        subtitle={`${int(byHolder.rows.length)} responsáveis · quantidade = ${quantityMeaning} · clique para filtrar`}
        className="v-tabela"
        flush
      >
        <DataTable
          columns={columns}
          rows={byHolder.rows}
          rowKey={(r) => r.holder}
          footer={{ holder: 'Total', quantity: int(byHolder.totals.quantity), value: brl(byHolder.totals.value) }}
          onRowClick={(r) => filters.toggle('holder', r.holder)}
          isSelected={(r) => selectedHolders.includes(r.holder)}
        />
      </Visual>
      <div className="col-kpi">
        <Kpi value={int(kpis.holders)} label="Responsáveis" description="pessoas com algo em carga" />
        <Kpi value={brl(kpis.value)} label="Valor total" description={valueMeaning} />
      </div>
      <Visual title="Total por base" subtitle="base pela cidade do responsável · clique para filtrar" className="v-tabela" flush>
        <RankingTable
          label="BASE"
          valueLabel={baseValueLabel}
          data={byBase}
          onSelect={(k) => filters.toggle('base', k)}
          selected={filters.getList('base')}
        />
      </Visual>
    </div>
  );
}
