import { StatusDonut } from '../../components/charts/StatusDonut';
import { FilterBar, type FilterField } from '../../components/filters/FilterBar';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { MatrixTable } from '../../components/tables/MatrixTable';
import { ExportButton } from '../../components/ui/ExportButton';
import { ErrorBanner, Loading } from '../../components/ui/States';
import { Visual } from '../../components/ui/Visual';
import { useTheme } from '../../context/ThemeContext';
import { useDefaultFilters } from '../../hooks/useDefaultFilters';
import { useReport } from '../../hooks/useReport';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import type { FieldEquipmentDetailRow } from '../../services/types';
import { int, labelDate } from '../../utils/format';

/** O slicer "DATA DE ENVIO" (ano > mês > dia) e o "EQUIPAMENTOS" do relatório. */
const FIELDS: FilterField[] = [
  { type: 'list', key: 'year', label: 'Ano' },
  { type: 'list', key: 'month', label: 'Mês' },
  { type: 'period', label: 'Data de envio' },
  { type: 'list', key: 'equipment', label: 'Equipamento' },
];

const detailColumns = (descriptionTitle: string): Column<FieldEquipmentDetailRow>[] => [
  { key: 'count', title: 'QTD.', value: (r) => r.count, align: 'center' },
  { key: 'date', title: 'DATA', value: (r) => r.date, render: (r) => labelDate(r.date), align: 'center' },
  { key: 'equipment', title: 'EQUIPAMENTO', value: (r) => r.equipment, wrap: true },
  { key: 'description', title: descriptionTitle, value: (r) => r.description, wrap: true },
];
const NEW_COLUMNS = detailColumns('DESCRIÇÃO MOVIMENTAÇÃO');
const USED_COLUMNS = detailColumns('DESCRIÇÃO OCORRÊNCIA');

const shown = (rows: number, total: number) => (rows < total
  ? `${int(rows)} de ${int(total)} linhas na tela — o CSV leva todas`
  : `${int(total)} linhas`);

/**
 * "CTR - MOVIMENTAÇÃO EQUIPAMENTOS PARA CAMPO": ONUs e roteadores enviados a
 * campo — NOVOS (primeiro romaneio do patrimônio) e USADOS (saída do
 * almoxarifado depois do laboratório). Dados da carga horária.
 *
 * Como no Power BI, a tela abre no ano corrente (o relatório salvava o filtro
 * de data em 2026). Limpar o filtro mostra todos os anos.
 */
export default function FieldEquipmentPage() {
  const filters = useUrlFilters();
  const { colors } = useTheme();
  // entrada sem filtro (aba ou capa): ano corrente marcado antes da primeira consulta
  const pendingDefault = useDefaultFilters(filters, { year: String(new Date().getFullYear()) });
  const { data, error, isPending } = useReport('field-equipment', filters.query, { enabled: !pendingDefault });

  return (
    <main className="page">
      <FilterBar fields={FIELDS} filters={filters} options={data?.options} />
      {error && <ErrorBanner error={error} />}
      {(pendingDefault || (isPending && !data)) && <Loading text="Carregando a movimentação de equipamentos…" />}
      {data && (
        <>
          <div className="grid linha-ctr-topo">
            <Visual title="Qtd. equipamentos enviados a campo" subtitle="ano > mês > dia · + abre o nível" className="v-tabela" flush>
              <MatrixTable matrix={data.byDate} rowHeader="ANO / MÊS / DIA" totalHeader="TOTAL EQUIPAMENTOS" />
            </Visual>
            <Visual title="Qtd. novos x usados" className="v-tabela">
              <StatusDonut data={data.pie} colorOf={(k) => (k === 'Novos' ? colors.primary : colors.gold)} />
            </Visual>
            <Visual title="Qtd. equipamentos enviados a campo · por tipo" subtitle="ano > modelo" className="v-tabela" flush>
              <MatrixTable matrix={data.byType} rowHeader="ANO / PATRIMÔNIOS" totalHeader="TOTAL EQUIPAMENTOS" />
            </Visual>
          </div>

          <Visual title="Equipamentos novos enviados a campo" subtitle="por modelo e mês · mais enviados primeiro" className="v-tabela-baixa" flush>
            <MatrixTable matrix={data.newByMonth} rowHeader="MODELO" />
          </Visual>
          <Visual
            title="Equipamentos usados enviados a campo"
            subtitle="por modelo e romaneio, por mês · 7 modelos, como no relatório original (sem o F670L RE3023 e o mesh H3601PE)"
            className="v-tabela-baixa"
            flush
          >
            <MatrixTable matrix={data.usedByMonth} rowHeader="MODELO / OCORRÊNCIA" />
          </Visual>
          <Visual title="Relatório movimentações equipamentos novos · dia a dia" subtitle="mês > modelo, por dia do mês" className="v-tabela" flush>
            <MatrixTable matrix={data.newDaily} rowHeader="MÊS / MODELO" />
          </Visual>
          <Visual
            title="Relatório movimentações equipamentos usados · dia a dia"
            subtitle="mês > modelo > ocorrência, por dia do mês · 7 modelos, como no relatório original"
            className="v-tabela"
            flush
          >
            <MatrixTable matrix={data.usedDaily} rowHeader="MÊS / MODELO / OCORRÊNCIA" />
          </Visual>

          <div className="grid linha-50-50">
            <Visual
              title="Relatório detalhado · romaneios de equipamentos novos"
              subtitle={shown(data.newDetail.rows.length, data.newDetail.total)}
              className="v-tabela"
              flush
              actions={<ExportButton report="field-equipment" table="new-detail" query={filters.query} />}
            >
              <DataTable
                columns={NEW_COLUMNS}
                rows={data.newDetail.rows}
                total={data.newDetail.total}
                rowKey={(r, i) => `${r.date}|${r.equipment}|${i}`}
                footer={{ count: int(data.newDetail.totals.count), date: 'Total' }}
              />
            </Visual>
            <Visual
              title="Relatório detalhado · romaneios de equipamentos usados"
              subtitle={shown(data.usedDetail.rows.length, data.usedDetail.total)}
              className="v-tabela"
              flush
              actions={<ExportButton report="field-equipment" table="used-detail" query={filters.query} />}
            >
              <DataTable
                columns={USED_COLUMNS}
                rows={data.usedDetail.rows}
                total={data.usedDetail.total}
                rowKey={(r, i) => `${r.date}|${r.equipment}|${i}`}
                footer={{ count: int(data.usedDetail.totals.count), date: 'Total' }}
              />
            </Visual>
          </div>
        </>
      )}
    </main>
  );
}
