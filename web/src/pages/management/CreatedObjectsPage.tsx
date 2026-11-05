import { ManagementComparisonPage } from '../../components/management/ManagementComparisonPage';

/** "OBJETOS CRIADOS" (Power BI "LOG - Gerencial"): patrimônios criados no Voalle. */
export default function CreatedObjectsPage() {
  return (
    <ManagementComparisonPage
      report="created-objects"
      loadingText="Carregando os objetos criados…"
      intro={<>Patrimônios criados no Voalle (a ocorrência <b>Criação do Objeto</b>). Mês e trimestre são os últimos <b>fechados</b>; o ano corrente vai até hoje.</>}
      historyNote="objetos criados por mês, desde agosto/2024"
    />
  );
}
