/**
 * As telas, na ordem do relatório de origem. "Requisições almoxarifado" e
 * "Desconto ferramental" ficaram de fora desta primeira versão, por decisão.
 * A última é a configuração do app (o cadastro que substituiu a planilha).
 *
 * `shortLabel` é o nome na aba (a linha da aba já diz o grupo).
 * `description` e `icon` aparecem nos cartões da capa; `sources` são as
 * fontes de dados da tela (chaves de /data-sources), para o cartão mostrar
 * quando o dado DAQUELA tela foi lido.
 */
export interface PageDefinition {
  path: string;
  label: string;
  shortLabel?: string;
  title: string;
  description?: string;
  icon?: string;
  sources?: string[];
  /** cartão separado, abaixo das telas de relatório */
  isSetting?: boolean;
  /** dado lido a cada minuto (não de hora em hora) */
  live?: boolean;
  /** seção Gerencial: só aparece (aba, capa e rota) para quem tem acesso */
  management?: boolean;
}

export const COVER_PATH = '/capa';
export const SETTINGS_PATH = '/configuracoes/controle-estoque';
/** Tela só de administradores — botão próprio no topo, fora das abas e da capa. */
export const ADMIN_PATH = '/administracao';

/**
 * As telas de relatório em dois grupos, na mesma ordem (alerta, romaneio,
 * alocação, em carga): duas linhas de abas no topo e duas colunas de cartões
 * na capa. A configuração fica fora — é o botão do topo.
 */
export const REPORT_GROUPS = [
  {
    key: 'patrimonios',
    label: 'Patrimônios',
    paths: ['/patrimonios/alerta-estoque', '/patrimonios/romaneio', '/patrimonios/alocacao', '/patrimonios/em-carga'],
  },
  {
    key: 'produtos',
    label: 'Produtos & Cabos',
    paths: ['/produtos/alerta-estoque', '/produtos/romaneio', '/produtos/alocacao', '/produtos/em-carga'],
  },
] as const;

/**
 * Seção GERENCIAL (Power BI "LOG - Gerencial"), de acesso restrito: uma linha
 * de abas própria entre Produtos & Cabos e Outras áreas, e um bloco de cartões
 * na capa — as duas coisas só para quem um administrador liberou.
 */
export const MANAGEMENT_GROUP = {
  key: 'gerencial',
  label: 'Gerencial',
  paths: [
    '/gerencial/objetos-criados', '/gerencial/consumo-flat', '/gerencial/movimentacoes-zte',
    '/gerencial/zte-usados', '/gerencial/equipamentos-obsoletos', '/gerencial/produtividade-almox',
  ],
} as const;

/**
 * Áreas com telas próprias (que não existem para patrimônios/produtos):
 * dividem UMA linha de abas, abaixo das duas de cima — uma tela por coluna,
 * com o nome da área na aba — e os cartões ficam abaixo das duas colunas da
 * capa. Compras veio do Power BI "CMP" e Controle do "CTR".
 */
export const AREA_ROW_LABEL = 'Outras áreas';

export const AREA_GROUPS = [
  { key: 'compras', label: 'Compras', paths: ['/compras/lancamento-e-saldos'] },
  { key: 'controle', label: 'Controle', paths: ['/controle/equipamentos-campo'] },
  { key: 'laboratorio', label: 'Laboratório', paths: ['/laboratorio/entrada-saida'] },
] as const;

export const PAGES: PageDefinition[] = [
  // na capa o topo é o bloco vinho com o nome do painel (TopBar), então o título não aparece
  { path: COVER_PATH, label: 'Capa', title: 'Início' },
  {
    path: '/produtos/alerta-estoque',
    label: 'Produtos · Alerta de estoque',
    shortLabel: 'Alerta de estoque',
    title: 'Alerta de estoque · Produtos / Cabos',
    description: 'Saldo contra mínimo e alerta, por base, com os pedidos de compra em aberto',
    icon: 'alerta',
    sources: ['stockBalances', 'purchaseRequests', 'stockControl'],
  },
  {
    path: '/patrimonios/alerta-estoque',
    label: 'Patrimônios · Alerta de estoque',
    shortLabel: 'Alerta de estoque',
    title: 'Alertas de estoque · Patrimônios',
    description: 'Saldo, status real dos patrimônios, pendentes de patrimoniar e histórico de romaneios',
    icon: 'alerta',
    sources: ['stockBalances', 'purchaseRequests', 'stockControl', 'patrimonyStatuses', 'senior', 'pendingPatrimonies', 'patrimonyPackingNotes'],
  },
  {
    path: '/patrimonios/romaneio',
    label: 'Patrimônios · Romaneio',
    shortLabel: 'Romaneio',
    title: 'Consumo de patrimônios',
    description: 'O que o almoxarifado enviou em romaneio, por patrimônio, base e recebedor',
    icon: 'caminhao',
    sources: ['patrimonyPackings', 'users'],
  },
  {
    path: '/patrimonios/alocacao',
    label: 'Patrimônios · Alocação',
    shortLabel: 'Alocação',
    title: 'Rastreabilidade de patrimônios',
    description: 'Onde cada patrimônio foi alocado em protocolo, e se voltou',
    icon: 'rastro',
    sources: ['patrimonyAllocations'],
  },
  {
    path: '/produtos/romaneio',
    label: 'Produtos & Cabos · Romaneio',
    shortLabel: 'Romaneio',
    title: 'Consumo dos produtos / cabos',
    description: 'O que o almoxarifado enviou de produtos e cabos, com médias de consumo',
    icon: 'caminhao',
    sources: ['productPackings', 'users'],
  },
  {
    path: '/produtos/alocacao',
    label: 'Produtos & Cabos · Alocação',
    shortLabel: 'Alocação',
    title: 'Rastreabilidade de produtos & cabos',
    description: 'Produtos e cabos usados em protocolo, por técnico e base',
    icon: 'rastro',
    sources: ['productAllocations', 'users', 'stockControl'],
  },
  {
    path: '/compras/lancamento-e-saldos',
    label: 'Compras · Lançamento e saldos',
    shortLabel: 'Lançamento e saldos',
    title: 'Lançamento e saldos · Compras',
    description: 'Saldo de itens por base e os pedidos de compra lançados no ano — atualizado a cada minuto',
    icon: 'carrinho',
    sources: ['itemBalances', 'purchaseOrders'],
    live: true,
  },
  {
    path: '/controle/equipamentos-campo',
    label: 'Controle · Equipamentos para campo',
    shortLabel: 'Equipamentos para campo',
    title: 'Movimentação de equipamentos para campo · Controle',
    description: 'ONUs e roteadores enviados a campo, novos e usados (vindos do laboratório), por dia, mês e modelo',
    icon: 'roteador',
    sources: ['newFieldEquipment', 'usedFieldEquipment'],
  },
  {
    path: '/laboratorio/entrada-saida',
    label: 'Laboratório · Entrada e saída',
    shortLabel: 'Entrada e saída',
    title: 'Entrada e saída · Laboratório',
    description: 'O que entrou e saiu do laboratório (e foi para RMA ou descarte), por dia, item e ciclo, e o que está lá sem saída',
    icon: 'laboratorio',
    sources: ['labEvents', 'labBacklog'],
  },
  {
    path: '/patrimonios/em-carga',
    label: 'Patrimônios · Em carga',
    shortLabel: 'Em carga',
    title: 'Patrimônios em carga · saldo por responsável',
    description: 'Os patrimônios que estão com cada pessoa: quantidade, valor e há quanto tempo',
    icon: 'carga',
    sources: ['chargedPatrimonies', 'users'],
  },
  {
    path: '/produtos/em-carga',
    label: 'Produtos & Cabos · Em carga',
    shortLabel: 'Em carga',
    title: 'Produtos em carga · saldo por responsável',
    description: 'O saldo de produtos e cabos com cada pessoa, em quantidade e valor',
    icon: 'carga',
    sources: ['chargedProducts', 'users'],
  },
  {
    path: '/gerencial/objetos-criados',
    label: 'Gerencial · Objetos criados',
    shortLabel: 'Objetos criados',
    title: 'Objetos criados · Gerencial',
    description: 'Patrimônios criados no Voalle, contra o mês, o trimestre e o ano anteriores',
    icon: 'novo',
    sources: ['createdObjects'],
    management: true,
  },
  {
    path: '/gerencial/consumo-flat',
    label: 'Gerencial · Consumo de flat',
    shortLabel: 'Consumo de flat',
    title: 'Consumo de flat (metros) · Gerencial',
    description: 'Metros do cabo flat entregues pelo almoxarifado, contra os períodos anteriores',
    icon: 'cabo',
    sources: ['flatConsumption'],
    management: true,
  },
  {
    path: '/gerencial/movimentacoes-zte',
    label: 'Gerencial · Movimentações ZTE',
    shortLabel: 'Movimentações ZTE',
    title: 'Movimentações do almoxarifado · ONUs ZTE',
    description: 'ONUs ZTE novas (primeiro romaneio) e usadas (voltas do laboratório)',
    icon: 'troca',
    sources: ['zteDispatches', 'zteReturns'],
    management: true,
  },
  {
    path: '/gerencial/zte-usados',
    label: 'Gerencial · ZTE usados',
    shortLabel: 'ZTE usados',
    title: 'ONUs ZTE usadas por origem · Gerencial',
    description: 'Voltas do laboratório ao almoxarifado por origem: cancelamento, manutenção ou conserto',
    icon: 'reciclar',
    sources: ['zteReturns'],
    management: true,
  },
  {
    path: '/gerencial/equipamentos-obsoletos',
    label: 'Gerencial · Equipamentos obsoletos',
    shortLabel: 'Equip. obsoletos',
    title: 'Equipamentos obsoletos · Gerencial',
    description: 'Seriais acumulados no depósito de rádio (A. RADIO / DEPOSITO)',
    icon: 'arquivo',
    sources: ['obsoleteEquipment'],
    management: true,
  },
  {
    path: '/gerencial/produtividade-almox',
    label: 'Gerencial · Produtividade almox',
    shortLabel: 'Produtividade almox',
    title: 'Produtividade do almoxarifado · Gerencial',
    description: 'Romaneios e patrimônios enviados por pessoa nos dois últimos meses fechados',
    icon: 'equipe',
    sources: ['packingProductivity'],
    management: true,
  },
  {
    path: SETTINGS_PATH,
    label: 'Configuração · Controle de estoque',
    title: 'Cadastro de controle de estoque',
    description: 'Mínimo, alerta, situação e lead time de cada produto por base',
    icon: 'ajustes',
    sources: ['stockControl', 'stockBalances'],
    isSetting: true,
  },
  { path: ADMIN_PATH, label: 'Administração', title: 'Administração · usuários, permissões e log' },
];

export const PAGE_BY_PATH = new Map(PAGES.map((p) => [p.path, p]));
