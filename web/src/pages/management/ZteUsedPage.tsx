import { ManagementComparisonPage } from '../../components/management/ManagementComparisonPage';

/** "ZTE - USADOS" (Power BI "LOG - Gerencial"): voltas do laboratório por origem. */
export default function ZteUsedPage() {
  return (
    <ManagementComparisonPage
      report="zte-used"
      loadingText="Carregando os ZTE usados…"
      intro={<>Voltas das ONUs ZTE do laboratório ao almoxarifado, pela <b>origem</b> (a passagem pelo laboratório mais recente antes da volta). Como no Power BI, o conserto interno sai dos gráficos de ano e de histórico, mas conta no cartão de variação.</>}
      notes={{ years: 'sem o conserto interno' }}
      historyNote="voltas por mês e origem, desde agosto/2024, sem o conserto interno"
    />
  );
}
