/**
 * Um item do cadastro de controle de estoque — o que antes era uma linha da
 * planilha "Controle Estoque". A chave de negócio é código + base de origem
 * (a CHAVE_PRODUTO_BASE do Power BI): o mesmo produto tem limites próprios em
 * cada base.
 */
export interface StockControlEntity {
  id: string;
  /** código do produto no Voalle, como inteiro ("05601" -> 5601) */
  code: number;
  /** SITUAÇÃO na planilha; nas telas, CATEGORIA */
  category: string;
  /** descrição livre do item (a tela de alerta mostra a descrição do Voalle) */
  item: string | null;
  baseName: string;
  /** ALERTA ESTOQUE: até este saldo o item fica em ALERTA */
  alertLevel: number;
  /** ESTOQUE MÍNIMO: até este saldo o item fica no MÍNIMO */
  minimumLevel: number;
  /** COMPRADOR RESPONSÁVEL */
  buyer: string | null;
  leadTimeDays: number | null;
  externalProcess: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}
