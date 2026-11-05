import { ManagementComparisonPage } from '../../components/management/ManagementComparisonPage';

/** "EQUIPAMENTOS OBSOLETOS" (Power BI "LOG - Gerencial"): seriais acumulados no depósito de rádio. */
export default function ObsoleteEquipmentPage() {
  return (
    <ManagementComparisonPage
      report="obsolete-equipment"
      loadingText="Carregando os equipamentos obsoletos…"
      intro={<>Seriais <b>distintos acumulados</b> sob <b>A. RADIO / DEPOSITO</b> até o fim de cada período, pela data da última movimentação do patrimônio.</>}
      historyNote="acumulado no fim de cada mês, nos últimos dois anos"
    />
  );
}
