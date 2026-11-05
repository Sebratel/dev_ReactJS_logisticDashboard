import { ManagementComparisonPage } from '../../components/management/ManagementComparisonPage';

/** "CONSUMO DE FLAT" (Power BI "LOG - Gerencial"): metros do cabo flat entregues pelo almoxarifado. */
export default function FlatConsumptionPage() {
  return (
    <ManagementComparisonPage
      report="flat-consumption"
      loadingText="Carregando o consumo de flat…"
      intro={<>Metros do <b>cabo flat (00069)</b> entregues pela equipe do almoxarifado, sem almoxarifados, ferramentas, sucata e RMA como recebedor. Como no Power BI, a entrega conta uma vez para cada equipe de quem recebeu.</>}
      historyNote="metros por mês, desde agosto/2024"
    />
  );
}
