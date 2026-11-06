# Estoque Sebratel

Migração do relatório Power BI **"LOG - Relatórios de Produtos & Patrimônios"** (o app
se chamava assim até 05/11/2026) para
uma aplicação web (React + Vite no front, Node + Express no back), no mesmo padrão
visual e de arquitetura das demais dashboards da Sebratel (COM · Gestão Comercial,
DEVINTEL, Financeiro). Os `.pbip` de origem não são versionados: ficam só na máquina de quem migra (o `.gitignore` os ignora).

Também traz, como abas próprias, os relatórios Power BI **"CMP - Lançamento e Saldos"**
(Compras · Lançamento e saldos), **"CTR - Movimentação Equipamentos para Campo"**
(Controle · Equipamentos para campo), as duas páginas do **"LOG - Objetos em Carga"**
(Patrimônios · Em carga e Produtos & Cabos · Em carga), a aba "Entrada/ Saída
Laboratório" do **"LAB - Produtividade Laboratório"** (Laboratório · Entrada e saída) e,
numa seção de acesso restrito, o **"LOG - Gerencial"** (ver [Gerencial](#gerencial-acesso-restrito)).

Os dados vêm **direto das fontes** (Voalle e MariaDB) e são **relidos de hora em hora**
pelo servidor — menos a tela de Compras, relida **a cada minuto**. Mínimo, alerta e situação dos produtos ficam num cadastro do próprio app
(ver [Configuração · Controle de estoque](#configuração--controle-de-estoque)). A migração para o Data Hub está prevista
para uma fase seguinte — ver [Próximo passo: Data Hub](#próximo-passo-data-hub).

## Telas

| Tela (web) | Página do Power BI | Fontes |
|---|---|---|
| Capa | CAPA | situação das fontes |
| Produtos · Alerta de estoque | PRODUTOS - ALERTA ESTOQUE | Saldo Voalle, cadastro de controle de estoque, Pedidos Compra |
| Patrimônios · Alerta de estoque | PATRIMÔNIOS - ALERTA DE ESTOQUE | idem + Status Real Patrimônio, Base Senior, Objetos Pendentes, Notas Romaneio |
| Patrimônios · Romaneio | PATRIMÔNIOS - ROMANEIO | Romaneio de Patrimônios, Usuários |
| Patrimônios · Alocação | PATRIMÔNIOS - ALOCAÇÃO | Consumo Patrimônios |
| Produtos & Cabos · Romaneio | PRODUTOS & CABOS - ROMANEIO | Romaneio Produtos/Cabos, Usuários |
| Produtos & Cabos · Alocação | PRODUTOS & CABOS - ALOCAÇÃO | Consumo Produtos, cadastro de controle de estoque, Usuários |
| Compras · Lançamento e saldos | RECEBIMENTO (do Power BI "CMP - Lançamento e Saldos") | Produtos, Pedido de Compra — **a cada minuto** |
| Controle · Equipamentos para campo | Movimentação Equipamentos (do Power BI "CTR - Movimentação Equipamentos para Campo") | PRIMEIRO VÍNCULO, ÚLTIMO VÍNCULO |
| Laboratório · Entrada e saída | Entrada/ Saída Laboratório (do Power BI "LAB - Produtividade Laboratório") | general, backlog |
| Patrimônios · Em carga | SALDO PATRIMÔNIO (do Power BI "LOG - Objetos em Carga") | DASH_ATUAL_TECNICOS, Usuários |
| Produtos & Cabos · Em carga | SALDO PRODUTO (do Power BI "LOG - Objetos em Carga") | DASH_ATUAL_CONSUMOS, Usuários |
| Gerencial · Objetos criados | OBJETOS CRIADOS (do Power BI "LOG - Gerencial") | OBJETOS CRIADOS |
| Gerencial · Consumo de flat | CONSUMO DE FLAT | Consumo Voalle |
| Gerencial · Movimentações ZTE | MOVIMENTAÇÕES ZTE | PRIMEIRO VÍNCULO, ÚLTIMO VÍNCULO |
| Gerencial · ZTE usados | ZTE - USADOS | ÚLTIMO VÍNCULO, USADOS CLASSIFICADO |
| Gerencial · Equipamentos obsoletos | EQUIPAMENTOS OBSOLETOS | EQUIPAMENTO OBSOLETOS |
| Gerencial · Produtividade almox | PRODUTIVIDADE ALMOX | QuantidadeRomaneios + lista da Administração |
| Configuração · Controle de estoque | (planilha "Controle Estoque") | cadastro do app + saldo Voalle |

**Fora desta versão, por decisão:** "Requisições almoxarifado" e "Desconto ferramental".

**Navegação:** as abas ficam **recolhidas numa linha** — a do grupo da tela aberta
(ex.: Patrimônios › alerta, romaneio, alocação, em carga). O botão **Mais telas** abre os
outros grupos por cima do conteúdo (a página não pula) e o painel se fecha ao escolher
uma tela, ao clicar fora ou com Esc (`web/src/components/layout/PageNav.tsx`).

## Arquitetura

```
Voalle (PostgreSQL) ─┐
MariaDB (Senior) ────┴─> server/ (Express + TS)  ── carga horária ──> modelo em memória
cadastro do app (JSON) ───────┤                                         (tabelas + colunas DAX)
                              ├── /api/v1/reports/<tela>  ──>  web/ (React + Vite + TS)
                              └── /api/v1/stock-controls (CRUD)
```

- **Um endpoint por tela** (`GET /api/v1/reports/<tela>`): devolve filtros, cartões,
  gráficos e tabelas de uma vez. Um clique em filtro custa uma requisição.
- **Filtros como no Power BI:** os seletores se filtram entre si, mas um seletor não
  filtra a própria lista (ver `server/src/modules/reports/report-filter.ts`). Os filtros
  moram na URL — o link é compartilhável e o botão voltar desfaz o clique num gráfico.
- **Modelo em memória** (`server/src/model`): cada consulta vira uma tabela com as
  colunas calculadas do DAX já resolvidas. A troca do modelo é atômica: quem está no
  meio de uma requisição lê o modelo antigo inteiro, nunca uma mistura.
- **Carga horária** (`server/src/sources/refresh.job.ts`): primeiro as tabelas de
  cadastro (rápidas), depois as de movimento (pesadas, duas em paralelo). A carga
  completa leva ~9 min; a tela segue com o dado anterior enquanto isso. Fonte que
  falha mantém a última leitura boa e aparece como "falhou" na capa. As duas fontes do
  laboratório têm cadência própria, a cada 3 horas (`LAB_REFRESH_INTERVAL_MS`): as cargas
  do meio as pulam; o boot e a atualização manual pela capa leem tudo.
- **Carga ao vivo** (`server/src/sources/live-refresh.job.ts`): as duas fontes da tela de
  Compras ficam fora da carga horária e são relidas a cada minuto
  (`LIVE_REFRESH_INTERVAL_MS`), em sequência e numa conexão só — ~1 s de consulta por
  minuto. Têm versão própria no modelo: a releitura não invalida o cache das outras telas.
- **Tabelas de detalhe** mostram até 1.000 linhas; o botão **CSV** de cada visual
  exporta todas as linhas do recorte, geradas no servidor com os mesmos filtros. A tela
  do laboratório é a exceção: sem limite, todas as linhas vão para a tela, e a tabela
  desenha só as que estão à vista (`DataTable` com `virtual`).

### Estrutura

```
server/src/
  config/            leitura e validação do ambiente (zod)
  common/            auth (Google), erros, envelope de resposta, segurança, helpers
  database/          clientes Voalle (só leitura) e MariaDB
  sources/           consultas .sql, registro das fontes, carga horária e carga ao vivo
  model/             regras de negócio, tipos e montagem das tabelas do modelo
  modules/           health, auth, data-sources, reports (um serviço por tela),
                     stock-controls (cadastro + semente) e products (consulta por código)
web/src/
  components/        ui, layout, charts, tables, filters, stock, packing
  pages/             uma pasta por tela
  services/          httpClient (axios), auth, reports, data-sources, stock-controls
  context/ hooks/ utils/ styles/
```

## Rodando local

Pré-requisito: Node 22+ (a imagem Docker usa Node 24 LTS).

```bash
npm run install:all
```

O servidor lê o `.env` da raiz do projeto e, **fora de produção**, também os `.env`
das pastas acima dele — é assim que ele usa o `.env` compartilhado da pasta de
trabalho sem copiar credenciais para cá. Nomes aceitos: `DB_VOALLE_*` ou `DB_ELLEVEN_*`,
`GOOGLE_CLIENT_ID` ou `VITE_GOOGLE_CLIENT_ID`. Modelo em `.env.example`.

```bash
npm run dev:server
```

```bash
npm run dev:web
```

O Vite sobe em `http://localhost:5173` e faz proxy de `/api` para a API
(padrão `http://localhost:8080`; mude com `API_URL`). Para rodar sem o login do
Google, defina `AUTH_ENABLED=false` **junto com `HOST=127.0.0.1`**, para o painel sem
login não ficar acessível a outras máquinas da rede (em produção o servidor se recusa a
subir sem login, a menos que isso seja declarado explicitamente).

**Dica:** defina `DEV_SOURCE_CACHE_DIR=.source-cache` (relativo à pasta `server/`) para guardar o
resultado das consultas em disco. O próximo reinício reaproveita o cache (até 1 h) em
vez de reler ~1,7 milhão de linhas do ERP de produção. Ignorado em produção.

### Testes e verificação

```bash
npm run typecheck
```

```bash
npm test
```

## Deploy (Docker / Portainer)

A imagem é construída a partir do código (`pull_policy: build`), igual às outras
dashboards. As variáveis vão no campo de ambiente da stack — não existe `.env` em
produção.

```bash
docker compose up -d --build
```

- Porta publicada: `HOST_PORT` (padrão 8083) → 8080 no contêiner.
- Memória: o modelo tem ~1,7 mi de linhas; `NODE_OPTIONS=--max-old-space-size=2048`
  com limite de 3 GB no contêiner.
- Healthcheck: `GET /api/v1/health`.
- `TRUST_PROXY=1` atrás do proxy reverso (o rate limit precisa do IP real).
- No Google Cloud, a origem pública do dashboard precisa estar nas **origens
  JavaScript autorizadas** do cliente OAuth.
- **Volume `logistic-dashboard-data` em `/app/data`**: guarda o cadastro de controle de
  estoque, os usuários com as permissões e o log de edições. Não remova o volume ao
  recriar a stack.
- `ADMIN_EMAILS`: admin(s) de fábrica — ver [Administração](#administração).

## Compras · Lançamento e saldos

Migração da página **RECEBIMENTO** do Power BI **"CMP - Lançamento e Saldos"** (o
`.pbip` não é versionado). Aba **Compras · Lançamento e saldos** na linha "Outras áreas" do
topo e um cartão na capa.

- **Saldo de itens:** saldo disponível de cada produto por base, de todas as bases da
  empresa 1 (inclusive as de projeto), com unidade e os indicadores *atualiza estoque* e
  *gera patrimônio* (verde no "Sim").
- **Pedido de compra:** um pedido por linha (data, nº, previsão de entrega, fornecedor,
  status com a cor do Power BI e base).
- **Pedido de compra · itens:** cada item dos pedidos lançados desde
  `PURCHASE_ORDERS_SINCE` (01/01/2026, como no Power BI), com quantidade, valores e
  solicitante — o pedido se repete numa linha por item. O mesmo item lançado igual
  duas vezes no pedido (produto, quantidade e valores iguais) aparece numa linha só,
  como no Power BI.
- **Linha de total:** só a coluna "." do Power BI — **ITENS** no saldo (conta os
  códigos) e **PEDIDOS** nas duas tabelas de pedido (contagem *distinta* do Nº: 1 por
  linha, e o total é o número de pedidos). Quantidade e valores são colunas sem
  resumir, como no relatório original.
- **Filtros:** os dez do relatório. Código, item e base filtram o saldo; fornecedor,
  status, nº do pedido, pessoa, atualiza estoque, gera patrimônio e deletado filtram os
  pedidos. Como no modelo do Power BI (relacionamento por código nos dois sentidos),
  **um lado recorta o outro**: escolher um fornecedor mostra só o saldo dos itens
  comprados dele; escolher uma base mostra só os pedidos de itens com saldo nela.
  Clicar numa linha do saldo filtra pelo código; numa linha do pedido, pelo pedido.
- **Atualização:** o servidor relê o Voalle a cada minuto e só troca a versão do dado
  quando algo mudou. A tela confere essa versão a cada 15 s (resposta pequena) e baixa
  as tabelas de novo só quando ela muda — o dado novo aparece até 15 s depois da
  leitura. O topo mostra a hora da última leitura ("lido às 15:42:10 · a cada minuto"),
  no lugar do cartão "Atualizado:" do Power BI.
- **Base do pedido:** reconhecida pelo endereço escrito na observação (rua Scharlau =
  São Leopoldo, Victor Barreto = Canoas, Navegantes = Sede), como no Power BI. É uma
  regra diferente da usada nas telas de alerta (CEP), e pedido sem endereço reconhecido
  fica com base em branco.

## Controle · Equipamentos para campo

Migração da página **Movimentação Equipamentos** do Power BI **"CTR - Movimentação
Equipamentos para Campo"** (o `.pbip` não é versionado). Aba **Controle · Equipamentos para
campo** na linha "Outras áreas" do topo e um cartão na capa, ao lado do de Compras. Atualiza de hora em hora,
junto com a carga das outras telas.

- **O que conta:** ONUs e roteadores dos 9 modelos acompanhados
  (`FIELD_EQUIPMENT_MODELS` em `server/src/model/business-rules.ts` — modelo novo
  entra ali) enviados a campo a partir de `FIELD_EQUIPMENT_SINCE` (01/01/2025).
  - **Novo:** o primeiro "Enviado em Romaneio" do patrimônio, olhando o histórico
    inteiro (um patrimônio que saiu em 2023 não é novo em 2025).
  - **Usado:** cada saída para "A.ALMOXARIFADO" depois de o patrimônio ter passado
    pelo laboratório (cancelamento ou manutenção).
- **Filtros:** ano, mês, período (data inicial e final) e equipamento — o slicer
  "DATA DE ENVIO" (ano > mês > dia) e o "EQUIPAMENTOS" do relatório. A tela abre no
  **ano corrente**, como o relatório (que salvava 2026); limpar o filtro mostra todos os anos.
- **Visuais:** quantidade por ano > mês > dia (novos, usados e total), pizza novos x
  usados, quantidade por ano > modelo, novos por modelo e mês, usados por modelo e
  romaneio por mês, os dois relatórios "dia a dia" (dia do mês nas colunas) e as duas
  tabelas detalhadas com CSV. As matrizes abrem **recolhidas**, como no Power BI: o
  **+** abre um nível, e os botões do cabeçalho abrem ou recolhem tudo.
- **Como no relatório:** as colunas de mês e de dia das matrizes não separam o ano (com
  2025 e 2026 marcados, março soma os dois anos); os dois visuais de usados por mês e
  dia a dia mostram **7 dos 9 modelos** (o filtro do visual no Power BI deixa de fora
  o F670L RE3023 e o mesh H3601PE), enquanto a pizza, as tabelas por data e por tipo e
  o detalhe mostram os 9.

## Laboratório · Entrada e saída

Migração da aba **"Entrada/ Saída Laboratório"** do Power BI **"LAB - Produtividade
Laboratório"** (o `.pbip` não é versionado), na linha **Outras áreas** das abas e nos
cartões de área da capa. Atualiza **a cada 3 horas**. As outras duas abas do relatório
("Produtividade x Reincidentes" e "Produtividade / Base") não vieram: liam uma planilha
Google de apontamentos do laboratório e estavam ocultas no Power BI.

- **As consultas são as do Power BI, exatamente como estão** (decisão da área,
  06/11/2026): nenhum filtro, piso ou limite a mais no app — os dados da tela são os do
  relatório.
- **Eventos** (`lab_events.sql`, a consulta "general", ~53 s): a partir das trocas de responsável (tipo 5), do RMA/garantia e do descarte
  interno, cada patrimônio ganha os eventos **ENTRADA** (do almoxarifado para um
  laboratório), **SAIDA** (de volta a um almoxarifado), **RMA** e **DESCARTE INTERNO**
  (terminais), numerados por **ciclo**, com o laboratório e o motivo da entrada
  (cancelamento ou manutenção) e os **dias no laboratório** nos eventos de fechamento.
  Desde 2026 (o corte é o do próprio Power BI), com o histórico inteiro de cada patrimônio.
- **Backlog** (`lab_backlog.sql`, ~28 s): o que está no laboratório agora — responsável
  atual é um laboratório, sem RMA/descarte — com a data de entrada, os dias em aberto e o
  "Acima de 90 dias" da própria consulta (contados na hora da leitura, como no Power BI;
  acima de 90 fica em vinho).
  Como no Power BI, os filtros da tela chegam a ele pelos patrimônios dos eventos.
- **Tela:** cartões (eventos, patrimônios, no laboratório), eventos por dia ou mês por
  tipo, a tabela de eventos, a matriz item x evento/motivo, patrimônios por item, a
  listagem por patrimônio e ciclo, e o backlog por item e por patrimônio (vinho = mais de
  90 dias). Todas as linhas, sem limite. Três CSVs: eventos, patrimônios e backlog.
- **Cores do Power BI:** colunas do gráfico com entrada verde, saída vermelha, RMA azul e
  descarte interno roxo; nas tabelas, a célula do evento com as mesmas cores e a do
  motivo com cancelamento amarelo e manutenção azul.
- **Filtros:** data, item, dash laboratório, dash almox e patrimônio (busca) na barra;
  tipo de evento, base operacional e tipo de entrada em botões. **Clique numa coluna do
  gráfico** filtra a tela pelo dia (ou mês) clicado; **Ctrl+clique** soma mais de um
  período; clicar de novo tira. O gráfico continua com todos os períodos, os escolhidos
  em destaque.

## Em carga (Patrimônios e Produtos & Cabos)

Migração das páginas **SALDO PATRIMÔNIO** e **SALDO PRODUTO** do Power BI **"LOG - Objetos em
Carga"** (o `.pbip` não é versionado): a coluna **Em carga** nas linhas Patrimônios e
Produtos & Cabos do topo, e dois cartões na capa. Atualiza de hora em hora. Mostra o que
está com **cada pessoa da empresa** (o relatório antigo "TECH - Patrimônios em Carga",
que chegou a ser migrado em 04/11/2026, foi trocado por este).

- **Patrimônios · Em carga:** todo patrimônio com uma pessoa como responsável no Voalle.
  Quantidade por responsável (patrimônios **distintos**), valor de compra (uma vez por
  patrimônio), total por base, e a visão geral com a data da última movimentação e há
  quantos dias foi ("TEMPO (DIAS)"). Filtros: base, descrição, responsável, colaborador
  ativo?, código, patrimônio ativo? e patrimônio deletado?.
- **Produtos & Cabos · Em carga:** o saldo de produtos com cada pessoa (view de
  movimentação interna do Voalle). Quantidade por responsável (produtos **distintos**),
  valor (**quantidade x preço unitário**), quantidade por base e a visão geral com o
  saldo por pessoa e produto. Filtros: base, descrição, responsável, colaborador ativo?,
  produto ativo? e produto deletado?.
- **Base:** pela cidade do responsável — São Leopoldo/Sapucaia do Sul/Novo Hamburgo,
  Esteio/Canoas/Porto Alegre ou Outros (`HOLDER_CITY_BASES` em `business-rules.ts`), a
  regra que o Power BI usava no saldo de produto.
- **Colaborador ativo?** (o "ATIVO?" do Power BI): casa o nome do responsável com os
  usuários do Voalle (quem não é usuário sai do recorte quando o filtro está marcado),
  como nos romaneios.
- **Patrimônio/Produto ativo? e deletado?:** do cadastro do item no Voalle —
  `patrimonies.active`/`.deleted` na tela de patrimônios e `service_products.active`/
  `.deleted` na de produtos. A consulta de patrimônios em carga não tira os deletados:
  em 05/11/2026 eram 6.037 patrimônios deletados ainda com um responsável (R$ 1,65 mi,
  12 pessoas). Por isso a tela de patrimônios **abre com "Patrimônio deletado? = Não"**
  (decisão da área, 05/11/2026) — como o ano corrente no controle de equipamentos, só
  quando se entra sem filtro na URL; limpar o filtro mostra os deletados também.

## Gerencial (acesso restrito)

Migração do Power BI **"LOG - Gerencial"** (o `.pbip` não é versionado): seis telas numa
linha própria de abas, entre **Produtos & Cabos** e **Outras áreas**, e um bloco de cartões
na capa. Atualiza de hora em hora (seis consultas novas, de 0,1 s a ~16 s cada).

- **Acesso:** só quem um administrador liberou na [Administração](#administração)
  (coluna **Gerencial**) e os próprios administradores. Para os outros a linha de abas, os
  cartões da capa e as rotas nem aparecem, as fontes da seção somem de `/data-sources`, e
  o servidor recusa as consultas com **403** (`AUTH_MANAGEMENT_FORBIDDEN`). Rotas em
  `/api/v1/management-reports/*`. A troca de acesso vale sem recarregar a página: a tela
  relê a permissão (`/auth/me`) ao voltar para a aba (no máximo uma vez por minuto) e na
  hora em que o servidor recusa algo — quem perde o acesso com uma tela gerencial aberta
  volta para a capa, já sem o bloco.
- **Cinco telas de comparação** (objetos criados, consumo de flat, movimentações ZTE, ZTE
  usados, equipamentos obsoletos), no desenho do Power BI: mês, mês x mesmo mês do ano
  anterior e ano em cima; trimestre e trimestre x ano anterior embaixo; e o histórico mês
  a mês. Mês e trimestre são os últimos **fechados**; o ano corrente vai até hoje e é
  comparado com o ano anterior inteiro (as colunas DAX `MES_ATUAL_ANTERIOR`,
  `TRIMESTRE_ATUAL_ANTERIOR`, `ANO_ATUAL_ANTERIOR`... do `Calendario`). A variação de cada
  gráfico fica no cabeçalho dele.
  - **Objetos criados:** ocorrências "Criação do Objeto" (desde 2022).
  - **Consumo de flat:** metros do cabo 00069 entregues pela equipe do almoxarifado
    (`FLAT_SUPPLIERS`), sem almoxarifados, ferramentas, sucata e RMA como recebedor.
    Mantém a contagem do Power BI: a entrega entra uma vez por equipe de quem recebeu
    (~13% a mais que contando cada entrega uma vez) — decisão da área (05/11/2026).
  - **Movimentações ZTE:** novos (primeiro "Enviado em Romaneio" de cada ONU dos
    modelos `ZTE_MOVEMENT_MODELS`) x usados (cada volta ao almoxarifado depois do
    laboratório), com a participação de cada um e a diferença em pontos percentuais.
  - **ZTE usados:** as voltas por **origem** (a passagem pelo laboratório mais recente
    antes da volta). Herdado do Power BI: o RE3023 fica fora (não estava na lista do
    "USADOS CLASSIFICADO"), e o conserto interno sai dos gráficos de ano e histórico mas
    conta nos de mês e trimestre e nos cartões de variação.
  - **Equipamentos obsoletos:** seriais distintos acumulados sob "A. RADIO / DEPOSITO"
    até o fim de cada período (pela última modificação do patrimônio); histórico dos
    últimos dois anos.
- **Produtividade almox:** romaneios (descrições distintas da ocorrência) e patrimônios
  enviados por pessoa nos dois últimos meses fechados, com variação e médias. Quem
  aparece é uma **lista editável na Administração** (começa com as 10 pessoas do Power
  BI; `productivity-staff.json` no volume de dados), com sugestões de quem mais enviou
  romaneio no período.

## Configuração · Controle de estoque

Mínimo, alerta, situação (categoria), comprador responsável, lead time e processo
externo das telas de alerta — e a categoria da alocação de produtos — vêm de um **cadastro dentro do
próprio app**, na tela **Configuração · Controle de estoque**. Ele substituiu a
planilha Google "Controle Estoque" do Power BI e nasceu com os dados da planilha
oficial **ALERTA ESTOQUE - LOGÍSTICA** (831 itens).

- **Campos:** código, situação, item, base de origem, alerta de estoque, estoque
  mínimo, comprador responsável, lead time (dias) e processo externo. A chave é **código + base**: o mesmo
  produto tem limites próprios em cada base, e o cadastro não aceita repetição.
- **Regras:** números inteiros sem sinal; o alerta não pode ser menor que o mínimo;
  a base é uma das três operacionais. O formulário mostra a descrição e o saldo do
  produto no Voalle enquanto se digita o código.
- **Quem altera:** todo mundo logado consulta; incluir, editar e excluir exige a
  permissão **Edição** ou **Admin**, dada na tela de [Administração](#administração).
  Cada item guarda quem alterou por último e quando, e toda alteração entra no log de
  edições com o que mudou (valor antes e depois).
- **Vale na hora:** ao salvar, o servidor remonta as tabelas de alerta com o saldo da
  última carga — não precisa esperar a carga horária.
- **Exportação:** o botão CSV da tela baixa o cadastro inteiro (serve de backup).

### Onde fica gravado

Um arquivo JSON em `DATA_PATH` (`stock-controls.json`; padrão `server/data/` local e
`/app/data` no contêiner), no mesmo desenho do cadastro de supervisores da agenda.
A gravação é atômica (arquivo temporário + troca), e um arquivo ilegível **trava** as
gravações em vez de ser tratado como vazio — assim um defeito no disco não apaga o
cadastro. No primeiro boot, sem o arquivo, ele é criado a partir de
`server/src/modules/stock-controls/seed/stock-controls.seed.json` (gerado da planilha
oficial; sem dado pessoal).

**Em produção o diretório precisa ser um volume** (`docker-compose.yml` já monta
`logistic-dashboard-data` em `/app/data`); sem volume, cada deploy voltaria o
cadastro para a planilha oficial.

## Administração

Botão de engrenagem no topo, **só para administradores**
(`/administracao`, mesmo desenho da aba de acessos da dashboard IA):

- **Usuários:** todo mundo que já entrou no painel, com status **Online** (alguma
  ação nos últimos 2,5 min), último login, último acesso e primeiro acesso.
- **Permissões:** três níveis, trocados na própria tabela (com confirmação):
  - **Padrão** — consulta tudo (é o de quem entra pela primeira vez);
  - **Edição** — também inclui, altera e exclui itens do controle de estoque;
  - **Admin** — também acessa a Administração e dispara a atualização manual das fontes.
  A troca vale na próxima ação da pessoa. Não dá para tirar o último administrador.
- **Gerencial:** quem vê a seção Gerencial (Sim/Não, com confirmação). Administradores
  sempre veem; quem entra pela primeira vez não vê.
- **Produtividade almox:** a lista de quem aparece na tela (incluir, tirar, sugestões de
  quem enviou romaneio nos dois meses da tela).
- **Log de edições:** as últimas 5.000 ações (controle de estoque com o valor antes e
  depois de cada campo, troca de permissão e de acesso ao Gerencial, lista da
  produtividade, atualização manual), com busca e filtro.

**Primeiro admin:** `ADMIN_EMAILS` (padrão: `gustavo.santos@sebratel.com.br`) só vale
enquanto **não existir nenhum admin salvo** — numa instalação nova, esse e-mail entra
como Admin no primeiro acesso. Depois disso a lista não dá papel a ninguém: os demais
admins são escolhidos na tela.

Tudo fica em arquivos JSON no volume de dados (`users.json`, `audit-log.json`,
`productivity-staff.json`), no mesmo
desenho do controle de estoque: gravação atômica, e arquivo ilegível não é sobrescrito.
Se `users.json` ficar ilegível, ninguém fica trancado do lado de fora: o admin de fábrica
entra como Admin, o resto como Padrão, e nada é gravado até o arquivo ser corrigido.

## Regras de negócio

Tudo o que o Power BI tinha espalhado em filtros de página, filtros de visual e
listas dentro das consultas está em `server/src/model/business-rules.ts`: time do
almoxarifado, contas internas excluídas, lista fechada de cabos, regiões → base,
siglas de base. **Cabo novo ou almoxarife novo entra ali.**

Colunas DAX reproduzidas: `STATUS2`, `% EXCESSO`, `% DEFICIT`, `% QTD TRANFERIR`
(exibida como A RECEBER), `Sigla Base`, `CHAVE_PRODUTO_BASE`, `BaseGrupo`, `AnoMes`,
`Status` (geral do patrimônio). Medidas: `Disponiveis`, `QtdPendente`,
`disponivel&pendente`, `Romaneios`, `MEDIA_MENSAL`, `MEDIA_3_MESES`,
`MEDIA_MENSAL_GERAL` e as equivalentes de patrimônio.

## Divergências propositais em relação ao Power BI

Cada uma corrige um defeito com efeito no número ou evita um custo sem mudar o que a
tela mostra. Quem comparar lado a lado vai encontrar estas diferenças:

1. **Lista de fornecedores dos romaneios** — na consulta original faltava uma vírgula
   entre `'RAONI SILVA DA SILVA'` e `'SAMUEL FIGUEIRA DUTRA'`; o PostgreSQL juntava os
   dois nomes num só e os romaneios dos dois ficavam de fora. Aqui eles entram.
2. **Status real do patrimônio x saldo** — o modelo ligava `Saldo Voalle[CÓDIGO]` a
   `Status Real Patrimonio[produto_id]` (código com id), que só casa por coincidência
   (~90% dos produtos). A ligação não foi reproduzida: a seção de status tem os seus
   próprios filtros (patrimônio, serial, item, código, responsável, equipe).
3. **Média de 3 meses** ignora o filtro de período, como a medida pretendia (`ALL` na
   data). No Power BI o slicer de data vazava pela tabela de datas automática e a
   média zerava ao escolher um mês fora da janela.
4. **Disponíveis** soma o saldo uma vez por produto+base. No Power BI a soma passava
   pelo merge com pedidos de compra e contava em dobro o produto com dois pedidos.
5. **Categoria nas alocações** é única por código. O merge do Power Query por código
   repetia cada alocação para cada base cadastrada na planilha, o que inflava os
   gráficos de quantidade alocada.
6. **"RESUMO POR PRODUTO" dos romaneios** — o filtro do visual estava aplicado na
   tabela errada (Consumo Produtos) e, pelas relações bidirecionais com Usuários,
   escondia romaneios de quem não aparecia nas alocações. Não foi reproduzido.
7. **Base na tabela de alerta** — sai da base do Voalle; no Power BI ficava em branco
   para item não cadastrado na planilha.
8. **Volume das consultas** — `Notas Romaneio Patrimônios` aplica no SQL os filtros que
   o Power BI aplicava só no visual (de ~1,3 mi para ~125 mil linhas); `Consumo
   Produtos` recorta o número do protocolo no banco; `Consumo Patrimônios` traz só as
   colunas exibidas. O resultado das telas é o mesmo.
9. **Gráfico diário dos romaneios** mostra os últimos 31 dias do recorte (o mensal
   cobre o período todo). Cabos e produtos dividem o mesmo espaço com um alternador.
10. **Campos de altíssima cardinalidade** (patrimônio, serial, protocolo, nota, cliente)
    são busca por texto em vez de lista suspensa.
11. **Controle de estoque** é um cadastro do app em vez da planilha Google, e o lead
    time é número de dias.
12. **Compras · coluna "."** do Power BI ganhou título: **ITENS** no saldo e **PEDIDOS** nas
    tabelas de pedido (mesmo cálculo do Power BI). Os grupos ocultos da
    página (filtros "Almox"/"TabelaData" e botões de marcador) apontavam para tabelas
    que não existem no modelo e não foram migrados.
13. **Equipamentos para campo · o que não tinha visual** — o modelo do Power BI carregava
    também "OBJETOS CRIADOS", "CONSUMO DE FLATH", "EQUIPAMENTO OBSOLETOS",
    "ACURACIDADE" (planilha Google) e as medidas de comparação (mês a mês, trimestre,
    ano a ano), mas nenhum visual da página as usava. Não foram migradas.
14. **Equipamentos para campo · meses em ordem de calendário** no "Relatório Movimentações
    Equipamentos Novos - Dia a Dia". No Power BI a coluna de mês era texto sem ordem de
    classificação, e os meses saíam em ordem alfabética (abril, agosto, dezembro…).
15. **Equipamentos para campo · coluna "Soma de ANO_ATUAL_ANTERIOR"** (soma de um
    marcador do calendário, sem significado) que sobrou na matriz "QTD. EQUIPAMENTOS
    ENVIADOS A CAMPO" não foi migrada; a matriz mostra só os dias com envio.
16. **Equipamentos para campo · filtro de data** — o slicer hierárquico (ano > mês > dia)
    virou ano, mês e período. A matriz "Equipamentos Novos enviados a campo" mostra os
    meses (no Power BI dava para abrir o mês em dias; os dias estão nas matrizes "dia a
    dia"). O corte de data é um só, a partir de 01/01/2025, na consulta; o Power BI usava
    "> 31/12/2024" em uns visuais e "> 01/01/2025" em outros, mas não houve envio em
    01/01/2025 (conferido em 04/11/2026), então o número é o mesmo.
17. **Em carga · valor dos patrimônios** soma cada patrimônio uma vez. A consulta do
    Power BI fazia join com os itens da nota fiscal de entrada e repetia o patrimônio uma
    vez por item da nota (até 123 vezes): o valor total saía R$ 26,4 mi contra R$ 10,15
    mi reais (04/11/2026). A quantidade (contagem distinta) não muda. Decisão da área.
18. **Em carga · valor dos produtos** é quantidade x preço unitário (R$ 3,55 mi em
    04/11/2026). O "VALOR TOTAL" do Power BI somava só o preço unitário (R$ 384 mil).
    Decisão da área.
19. **Em carga · sem a planilha "EQUIPES ATUAIS"** — o Power BI tirava a base (e a área)
    de cada técnico de uma planilha Google com ~311 técnicos. Por decisão da área, as
    telas mostram todo mundo da empresa e a base sai da cidade do responsável. Com isso
    caiu também o filtro de página do saldo de produto, que só mostrava quem tinha
    patrimônio em carga.
20. **Em carga · detalhes** — a visão geral de produto soma o saldo por pessoa e produto
    (no Power BI a linha separava ou juntava lotes pelo preço unitário, que não aparece);
    o cartão que o Power BI chamava de "DASHBOARDS" é **Responsáveis** (contagem distinta
    de pessoas); o filtro de descrição salvo no relatório (ONU F6600P P0625) não vem
    marcado — a tela abre com tudo.
21. **Romaneio · coluna "."** (contagem distinta do número do romaneio) da tabela
    "RELATÓRIO DE ROMANEIO", nas duas telas de romaneio, não foi migrada. A contagem
    de romaneios está no resumo da própria tela. Encontrado em 04/11/2026, ao conferir
    as agregações de todos os relatórios.
22. **Alerta de estoque · filtros "Ativo?" e "Deletado?"** (05/11/2026, pedido da área) —
    não existiam no Power BI; valem também para o CSV.
    - **Produtos:** na barra do saldo, pelo cadastro do PRODUTO no Voalle
      (`service_products.active` e `.deleted`). A view de saldo já não traz produto
      deletado, então hoje o "Deletado?" só lista "Não".
    - **Patrimônios:** pelo cadastro de CADA patrimônio (`patrimonies.active` e
      `.deleted`), na barra do **status real dos patrimônios** — é lá que cada
      patrimônio aparece (~53,6 mil deletados, quase todos descarte, vendido ou
      extraviado). O saldo de cima é por item e base e não tem esses filtros: os
      patrimônios disponíveis são todos ativos e não deletados.
    - **Em carga** (mesmo pedido): "Patrimônio ativo?/deletado?" e "Produto
      ativo?/deletado?", pelo mesmo critério. O "Ativo?" que já existia (usuário ativo)
      passou a se chamar **Colaborador ativo?**, para não confundir com eles.
23. **Gerencial · variação sem período anterior** — sem valor no período anterior a
    variação aparece como "—". No Power BI, `DIVIDE(...) - 1` mostrava −100%.
24. **Gerencial · ano** — o Power BI tinha os anos escritos nas fórmulas (2026 x 2025);
    aqui saem da data de hoje. O ano corrente continua indo até hoje, contra o anterior
    inteiro, como no Power BI.
25. **Gerencial · produtividade** — o Power BI tinha um gráfico por pessoa (nomes fixos)
    e um do total; aqui o gráfico é o do total, a tabela traz cada pessoa (um clique põe a
    pessoa no gráfico) e a lista é editável na Administração. A consulta lê só os dois
    meses que a tela usa (o Power BI lia desde 2023).
26. **Gerencial · histórico** — os gráficos de histórico ficam no nível mês, como estavam
    salvos no Power BI (sem o "descer" para o dia). As consultas já chegam somadas por dia;
    a de obsoletos sem o join com os itens da nota fiscal (só repetia linhas que o DISTINCT
    juntava de novo).
27. **Laboratório · gráfico** — o Power BI mostrava as colunas dia a dia; aqui dá para
    trocar entre dia e mês, e com mais de dois meses no recorte a tela abre no mês. O
    filtro de patrimônio é uma busca (são ~20 mil), e a tabela de eventos lista cada
    evento (o Power BI juntava linhas idênticas, o que na prática não acontece).

## Segurança

- Login com Google (Google Identity Services); o servidor valida o token no Google a
  cada requisição (cache de 5 min pelo hash do token) e restringe ao domínio
  `ALLOWED_DOMAIN`. Permissões (Padrão, Edição, Admin) guardadas no servidor e
  conferidas a cada requisição: alteração do controle de estoque só com Edição ou Admin;
  Administração e atualização manual só com Admin. Gravações com rate limit próprio,
  validação estrita (campo desconhecido é recusado) e log de edições.
- Banco do ERP acessado **só em leitura** (`BEGIN READ ONLY`), com `statement_timeout`
  e pool pequeno; nenhum dado de requisição chega ao SQL — todo filtro é feito em memória.
- Entrada validada com zod (tamanho e quantidade de valores limitados); erro 500
  genérico, sem stack trace; envelope `{ success, data | error }`.
- Helmet com CSP restrita (só o necessário para o login do Google), sem CORS (SPA e API
  na mesma origem), rate limit geral e mais baixo na exportação.
- CSV exportado neutraliza injeção de fórmula (`=`, `+`, `-`, `@`).
- Segredos só em variáveis de ambiente; `.env*` fora do git.

## Próximo passo: Data Hub

A migração está preparada em [`MIGRACAO-DATAHUB.md`](MIGRACAO-DATAHUB.md), na raiz do projeto:

- as **23 fontes** (tabelas puras), com as colunas que cada uma precisa publicar;
- os **22 conjuntos calculados** prontos para colar no Data Hub, validados no mesmo
  DuckDB dele (o 11 e o 12 são da tela de Compras — ver a decisão 6 do documento sobre
  manter a atualização a cada minuto; o 13 e o 14, da tela de equipamentos para campo e
  também dos ZTE novos e usados do Gerencial; o 15 e o 16, das telas em carga; do 17 ao
  20, do resto da seção Gerencial; o 21 e o 22, da tela do laboratório);
- as regras que saem do SQL e passam para o app;
- os números da carga direta, para conferir depois da primeira materialização.

No app, a troca fica em `server/src/sources/source.registry.ts`: cada fonte passa a ler
um conjunto pelo `/rows` do Data Hub em vez do banco. Modelo e telas não mudam.
