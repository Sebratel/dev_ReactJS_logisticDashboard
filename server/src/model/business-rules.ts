/**
 * Regras de negócio que no Power BI estavam espalhadas em filtros de página,
 * filtros de visual, colunas DAX e listas escritas dentro das consultas.
 *
 * Ficam num lugar só porque são a parte do relatório que MUDA: entra um
 * almoxarife novo, chega um cabo novo, uma conta interna passa a receber
 * romaneio. Quem for ajustar não precisa caçar o valor em sete arquivos.
 */

/**
 * Time do almoxarifado que gera romaneios (o "FORNECEDOR").
 * Era a lista `p2.name IN (...)` / `u.name IN (...)` das duas consultas de
 * romaneio — ver o cabeçalho de `product_packing_lists.sql` sobre a vírgula que
 * faltava entre RAONI e SAMUEL no Power BI.
 */
export const WAREHOUSE_SUPPLIERS = [
  'ADRIANO ALEXANDRE CRUZ',
  'ALEX RAIMUNDO RODRIGUES',
  'ALEXANDRE DA SILVA MACIEL',
  'BRIAN EDUARDO DOS SANTOS',
  'CLOVIS SANTOS DA SILVEIRA',
  'GABRIEL LINHARES',
  'GERMANO DE PAULA',
  'JESSICA ROCHA MEIRELES',
  'JOAO PEDRO DOS SANTOS MARTINS',
  'JOÃO PEDRO MACIEL JUNG',
  'RAONI SILVA DA SILVA',
  'SAMUEL FIGUEIRA DUTRA',
  'VITOR SARAIVA SILVEIRA',
] as const;

/** Filtro visual da tabela "HISTÓRICO DE ROMANEIOS" (alerta de patrimônios): quem registrou. */
export const PACKING_NOTES_RESPONSIBLES = [
  'ADRIANO ALEXANDRE CRUZ',
  'ALEX RAIMUNDO RODRIGUES',
  'ALEXANDRE DA SILVA MACIEL',
  'CLOVIS SANTOS DA SILVEIRA',
  'GABRIEL LINHARES',
  'GERMANO DE PAULA',
  'JESSICA ROCHA MEIRELES',
  'JOAO PEDRO DOS SANTOS MARTINS',
  'JOÃO PEDRO MACIEL JUNG',
  'RAONI SILVA DA SILVA',
  'SAMUEL FIGUEIRA DUTRA',
] as const;

/**
 * Filtro visual da mesma tabela: recebedores que são contas internas ou o
 * próprio almoxarifado — movimentação entre estoques, não romaneio para técnico.
 * Os nomes vêm do texto da ocorrência, por isso existem com e sem ponto final.
 */
export const PACKING_NOTES_EXCLUDED_RECEIVERS = [
  "A. FERRAMENTAS  E  EPI'S  -  CANOAS.",
  "A. FERRAMENTAS  E  EPI'S  -  POA.",
  'A. FERRAMENTAS E EPI´S - SÃO LEO.',
  'A. FERRAMENTAS E EPI´S.',
  'A. RADIO / DEPOSITO.',
  'A.ALMOXARIFADO / CANOAS.',
  'A.ALMOXARIFADO / SÃO LEO.',
  'A.ALMOXARIFADO / SEDE PORTO ALEGRE.',
  'ADRIANO ALEXANDRE CRUZ',
  'ALEX RAIMUNDO RODRIGUES',
  'ALEX RAIMUNDO RODRIGUES.',
  'ALEXANDRE DA SILVA MACIEL',
  'ALEXANDRE DA SILVA MACIEL.',
  'ATIVOS - ADMINISTRATIVO - CANOAS.',
  'EQUIPAMENTOS MANUTENÇÃO / INFRAESTRUTURA.',
  'EQUIPAMENTOS PENDENTES / SEM LOCALIZAÇÃO.',
  'ESTOQUE - SUCATA.',
  'GABRIEL LINHARES',
  'GABRIEL LINHARES.',
  'GERMANO DE PAULA',
  'GERMANO DE PAULA.',
  'JESSICA ROCHA MEIRELES',
  'JESSICA ROCHA MEIRELES.',
  'JOAO PEDRO DOS SANTOS MARTINS',
  'JOAO PEDRO DOS SANTOS MARTINS.',
  'JOÃO PEDRO MACIEL JUNG',
  'JOÃO PEDRO MACIEL JUNG.',
  'PATRIMÔNIOS PENDENTES.',
  'PRODUTOS PENDENTES.',
  'RAONI SILVA',
  'RAONI SILVA DA SILVA.',
  'RMA.',
  'SAMUEL FERREIRA.',
  'SAMUEL FIGUEIRA DUTRA',
] as const;

/** Filtro de página de "PRODUTOS & CABOS - ALOCAÇÃO": contas que não são técnicos de campo. */
export const PRODUCT_ALLOCATION_EXCLUDED_TECHNICIANS = [
  "A. FERRAMENTAS  E  EPI'S  -  CANOAS",
  "A. FERRAMENTAS  E  EPI'S  -  POA",
  'A. FERRAMENTAS E EPI´S - SÃO LEO',
  'A.ALMOXARIFADO / CANOAS',
  'A.ALMOXARIFADO / SÃO LEO',
  'A.ALMOXARIFADO / SEDE PORTO ALEGRE',
  'ALEXANDRE DA SILVA MACIEL',
  'ATIVOS - ALMOXARIFADO - CANOAS',
  'ATIVOS - ALMOXARIFADO - SÃO LEOPOLDO',
  'ATIVOS - SEGUNDO ANDAR - SÃO LEOPOLDO',
  'CLOVIS SANTOS DA SILVEIRA',
  'CONSERTO INTERNO / LABORATÓRIO CANOAS',
  'GABRIEL LINHARES',
  'GERMANO DE PAULA',
  'JESSICA ROCHA MEIRELES',
  'JOAO PEDRO DOS SANTOS MARTINS',
  'RAONI SILVA DA SILVA',
] as const;

/** Filtro de página de "PRODUTOS & CABOS - ROMANEIO": recebedores que não são técnicos. */
export const PRODUCT_PACKING_EXCLUDED_RECEIVERS = [
  'A. RADIO / DEPOSITO',
  'ALEX RAIMUNDO RODRIGUES',
  'ALEXANDRE DA SILVA MACIEL',
  'ATIVOS - ADMINISTRATIVO - SEDE PORTO ALEGRE',
  'ATIVOS - ALMOXARIFADO - CANOAS',
  'ATIVOS - ALMOXARIFADO - SÃO LEOPOLDO',
  'ATIVOS - LABORATORIO - SÃO LEOPOLDO',
  'CLOVIS ALESSANDRO DA SILVA',
  'ESTOQUE - SUCATA',
  'GABRIEL LINHARES',
  'GERMANO DE PAULA',
  'JESSICA ROCHA MEIRELES',
  'JOAO PEDRO DOS SANTOS MARTINS',
  'PATRIMÔNIOS PENDENTES',
  'PRODUTOS PENDENTES',
  'RAONI SILVA DA SILVA',
] as const;

/**
 * Os cabos (fibra e drop) que as telas separam dos demais produtos.
 *
 * É lista FECHADA de propósito: o Voalle tem ~200 itens cujo nome começa com
 * "CABO" (cabo de força, HDMI, cabo de vassoura...) que não são cabo de rede.
 * No Power BI cada visual tinha a sua cópia, com pequenas diferenças (17 a 19
 * itens); aqui vale a união das cópias para as duas telas contarem igual.
 * Cabo novo comprado precisa entrar aqui — como precisava entrar lá.
 */
export const CABLE_PRODUCTS = [
  'CABO CFOA-SM-ASU80-12-NR CABLENA',
  'CABO CFOA-SM-DROP-FIG8-6FO-COG CABLENA',
  'CABO DE FIBRA DROP FLATH 1FO',
  'CABO DROP FIG 8 2 FO FURUKAWA',
  'CABO OPTICO CFOA-SM-AS200-S 48F G-652D TS NR (ABNT CL)',
  'CABO ÓPTICO CFOA-SM-AS80 MINI-RA 06F G-652D NR (FURUKAWA)',
  'CABO ÓPTICO CFOA-SM-AS80 MINI-RA 12F G-652D NR (FURUKAWA)',
  'CABO OPTICO CFOA-SM-AS-80- S-RA-012-NR UNICA (ZTT)',
  'CABO OPTICO CFOA-SM-AS80-S 144F G-652D  (ABNT CL) (FURUKAWA)',
  'CABO OPTICO CFOA-SM-AS80-S 144F G652-D TS CT NR (ABNT CL) - FURUKAWA/ TOTALMENTE SECO - COMPACTO',
  'CABO ÓPTICO CFOA-SM-AS80-S 24F G-652D NR CT (ABNT CL) (FURUKAWA)',
  'CABO OPTICO CFOA-SM-AS80-S 24F G-652D TS NR CT (FURUKAWA)/ TOTALMENTE SECO - COMPACTO',
  'CABO ÓPTICO CFOA-SM-AS80-S 36F G-652D NR CT (ABNT CL) (FURUKAWA)',
  'CABO OPTICO CFOA-SM-AS80-S 36F G-652D TS NR CT (FURUKAWA)/ TOTALMENTE SECO - COMPACTO',
  'CABO ÓPTICO CFOA-SM-AS80-S 48F G-652D NR CT (ABNT CL) (FURUKAWA)',
  'CABO OPTICO CFOA-SM-AS80-S 48F G-652D TS NR CT (FURUKAWA)/ TOTALMENTE SECO - COMPACTO',
  'CABO OPTICO CFOA-SM-AS80-S 72F G-652D NR CT (ABNT CL) (FURUKAWA)',
  'CABO OPTICO CFOA-SM-AS80-S 72F G-652D TS NR CT (FURUKAWA)/ TOTALMENTE SECO - COMPACTO',
  'CABO OPTICO DROP FIG. 8 FTTH SM 04F COG PR (FURUKAWA)',
] as const;

/** Coluna DAX `BaseGrupo` de "Consumo Produtos": região do protocolo -> base. */
export const REGION_BASE_GROUPS: Record<string, readonly string[]> = {
  'BASE SLE': [
    '✅Base São Leopoldo (Ativação)',
    '✅Base São Leopoldo (Manutenção)',
    'Estância Velha (EV)',
    'Novo Hamburgo (NHO)',
    'São Leopoldo (Manutenção),',
    'São Leopoldo (SLE)',
    '✅Sapucaia do Sul (Manutenção)',
    'Brochier (BCR)',
    'Sapucaia do Sul (SPS)',
    'São Leopoldo (Manutenção).',
  ],
  'BASE CAN': [
    '✅Base Canoas (Ativação)',
    '✅Base Canoas (Manutenção)',
    'Canoas (CAN)',
    'Esteio (EIO)',
    'Nova Santa Rita (NSR)',
    'Porto Alegre (POA)',
    'Triunfo (TNF)',
  ],
};
export const OTHER_BASE_GROUP = 'OUTROS';

/** As bases operacionais que têm controle de estoque (cadastro de controle de estoque). */
export const OPERATIONAL_BASES = [
  'BASE OPERACIONAL - CANOAS',
  'BASE OPERACIONAL - SÃO LEOPOLDO',
  'SEDE - PORTO ALEGRE',
] as const;
export type OperationalBase = (typeof OPERATIONAL_BASES)[number];

/** Coluna DAX `Sigla Base` de "Saldo Voalle". */
export const BASE_ACRONYMS: Record<string, string> = {
  'BASE OPERACIONAL - CANOAS': 'CAN',
  'BASE OPERACIONAL - SÃO LEOPOLDO': 'SLE',
  'SEDE - PORTO ALEGRE': 'PAE',
};

/** Status de estoque (coluna DAX STATUS2). */
export const STOCK_STATUS = {
  MINIMUM: 'MÍNIMO',
  ALERT: 'ALERTA',
  ABOVE: 'ACIMA',
} as const;
export type StockStatus = (typeof STOCK_STATUS)[keyof typeof STOCK_STATUS];

/** Status de pedido de compra trazido pela consulta "Pedidos Compra". */
export const PURCHASE_STATUS_AWAITING = 'Aguardando Entrega';

/**
 * Nome do status do pedido de aquisição (Voalle `status`), como o Power BI
 * "CMP - Lançamento e Saldos" trocava no Power Query. Código fora da lista
 * aparece como o próprio número — igual ao Power BI.
 */
export const PURCHASE_ORDER_STATUS: Record<number, string> = {
  1: 'Inclusão',
  2: 'Cancelado',
  4: 'Aguardando Entrega',
  5: 'Recebido',
};

/**
 * Modelos de equipamento acompanhados na tela "Equipamentos para campo"
 * (Power BI "CTR - Movimentação Equipamentos para Campo"): a lista "IN" das
 * consultas PRIMEIRO VÍNCULO e ÚLTIMO VÍNCULO. Modelo novo entra aqui.
 */
export const FIELD_EQUIPMENT_MODELS = [
  'ONU GPON WIFI ZTE F670L AC1200 2 ANTENAS V1.1 - RE907',
  'ONU GPON WIFI ZTE F670L AC1200 2 ANTENAS V9.0 - RE947',
  'ONU GPON WIFI ZTE F670L AC1200 2 ANTENAS V9.0 - RE3023',
  'ONU GPON WIFI 6 ZTE F6600P AX3000 4 ANTENAS V9.0 P0625',
  'ROTEADOR WIFI 6 ZTE MESH AX3000 H3601PE 5 ANTENAS',
  'ROTEADOR WIFI ZTE PRO MESH AC1200 H198A 2 ANTENAS - RE914',
  'ROTEADOR WIFI ZTE PRO MESH AC1200 H199A 4 ANTENAS - RE942',
  'ONU GPON WIFI ZTE F680 AC2000 6 ANTENAS V6.0 - RE913',
  'ONU GPON WIFI 6 ZTE F6600P AX3000 4 ANTENAS V9.0',
] as const;

/**
 * Filtro dos dois visuais de USADOS por mês e dia a dia ("Equipamentos Usados
 * enviados a campo" e "Relatório Movimentações Equipamentos Usados - Dia a
 * Dia"): 7 dos 9 modelos — ficam de fora o F670L RE3023 e o mesh H3601PE.
 * Os outros visuais de usados (pizza, tabelas por data e por tipo, detalhe)
 * mostram os 9.
 */
export const USED_EQUIPMENT_MATRIX_MODELS: readonly string[] = [
  'ONU GPON WIFI 6 ZTE F6600P AX3000 4 ANTENAS V9.0',
  'ONU GPON WIFI 6 ZTE F6600P AX3000 4 ANTENAS V9.0 P0625',
  'ONU GPON WIFI ZTE F670L AC1200 2 ANTENAS V1.1 - RE907',
  'ONU GPON WIFI ZTE F670L AC1200 2 ANTENAS V9.0 - RE947',
  'ONU GPON WIFI ZTE F680 AC2000 6 ANTENAS V6.0 - RE913',
  'ROTEADOR WIFI ZTE PRO MESH AC1200 H198A 2 ANTENAS - RE914',
  'ROTEADOR WIFI ZTE PRO MESH AC1200 H199A 4 ANTENAS - RE942',
];

/**
 * Base do responsável pela CIDADE dele (coluna DAX BASE2 do Power BI "LOG -
 * Objetos em Carga"). O relatório também usava uma planilha de equipes; por
 * decisão da área (04/11/2026) as telas "em carga" mostram todo mundo e a base
 * sai só desta regra.
 */
export const HOLDER_CITY_BASES: readonly { base: string; cities: readonly string[] }[] = [
  { base: 'SÃO LEO/SPS/NHO', cities: ['São Leopoldo', 'Sapucaia do Sul', 'Novo Hamburgo'] },
  { base: 'EIO/CANOAS/POA', cities: ['Esteio', 'Canoas', 'Porto Alegre'] },
];
export const OTHER_HOLDER_BASE = 'OUTROS';

/** Sim/Não dos campos booleanos do produto (Power Query: 1 -> "Sim", 0 -> "Não"). */
export const YES = 'Sim';
export const NO = 'Não';
/** O "deletado" do pedido virava "Deletado"/"Não" no Power Query. */
export const ORDER_DELETED = 'Deletado';

/** Status geral do patrimônio (coluna DAX `Status`). */
export const PATRIMONY_AVAILABLE = 'Disponível';
export const PATRIMONY_UNAVAILABLE = 'Indisponível';

export const ITEM_TYPE = { PRODUCT: 'PRODUCT', PATRIMONY: 'PATRIMONY' } as const;
export type ItemType = (typeof ITEM_TYPE)[keyof typeof ITEM_TYPE];

// ------------------------------------------------------------------ gerencial
// Regras do Power BI "LOG - Gerencial" (seção Gerencial, de acesso restrito).

/** Início das consultas do relatório: objetos criados desde 2022, consumo de flat desde 2024. */
export const MANAGEMENT_SINCE = { createdObjects: '2022-01-01', flatConsumption: '2024-01-01' } as const;

/** Os gráficos "HISTÓRICO" começam em agosto/2024 (filtro `Date > 2024-08-01` dos visuais). */
export const MANAGEMENT_HISTORY_FROM = '2024-08-02';

/** "CONSUMO DE FLAT": o cabo flat (código do produto). */
export const FLAT_PRODUCT_CODE = '00069';

/**
 * Quem entregou o flat (o "FORNECEDOR" = usuário que lançou a movimentação):
 * a lista do `Table.SelectRows` da consulta "Consumo Voalle". Não é a mesma de
 * `WAREHOUSE_SUPPLIERS` (a dos romaneios) — o Power BI tinha as duas.
 */
export const FLAT_SUPPLIERS = [
  'ADRIANO ALEXANDRE CRUZ',
  'ALEX RAIMUNDO RODRIGUES',
  'ALEXANDRE DA SILVA DUARTE',
  'ALEXANDRE DA SILVA MACIEL',
  'BRIAN EDUARDO DOS SANTOS',
  'CLOVIS SANTOS DA SILVEIRA',
  'GABRIEL LINHARES',
  'GERMANO DE PAULA',
  'JESSICA ROCHA MEIRELES',
  'JOAO PEDRO DOS SANTOS MARTINS',
  'JOÃO PEDRO MACIEL JUNG',
  'LUCAS ALVIM LOSS BATISTA',
  'RAONI SILVA DA SILVA',
  'SAMUEL FIGUEIRA DUTRA',
  'SAMUEL NORIVAL MASS',
  'VITOR SARAIVA SILVEIRA',
] as const;

/**
 * Quem recebeu e NÃO conta como consumo: a lista da consulta (almoxarifados e
 * a JESSICA) mais o filtro da página "CONSUMO DE FLAT" (ferramentas, sucata, RMA).
 */
export const FLAT_EXCLUDED_RECEIVERS = [
  'A.ALMOXARIFADO / CANOAS',
  'A.ALMOXARIFADO / SÃO LEO',
  'JESSICA ROCHA MEIRELES',
  'A. FERRAMENTAS E EPI´S - SÃO LEO',
  'ESTOQUE - SUCATA',
  'RMA',
] as const;

/** A consulta descartava as movimentações de 04/09/2025 para estes almoxarifados (ajuste de inventário). */
export const FLAT_EXCLUDED_DAY = '2025-09-04';
export const FLAT_EXCLUDED_DAY_RECEIVERS = [
  'A.ALMOXARIFADO / SÃO LEO',
  'A.ALMOXARIFADO / SEDE PORTO ALEGRE',
  'A.ALMOXARIFADO / CANOAS',
] as const;

/** "MOVIMENTAÇÕES ZTE": os modelos de ONU acompanhados (consultas PRIMEIRO e ÚLTIMO VÍNCULO). */
export const ZTE_MOVEMENT_MODELS = [
  'ONU GPON WIFI 6 ZTE F6600P AX3000 4 ANTENAS V9.0 P0625',
  'ONU GPON WIFI 6 ZTE F6600P AX3000 4 ANTENAS V9.0',
  'ONU GPON WIFI ZTE F670L AC1200 2 ANTENAS V9.0 - RE947',
  'ONU GPON WIFI ZTE F670L AC1200 2 ANTENAS V1.1 - RE907',
  'ONU GPON WIFI ZTE F680 AC2000 6 ANTENAS V6.0 - RE913',
  'ONU GPON WIFI 6 ZTE F6600 AX1800 4 ANTENAS V1.0 - RE963',
  'ONU GPON WIFI ZTE F670L AC1200 2 ANTENAS V9.0 - RE3023',
] as const;

/**
 * "ZTE - USADOS": dos modelos acima, os que também estão na lista da consulta
 * "USADOS CLASSIFICADO" (a página só mostra o que casa com ela). O RE3023
 * não está lá — no Power BI ele entra nas movimentações e fica fora desta página.
 */
export const ZTE_CLASSIFIED_MODELS: readonly string[] = ZTE_MOVEMENT_MODELS.filter((m) => !m.endsWith('RE3023'));

/** Origem do retorno do laboratório que os gráficos de ANO e HISTÓRICO tiravam (o de mês e trimestre, não). */
export const ZTE_ORIGIN_OUT_OF_SCOPE = 'CONSERTO INTERNO (fora do escopo)';

/** "EQUIPAMENTOS OBSOLETOS": patrimônios sob esta pessoa (conta do depósito de rádio). */
export const OBSOLETE_EQUIPMENT_HOLDER = 'A. RADIO / DEPOSITO';

/**
 * "PRODUTIVIDADE ALMOX": as pessoas dos gráficos do Power BI. É só o valor
 * inicial — a lista é editável na tela de Administração (`productivity-staff`).
 */
export const DEFAULT_PRODUCTIVITY_STAFF = [
  'ADRIANO ALEXANDRE CRUZ',
  'ALEX RAIMUNDO RODRIGUES',
  'CLOVIS SANTOS DA SILVEIRA',
  'GABRIEL LINHARES',
  'GERMANO DE PAULA',
  'JESSICA ROCHA MEIRELES',
  'JOAO PEDRO DOS SANTOS MARTINS',
  'JOÃO PEDRO MACIEL JUNG',
  'RAONI SILVA DA SILVA',
  'SAMUEL FIGUEIRA DUTRA',
] as const;
