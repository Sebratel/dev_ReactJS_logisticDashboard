import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { UrlFilters } from '../../hooks/useUrlFilters';
import type { ReportName } from '../../services/reportsService';
import type { StockAlertReport } from '../../services/types';
import { int } from '../../utils/format';
import { ExportButton } from '../ui/ExportButton';
import { Kpi } from '../ui/Kpi';
import { Banner } from '../ui/States';
import { Visual } from '../ui/Visual';
import { StockAlertTable } from './StockAlertTable';

interface StockAlertSectionProps {
  report: ReportName;
  data: StockAlertReport;
  filters: UrlFilters;
  title: string;
  /** cartões a mais na mesma faixa (a tela de patrimônios soma disponíveis e pendentes) */
  extraKpis?: ReactNode;
}

/**
 * Cartões de itens em alerta / no mínimo + a tabela de alerta. Compartilhado
 * pelas telas de produtos e de patrimônios, que no relatório são a mesma
 * página com o filtro de tipo de item trocado.
 */
export function StockAlertSection({ report, data, filters, title, extraKpis }: StockAlertSectionProps) {
  return (
    <>
      {!data.stockControlAvailable && (
        <Banner>
          O <b>cadastro de controle de estoque</b> está vazio ou não pôde ser lido: categoria, alerta, mínimo, lead time,
          comprador e processo externo ficam em branco, e o status considera mínimo zero. A tabela mostra todo o saldo do Voalle
          até o cadastro voltar — veja em <Link to="/configuracoes/controle-estoque">Configuração · Controle de estoque</Link>.
        </Banner>
      )}
      <div className="kpi-faixa">
        <Kpi tone="alerta" value={int(data.kpis.alertItems)} label="Itens em alerta" description="saldo acima do mínimo e até o alerta do cadastro" />
        <Kpi tone="minimo" value={int(data.kpis.minimumItems)} label="Itens no mínimo" description="saldo igual ou abaixo do mínimo do cadastro" />
        {extraKpis}
      </div>
      <Visual
        title={title}
        subtitle={data.table.truncated ? `${int(data.table.rows.length)} de ${int(data.table.total)} linhas na tela — o CSV leva todas` : `${int(data.table.total)} linhas`}
        className="v-tabela"
        flush
        actions={<ExportButton report={report} table="detail" query={filters.query} />}
      >
        <StockAlertTable rows={data.table.rows} total={data.table.total} />
      </Visual>
    </>
  );
}
