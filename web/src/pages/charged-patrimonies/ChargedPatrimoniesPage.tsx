import { ChargedOverview } from '../../components/charged/ChargedOverview';
import { FilterBar, type FilterField } from '../../components/filters/FilterBar';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { ExportButton } from '../../components/ui/ExportButton';
import { ErrorBanner, Loading } from '../../components/ui/States';
import { Visual } from '../../components/ui/Visual';
import { useDefaultFilters } from '../../hooks/useDefaultFilters';
import { useReport } from '../../hooks/useReport';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import type { ChargedPatrimonyRow } from '../../services/types';
import { brl, int, labelDate } from '../../utils/format';

/** Os slicers da página "SALDO PATRIMÔNIO", na ordem do relatório. */
const FIELDS: FilterField[] = [
  { type: 'list', key: 'base', label: 'Base' },
  { type: 'list', key: 'description', label: 'Descrição' },
  { type: 'list', key: 'holder', label: 'Responsável' },
  // "ATIVO?" do Power BI: o responsável é usuário ativo do Voalle
  { type: 'list', key: 'active', label: 'Colaborador ativo?' },
  { type: 'list', key: 'productCode', label: 'Código' },
  // cadastro do patrimônio no Voalle (p.active / p.deleted)
  { type: 'list', key: 'itemActive', label: 'Patrimônio ativo?' },
  { type: 'list', key: 'itemDeleted', label: 'Patrimônio deletado?' },
];

const DETAIL_COLUMNS: Column<ChargedPatrimonyRow>[] = [
  { key: 'holder', title: 'TÉCNICO', value: (r) => r.holder, wrap: true },
  { key: 'base', title: 'BASE', value: (r) => r.base },
  { key: 'productCode', title: 'CÓD.PRODUTO', value: (r) => r.productCode, align: 'center' },
  { key: 'description', title: 'DESCRIÇÃO', value: (r) => r.description, wrap: true },
  { key: 'serialNumber', title: 'SERIAL', value: (r) => r.serialNumber },
  { key: 'patrimonyTag', title: 'PATRIMÔNIO', value: (r) => r.patrimonyTag, align: 'center' },
  { key: 'movedAt', title: 'DATA', value: (r) => r.movedAt, render: (r) => labelDate(r.movedAt), align: 'center' },
  { key: 'days', title: 'TEMPO (DIAS)', value: (r) => r.days, align: 'center' },
  { key: 'value', title: 'VALOR DO ITEM', value: (r) => r.value, render: (r) => brl(r.value), align: 'center' },
];

/**
 * "LOG - OBJETOS EM CARGA" · SALDO PATRIMÔNIO: os patrimônios que estão com
 * cada pessoa da empresa — quantidade (patrimônios distintos), valor de compra
 * (uma vez por patrimônio) e há quantos dias foi a última movimentação.
 *
 * Abre SEM os patrimônios deletados no Voalle ("Patrimônio deletado? = Não",
 * decisão da área em 05/11/2026): a consulta os traz com o responsável que
 * ficou no cadastro (~6 mil, R$ 1,65 mi). O filtro continua trocável.
 */
export default function ChargedPatrimoniesPage() {
  const filters = useUrlFilters();
  // entrada sem filtro (aba ou capa): sem os deletados desde a primeira consulta
  const pendingDefault = useDefaultFilters(filters, { itemDeleted: 'Não' });
  const { data, error, isPending } = useReport('charged-patrimonies', filters.query, { enabled: !pendingDefault });

  return (
    <main className="page">
      <FilterBar fields={FIELDS} filters={filters} options={data?.options} />
      {error && <ErrorBanner error={error} />}
      {(pendingDefault || (isPending && !data)) && <Loading text="Carregando os patrimônios em carga…" />}
      {data && (
        <>
          <ChargedOverview
            filters={filters}
            byHolder={data.byHolder}
            kpis={data.kpis}
            byBase={data.byBase}
            quantityMeaning="patrimônios distintos"
            baseValueLabel="PATRIMÔNIOS"
            valueMeaning="valor de compra, uma vez por patrimônio"
          />
          <Visual
            title="Visão geral"
            subtitle={data.detail.truncated
              ? `${int(data.detail.rows.length)} de ${int(data.detail.total)} patrimônios na tela — o CSV leva todos`
              : `${int(data.detail.total)} patrimônios · tempo = dias desde a última movimentação`}
            className="v-tabela"
            flush
            actions={<ExportButton report="charged-patrimonies" table="detail" query={filters.query} />}
          >
            <DataTable
              columns={DETAIL_COLUMNS}
              rows={data.detail.rows}
              total={data.detail.total}
              rowKey={(r, i) => `${r.patrimonyTag ?? '-'}|${r.serialNumber ?? '-'}|${i}`}
            />
          </Visual>
        </>
      )}
    </main>
  );
}
