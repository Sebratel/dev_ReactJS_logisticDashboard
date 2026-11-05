import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, CartesianGrid, ComposedChart, LabelList, Legend, Line, Tooltip, XAxis, YAxis } from 'recharts';
import { AutoSizer } from '../../components/charts/AutoSizer';
import { ChartTooltip } from '../../components/charts/ChartTooltip';
import { ADMIN_PATH } from '../../components/layout/pages';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { Kpi } from '../../components/ui/Kpi';
import { ErrorBanner, Loading } from '../../components/ui/States';
import { Visual } from '../../components/ui/Visual';
import { useSession } from '../../context/SessionContext';
import { useTheme } from '../../context/ThemeContext';
import { useReport } from '../../hooks/useReport';
import type { ProductivityMonth, ProductivityPerson } from '../../services/types';
import { dec1, int, signedPct } from '../../utils/format';

const NO_FILTERS = {};

function ProductivityChart({ months, values }: { months: { key: string; label: string }[]; values: ProductivityMonth[] }) {
  const { colors } = useTheme();
  const rows = months.map((m, i) => ({ key: m.key, label: m.label, packings: values[i]?.packings ?? 0, patrimonies: values[i]?.patrimonies ?? 0 }));
  return (
    <AutoSizer>
      {({ width, height }) => (
        <ComposedChart width={width} height={height} data={rows} margin={{ top: 24, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="4 4" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fontWeight: 700, fill: colors.ink }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="rom" hide domain={[0, (d: number) => d * 1.25]} />
          <YAxis yAxisId="pat" orientation="right" hide domain={[0, (d: number) => d * 1.15]} />
          <Tooltip cursor={{ fill: colors.cursor }} content={<ChartTooltip />} />
          <Legend verticalAlign="bottom" height={22} iconType="circle" wrapperStyle={{ fontSize: 11.5, fontWeight: 600 }} />
          <Bar yAxisId="rom" dataKey="packings" name="Romaneios" fill={colors.gold} maxBarSize={90} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            <LabelList dataKey="packings" position="insideTop" fill={colors.ink} fontSize={12} fontWeight={700} formatter={(v: number) => int(v)} />
          </Bar>
          <Line yAxisId="pat" dataKey="patrimonies" name="Patrimônios" stroke={colors.orange} strokeWidth={2.5} dot={{ r: 5, fill: colors.orange }} isAnimationActive={false}>
            <LabelList dataKey="patrimonies" position="top" offset={10} fill={colors.ink} fontSize={12} fontWeight={800} formatter={(v: number) => int(v)} />
          </Line>
        </ComposedChart>
      )}
    </AutoSizer>
  );
}

/**
 * "PRODUTIVIDADE ALMOX" (Power BI "LOG - Gerencial"): romaneios e patrimônios
 * enviados por pessoa nos dois últimos meses fechados. O Power BI tinha um
 * gráfico por pessoa e um do total; aqui o gráfico é o do total e a tabela
 * traz cada pessoa — um clique numa linha põe a pessoa no gráfico.
 */
export default function WarehouseProductivityPage() {
  const { isAdmin } = useSession();
  const { data, error, isPending } = useReport('warehouse-productivity', NO_FILTERS);
  const [selected, setSelected] = useState<string | null>(null);

  const person = data?.people.find((p) => p.name === selected) ?? null;
  const [m1, m2] = data?.months ?? [];
  const columns: Column<ProductivityPerson>[] = [
    { key: 'name', title: 'PESSOA', value: (r) => r.name, wrap: true },
    { key: 'pk1', title: `ROMANEIOS ${m1?.label ?? ''}`, value: (r) => r.months[0]?.packings ?? 0, align: 'center' },
    { key: 'pk2', title: `ROMANEIOS ${m2?.label ?? ''}`, value: (r) => r.months[1]?.packings ?? 0, align: 'center' },
    { key: 'pkc', title: 'VARIAÇÃO', value: (r) => r.packingsChange, render: (r) => signedPct(r.packingsChange), align: 'center' },
    { key: 'pt1', title: `PATRIMÔNIOS ${m1?.label ?? ''}`, value: (r) => r.months[0]?.patrimonies ?? 0, align: 'center' },
    { key: 'pt2', title: `PATRIMÔNIOS ${m2?.label ?? ''}`, value: (r) => r.months[1]?.patrimonies ?? 0, align: 'center' },
    { key: 'ptc', title: 'VARIAÇÃO', value: (r) => r.patrimoniesChange, render: (r) => signedPct(r.patrimoniesChange), align: 'center' },
    { key: 'apk', title: 'MÉDIA ROMANEIOS', value: (r) => r.averagePackings, render: (r) => dec1(r.averagePackings), align: 'center' },
    { key: 'apt', title: 'MÉDIA PATRIMÔNIOS', value: (r) => r.averagePatrimonies, render: (r) => dec1(r.averagePatrimonies), align: 'center' },
  ];

  return (
    <main className="page sem-filtros">
      {error && <ErrorBanner error={error} />}
      {isPending && !data && <Loading text="Carregando a produtividade do almoxarifado…" />}
      {data && (
        <>
          <p className="ger-intro">
            Romaneios (descrições <b>distintas</b> da ocorrência "Enviado em Romaneio") e patrimônios enviados por quem
            lançou, nos dois últimos meses <b>fechados</b>. Entram só as pessoas da lista
            {isAdmin ? <> — edite em <Link to={ADMIN_PATH}>Administração</Link></> : ' definida pelos administradores'}.
          </p>
          <div className="grid linha-70-25">
            <Visual
              title={person ? `Produtividade · ${person.name}` : 'Produtividade · total'}
              subtitle={person ? 'clique de novo na linha para voltar ao total' : `${data.people.length} pessoas da lista · romaneios distintos entre as pessoas`}
            >
              <ProductivityChart months={data.months} values={person ? person.months : data.total.months} />
            </Visual>
            <div className="col-kpi">
              <Kpi value={signedPct(person ? person.packingsChange : data.total.packingsChange)} label="Variação romaneios" description={`${m2?.label ?? ''} × ${m1?.label ?? ''}`} />
              <Kpi value={signedPct(person ? person.patrimoniesChange : data.total.patrimoniesChange)} label="Variação patrimônios" description={`${m2?.label ?? ''} × ${m1?.label ?? ''}`} />
              <Kpi
                value={dec1(person ? person.averagePackings : data.total.averagePackingsPerPerson)}
                label="Média de romaneios"
                description={person ? 'por mês, nos dois meses' : 'por pessoa e mês (quem enviou no mês)'}
              />
              <Kpi
                value={dec1(person ? person.averagePatrimonies : data.total.averagePatrimoniesPerPerson)}
                label="Média de patrimônios"
                description={person ? 'por mês, nos dois meses' : 'por pessoa e mês (quem enviou no mês)'}
              />
            </div>
          </div>
          <Visual title="Por pessoa" subtitle="ordem: patrimônios no último mês · clique para ver a pessoa no gráfico" className="v-tabela" flush>
            <DataTable
              columns={columns}
              rows={data.people}
              rowKey={(r) => r.name}
              onRowClick={(r) => setSelected((s) => (s === r.name ? null : r.name))}
              isSelected={(r) => r.name === selected}
              footer={{
                name: 'Total',
                pk1: int(data.total.months[0]?.packings),
                pk2: int(data.total.months[1]?.packings),
                pkc: signedPct(data.total.packingsChange),
                pt1: int(data.total.months[0]?.patrimonies),
                pt2: int(data.total.months[1]?.patrimonies),
                ptc: signedPct(data.total.patrimoniesChange),
                apk: dec1(data.total.averagePackingsPerPerson),
                apt: dec1(data.total.averagePatrimoniesPerPerson),
              }}
            />
          </Visual>
        </>
      )}
    </main>
  );
}
