import { ManagementComparisonPage } from '../../components/management/ManagementComparisonPage';

/** "MOVIMENTAÇÕES ZTE" (Power BI "LOG - Gerencial"): ONUs ZTE novas x usadas. */
export default function ZteMovementsPage() {
  return (
    <ManagementComparisonPage
      report="zte-movements"
      loadingText="Carregando as movimentações ZTE…"
      intro={<><b>Novos</b>: o primeiro romaneio de cada ONU ZTE. <b>Usados</b>: cada volta ao almoxarifado depois de passar pelo laboratório (cancelamento ou manutenção). Embaixo de cada gráfico, a participação de cada um e a diferença em pontos percentuais.</>}
      historyNote="novos e usados por mês, desde agosto/2024"
    />
  );
}
