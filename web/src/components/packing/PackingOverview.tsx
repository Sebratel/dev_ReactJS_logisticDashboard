import type { KeyValue, PackingKpis, PackingProductRow } from '../../services/types';
import { labelDate, labelDay, labelMonth, round0 } from '../../utils/format';
import { PeriodColumns } from '../charts/PeriodColumns';
import { DataTable, type Column } from '../tables/DataTable';
import { Kpi } from '../ui/Kpi';
import { Empty } from '../ui/States';
import { Visual } from '../ui/Visual';

interface PackingOverviewProps {
  kpis: PackingKpis;
  monthly: KeyValue[];
  daily: { points: KeyValue[]; from: string | null; to: string | null };
  byProduct: PackingProductRow[];
  /** "produto" ou "patrimônio" — os rótulos do relatório mudam entre as telas */
  itemLabel: string;
  totalLabel: string;
}

/**
 * Faixas comuns às duas telas de romaneio, na ordem do relatório: o resumo por
 * item e, abaixo, romaneios por mês | cartões | romaneios por dia.
 */
export function PackingOverview({ kpis, monthly, daily, byProduct, itemLabel, totalLabel }: PackingOverviewProps) {
  const columns: Column<PackingProductRow>[] = [
    { key: 'productCode', title: 'CÓDIGO', value: (r) => r.productCode, align: 'center' },
    { key: 'description', title: 'DESCRIÇÃO', value: (r) => r.description, wrap: true },
    { key: 'total', title: totalLabel, value: (r) => r.total, databar: true },
    { key: 'monthlyAverage', title: 'CONSUMO MÉDIO', value: (r) => r.monthlyAverage, render: (r) => round0(r.monthlyAverage) },
    { key: 'threeMonthAverage', title: 'CONSUMO MÉDIO 3 MESES', value: (r) => r.threeMonthAverage, render: (r) => round0(r.threeMonthAverage) },
    { key: 'packings', title: 'ROMANEIOS', value: (r) => r.packings },
    { key: 'monthlyPackings', title: 'MÉDIA MENSAL ROMANEIOS', value: (r) => r.monthlyPackings, render: (r) => round0(r.monthlyPackings) },
  ];

  return (
    <>
      <Visual
        title={`Resumo por ${itemLabel}`}
        subtitle="Consumo médio = total ÷ meses com movimento · 3 meses = os três meses fechados anteriores, sem o filtro de período"
        className="v-tabela"
        flush
      >
        <DataTable columns={columns} rows={byProduct} rowKey={(r) => `${r.productCode}|${r.description}`} />
      </Visual>

      <div className="grid linha-grafico-kpi-grafico">
        <Visual title="Romaneios por período · mensal" subtitle="romaneios distintos por mês">
          {monthly.length ? <PeriodColumns data={monthly} name="Romaneios" labelOf={labelMonth} /> : <Empty />}
        </Visual>
        <div className="col-kpi">
          <Kpi value={round0(kpis.total)} label={`Total ${itemLabel === 'produto' ? 'consumido' : 'enviado'}`} />
          <Kpi value={round0(kpis.monthlyAverage)} label="Consumo médio" description="por mês com movimento" />
          <Kpi value={round0(kpis.threeMonthAverage)} label="Média 3 meses" description="3 meses fechados" />
          <Kpi value={round0(kpis.packings)} label="Romaneios" />
          <Kpi value={round0(kpis.monthlyPackings)} label="Média romaneios" description="por mês com movimento" />
        </div>
        <Visual
          title="Romaneios por período · diário"
          subtitle={daily.from && daily.to ? `${labelDate(daily.from)} a ${labelDate(daily.to)} (últimos 31 dias do recorte)` : undefined}
        >
          {daily.points.length ? <PeriodColumns data={daily.points} name="Romaneios" labelOf={labelDay} tooltipLabelOf={labelDate} /> : <Empty />}
        </Visual>
      </div>
    </>
  );
}
