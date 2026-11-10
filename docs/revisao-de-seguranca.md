# Revisão de segurança e qualidade — migração inicial (03/11/2026)

Revisão feita sobre todo o código novo (`server/` e `web/`) seguindo a skill
`secure-code-review`. Escopo: autenticação, autorização, validação de entrada, acesso
ao ERP, exposição de dados, cabeçalhos, dependências, configuração e confiabilidade.

## Resumo

Nenhum achado CRÍTICO ou ALTO em aberto. Três achados foram corrigidos durante a
revisão; os demais são riscos aceitos ou melhorias para a próxima fase.

## Corrigidos durante a revisão

| # | Severidade | Achado | Correção |
|---|---|---|---|
| 1 | ALTA | `zod` < 4.6.6 (GHSA-mrhx-c7xc-m3w5): esgotamento de memória ao validar coleções com limite — exatamente o uso na query string dos relatórios | atualizado para `zod@4.6.7` |
| 2 | MÉDIA | `react-router` 6 (GHSA-wrjc-x8rr-h8h6, open redirect via `\` em `<Link>`/`useNavigate`). Não explorável aqui (só rotas fixas), mas a versão é vulnerável | atualizado para `react-router-dom@7.18.5` |
| 3 | MÉDIA | Imagem Docker em Node 20 (fim de suporte em abr/2026) | `node:24-alpine` (LTS) |
| 4 | MÉDIA (confiabilidade) | Indicador "atualizado há…" usava a hora de remontagem do modelo: com todas as fontes falhando ele dizia "há 2 min" sobre dado de ontem | passa a mostrar a idade da leitura bem-sucedida mais antiga (`dataAsOf`) |
| 5 | BAIXA | Rate limit geral de 240/min permitia ocupar a CPU com filtros aleatórios (até ~0,5 s por recorte novo) | 120/min por IP; 10/min na exportação |

`npm audit --omit=dev`: 0 vulnerabilidades no servidor e no front após as correções.

## Controles verificados

- **Autenticação:** token do Google validado no `userinfo` a cada requisição (cache de
  5 min pelo hash do token), e-mail verificado e domínio restrito. Formato do token
  validado antes de ir ao Google. Em produção o servidor não sobe sem login, salvo
  `AUTH_ENABLED=false` explícito.
- **Autorização:** todas as rotas de dados exigem login; atualização manual exige
  `ADMIN_EMAILS` e tem intervalo mínimo de 5 min. Testado em `server/test/api.test.ts`.
- **ERP:** consultas só em `BEGIN READ ONLY`, `statement_timeout` por consulta, pool de 3,
  `application_name` próprio. Nenhum dado de requisição entra no SQL (filtros em memória);
  listas de regra de negócio vão como parâmetro (`= ANY($n)`).
- **Entrada:** query string validada com zod (até 300 valores de até 300 caracteres por
  campo, datas ISO); erro 400 nomeia o campo.
- **Saída:** envelope padrão; 500 genérico sem stack trace; health público sem detalhe de
  fonte; mensagem de erro técnica da fonte não sai da API (a tela recebe só "falhou").
- **Cabeçalhos:** helmet com CSP restrita ao necessário para o login do Google,
  `frame-ancestors 'none'`, COOP `same-origin-allow-popups` (exigido pelo popup do GIS),
  sem `x-powered-by`, sem CORS (SPA e API na mesma origem).
- **Exportação CSV:** neutraliza injeção de fórmula (`=`, `+`, `-`, `@`).
- **Segredos:** só em variável de ambiente; `.env*` fora do git; nenhum segredo no código
  (varredura feita). O `.env` de desenvolvimento das pastas acima do projeto só é lido
  fora de produção; o cache de fontes em disco é desligado em produção.
- **Contêiner:** usuário não-root, healthcheck, limite de memória, log com rotação.

## Riscos aceitos / próximos passos

| Severidade | Status | Item | Recomendação |
|---|---|---|---|
| MÉDIA | CONFIRMADO | Carga direta no Voalle de produção (sem camada intermediária, por decisão de 10/11/2026): ~3.400 consultas e ~69 mi de linhas por dia (depois do corte das alocações e do histórico de romaneios em 2026); a carga horária leva de ~3 a ~9 min conforme a carga do ERP (a view `v_allocated_products` sozinha leva de 2,5 a ~7 min) | Apontar para réplica de leitura, se houver; se preciso, Compras a cada 5 min (ver "Carga e impacto no banco" no README) |
| BAIXA | POTENCIAL | Token do Google no `localStorage` (padrão das dashboards irmãs). Um XSS poderia lê-lo | Mitigado pela CSP; token dura ~1 h e só tem escopo de identidade. Reavaliar sessão por cookie `httpOnly` em todas as dashboards de uma vez |
| BAIXA | CONFIRMADO | Sem permissão por tela: todo usuário do domínio vê todas as telas | Se necessário, portar o controle de acesso por tela das dashboards irmãs |
| BAIXA | CONFIRMADO | Cadastro de controle de estoque em arquivo JSON: não suporta mais de uma réplica do contêiner, e o histórico guarda só a última alteração de cada item | Uma réplica (como hoje). Backup do volume `logistic-dashboard-data`; o CSV da tela serve de cópia manual. Se precisar de histórico completo, levar o cadastro para um banco de dados |
| INFO | — | `TRUST_PROXY` precisa refletir o proxy real em produção, senão o rate limit agrupa todos os usuários num IP | `docker-compose.yml` já usa 1 |

## Testes

- Servidor: 40 testes (`npm --prefix server test`) — regras DAX (STATUS2, excesso,
  déficit, A RECEBER, merge com o cadastro e pedidos), motor de filtros, validação, CSV,
  cadastro de controle de estoque (semente, conflito, regras, arquivo corrompido) e
  contrato da API (401 sem token em todas as rotas do cadastro, 404 em JSON, cabeçalhos).
- Front: formatação, cores e validação do formulário do cadastro (`npm --prefix web test`).
- Verificação manual no navegador das 7 telas, tema claro e escuro, filtro de lista,
  clique em gráfico (cross-filter) e chips; exportação CSV conferida pela API.

---

# Revisão — cadastro de controle de estoque (04/11/2026)

A planilha Google "Controle Estoque" deu lugar a um cadastro dentro do app
(`server/src/modules/stock-controls`), com tela de configuração. Primeira rota que
**grava** dado no sistema, então a revisão olhou principalmente autorização, entrada e
integridade do armazenamento.

Nenhum achado CRÍTICO ou ALTO. A integração com o Google Sheets (conta de serviço,
chave privada em variável de ambiente) saiu do código — um segredo a menos para guardar.

## Controles do cadastro

- **Autorização:** consultar exige login; `POST`/`PUT`/`DELETE` exigem papel `EDITOR`
  (`EDITOR_EMAILS`) ou `ADMIN`. O papel vem do servidor, nunca do cliente; o botão
  escondido no front é só conveniência. 401 sem token testado em todas as rotas.
- **Entrada:** `z.strictObject` — campo fora do formulário (ex.: `updatedBy`) é recusado;
  textos com limite de tamanho, espaços colapsados e caracteres de controle recusados;
  números inteiros com teto; base só entre as três operacionais; `id` precisa ser UUID.
  Corpo JSON limitado a 10 kB.
- **Regras de negócio:** código + base único (409), alerta ≥ mínimo (422), teto de
  5.000 itens (422) contra crescimento indevido do arquivo.
- **Abuso:** rate limit próprio de gravação (30/min por IP), além do geral.
- **Integridade:** gravação atômica (temporário + `rename`); arquivo ilegível lança
  500 `STOCK_CONTROL_STORE_UNREADABLE` e **bloqueia** gravações em vez de virar cadastro
  vazio (testado). Leitura-alteração-gravação é síncrona dentro de uma requisição, então
  duas gravações simultâneas não se intercalam no processo único.
- **Auditoria:** cada item guarda `updatedBy`/`updatedAt` do servidor (o cliente não
  consegue forjar) e o log registra "código X / base Y alterado por e-mail".
- **Saída:** a exportação CSV do cadastro passa pela mesma neutralização de fórmula
  das outras exportações (o campo "item" é texto livre). React escapa o texto na tela.
- **CSRF:** não se aplica — a API autentica por cabeçalho `Authorization`, sem cookie.
- **Semente:** `stock-controls.seed.json` foi gerada da planilha oficial sem as colunas
  de autoria (`update by`/`update at` viram só a data; nenhum e-mail no repositório). O
  único nome de pessoa é o do **comprador responsável** (4 nomes curtos), que é campo de
  negócio do cadastro e foi incluído a pedido da área.
- **Dependências novas no front:** `react-hook-form`, `@hookform/resolvers`, `zod` — sem
  vulnerabilidade conhecida em `npm audit --omit=dev`. Os avisos restantes do `npm audit`
  são de ferramentas de desenvolvimento (vite/vitest/esbuild do servidor de dev), não
  entram no build de produção.

## Riscos aceitos

| Severidade | Item | Observação |
|---|---|---|
| BAIXA | E-mail de quem alterou fica visível para todo usuário logado | Usuários são do mesmo domínio; é o mesmo critério do cadastro de supervisores da agenda |
| BAIXA | Sem teste automatizado de 403 para VIEWER (exigiria simular o Google) | Lógica de papel é uma comparação de ranking em `auth.middleware.ts`; conferida manualmente |
| INFO | Volume obrigatório em produção | Sem volume o cadastro volta para a planilha oficial a cada deploy — documentado no README e já declarado no `docker-compose.yml` |

---

# Correção de confiabilidade — queda do processo por conexão derrubada (04/11/2026)

**Sintoma:** o servidor encerrou sozinho no meio da carga com `exceção não capturada —
read ECONNRESET`. Em produção isso derruba o contêiner, e ele volta refazendo a carga
inteira contra o ERP.

**Causa (reproduzida):** quando a conexão com o Voalle cai **durante** uma consulta, o
`pg` (8.23) rejeita a consulta (isso já era tratado) **e** emite `error` no client.
Enquanto a conexão está em uso o pool não escuta esse evento, e `error` sem ouvinte
derruba o Node. O gatilho provável são as consultas pesadas: elas ficam minutos sem
trafegar nada enquanto o banco calcula, e firewall/NAT no caminho derruba conexão
"parada".

**Correção** (`server/src/database/voalle.client.ts`):

- `queryVoalle` escuta `error` na conexão enquanto ela está em uso. A fonte só falha, a
  carga segue e a tela mantém o dado anterior.
- A conexão quebrada é descartada em vez de voltar ao pool.
- TCP keepalive ligado (30 s) no Voalle e no MariaDB, para o caminho não derrubar a
  conexão parada.

**Verificação:** um retransmissor TCP local reseta a conexão no meio de um `pg_sleep(3)`.

- Antes: exceção não capturada.
- Depois: a consulta falha com erro tratado, a seguinte funciona e o processo continua.
- O mesmo teste no MariaDB e com conexão ociosa já passava.
- Erro de SQL comum e 25 consultas seguidas: sem vazamento de ouvinte.
- Carga completa real: 12 fontes ok.

---

# Administração: usuários, permissões e log de edições (04/11/2026)

Tela só para administradores (`/administracao`), no desenho da aba de acessos da
dashboard IA: quem entrou no painel, quem está online, último login/acesso, a permissão
de cada um (Padrão, Edição, Admin) e o log de edições. Substitui as listas
`EDITOR_EMAILS`/`ADMIN_EMAILS` como fonte de permissão.

## Controles

- **Autorização no servidor:** a permissão vem do cadastro de usuários e é conferida a
  cada requisição (`requireAuth({ role })`); o botão escondido no front é só conveniência.
  `GET/PATCH /api/v1/users` e `GET /api/v1/audit-events` exigem Admin; as gravações do
  controle de estoque exigem Edição. 401 sem token testado em todas as rotas novas.
- **Sem escalada por conta própria:** só um Admin troca permissões; o corpo da troca é
  `z.strictObject({ role })` com os três valores aceitos; o e-mail do caminho é validado.
- **Sem trancar a instalação:** não dá para tirar o último Admin (422). `ADMIN_EMAILS`
  só promove enquanto não houver nenhum Admin salvo — um e-mail dessa lista que entre
  depois não vira Admin sozinho (mesma correção já feita na dashboard IA).
- **Cadastro ilegível:** não é sobrescrito; enquanto isso vale permissão provisória
  (admin de fábrica = Admin, o resto = Padrão), sem gravar nada.
- **Log de edições:** quem, quando, o quê e o valor antes/depois; as últimas 5.000 ações.
  Falha ao gravar o log não desfaz a alteração (já gravada) — fica registrada no log do
  servidor.
- **Dados pessoais:** nome, e-mail e foto do Google de quem entrou, e horários de acesso.
  Ficam no volume de dados e só administradores veem.

## Riscos aceitos

| Severidade | Item | Observação |
|---|---|---|
| BAIXA | "Online" é aproximado (alguma requisição nos últimos 2,5 min) | Aba escondida para de consultar e aparece offline — mesmo critério da dashboard IA |
| BAIXA | Sem teste automatizado de 403 por permissão (exigiria simular o Google) | Regras de papel e do último admin cobertas em `server/test/users.test.ts` |

---

# Compras · Lançamento e saldos — leitura do ERP a cada minuto (04/11/2026)

Nova aba (Power BI "CMP - Lançamento e Saldos") com duas consultas relidas a cada
minuto, fora da carga horária.

## Controles

- **Carga no ERP:** as duas consultas levam ~1 s juntas (medido em 04/11/2026: saldo
  ~0,5–0,9 s, pedidos ~0,3 s). Rodam em sequência, numa conexão só do pool de três (a
  carga horária usa no máximo duas por vez), em transação `READ ONLY` com
  `statement_timeout` de 45 s. Uma rodada nunca encavala na outra (a próxima é agendada
  quando a anterior termina, com folga mínima de 5 s), e o intervalo não aceita menos
  de 30 s (`LIVE_REFRESH_INTERVAL_MS`).
- **Sem entrada do usuário no SQL:** a única variável da consulta é a data de corte da
  configuração (`PURCHASE_ORDERS_SINCE`, validada como AAAA-MM-DD), passada como
  parâmetro. Os filtros da tela são aplicados em memória.
- **Mesma autenticação das outras telas:** `GET /api/v1/reports/purchase-orders` e as
  três exportações exigem login (401 testado). Seleção validada com zod (tamanho e
  quantidade de valores). Exportação com o rate limit próprio de exportação e CSV com
  neutralização de fórmula.
- **Polling da tela:** a cada 15 s, por pessoa com a aba aberta, só a situação das fontes
  (`/data-sources`, poucos KB). As tabelas (~160 KB comprimidas) são baixadas de novo
  só quando a versão do dado de Compras muda — e ela só muda quando a leitura do minuto
  trouxe algo diferente (impressão digital SHA-1 de cada leitura). A resposta sai do
  cache do servidor, que não é invalidado nas outras telas. Conta no rate limit geral.
- **Falha:** fonte que falha mantém a última leitura boa; o topo e a capa mostram a
  falha. O log registra a primeira leitura, as falhas e a volta da falha (não uma linha
  por minuto).
- **Dados pessoais:** nome do solicitante e do fornecedor (pessoa física aparece como
  fornecedor). Os mesmos campos que o Power BI mostrava; nenhum documento ou contato.

## Riscos aceitos

| Severidade | Item | Observação |
|---|---|---|
| BAIXA | ~1.440 leituras por dia no ERP (2 consultas por minuto) | ~1 s por minuto em uma conexão; ajustável por `LIVE_REFRESH_INTERVAL_MS` |
| BAIXA | Tabelas de até 1.000 linhas baixadas a cada mudança do dado (no máximo 1 vez por minuto por aba); na tela do laboratório, sem limite (~43 mil eventos, decisão da área) | Resposta comprimida (gzip) e vinda do cache; o CSV leva o recorte inteiro; a tabela do laboratório desenha só as linhas à vista |

---

# Controle · Equipamentos para campo (04/11/2026)

Nova aba (Power BI "CTR - Movimentação Equipamentos para Campo") na carga horária.

- **Duas consultas novas, só leitura**, na mesma carga e no mesmo pool das outras
  (medidas em 04/11/2026: ~3,4 s e ~2,1 s). Parâmetros: a lista de modelos
  (`FIELD_EQUIPMENT_MODELS`, fixa no código) e a data de corte da configuração
  (`FIELD_EQUIPMENT_SINCE`, validada como AAAA-MM-DD). Nada vindo da requisição chega
  ao SQL; os filtros da tela são em memória.
- **Mesma autenticação e validação** das outras telas: `GET /api/v1/reports/field-equipment`
  e as duas exportações exigem login (401 testado); seleção validada com zod;
  exportação com rate limit próprio e CSV com neutralização de fórmula.
- **Dados pessoais:** a descrição da ocorrência traz o nome de quem recebeu o
  equipamento ("Sob Responsabilidade de …"), como no Power BI. Nenhum outro dado de
  pessoa é lido.

---

# Em carga · Patrimônios e Produtos & Cabos (04/11/2026)

Duas abas novas (Power BI "LOG - Objetos em Carga") na carga horária. Substituem a tela
"Tecnologia · Patrimônios em carga", que tinha sido migrada de uma versão antiga e saiu
inteira (consulta, rota, tela e exportação).

- **Duas consultas novas, só leitura, sem parâmetro** (medidas em 04/11/2026: ~1 s e
  ~2 s), na mesma carga e no mesmo pool das outras. Filtros da tela em memória.
- **Mesma autenticação** das outras telas: `GET /api/v1/reports/charged-patrimonies`,
  `GET /api/v1/reports/charged-products` e as duas exportações exigem login (401
  testado); exportação com rate limit próprio e CSV com neutralização de fórmula.
- **Dados pessoais:** nome e cidade de quem tem patrimônio ou produto em carga — os
  mesmos campos que o Power BI mostrava; a cidade só vira a base, não aparece na tela.
- **Sem planilha:** a planilha Google de equipes do relatório original não é lida.

# Gerencial · seção de acesso restrito (05/11/2026)

Seis telas do Power BI "LOG - Gerencial", visíveis só para quem um administrador liberou.

- **Autorização no servidor, não só na tela:** todas as rotas `/api/v1/management-reports/*`
  passam por `requireAuth({ management: true })` — sem acesso é **403**
  (`AUTH_MANAGEMENT_FORBIDDEN`), sem login é **401** (testado). Admin sempre tem acesso; o
  acesso dos outros fica em `users.json` (`managementAccess`) e só um admin troca
  (`PATCH /users/:email`, com rate limit de escrita, confirmação na tela e registro no log).
  Cadastro legado sem o campo = sem acesso (falha fechada).
- **Sem vazamento pelo resto da API:** `/data-sources` tira as fontes da seção para quem
  não tem acesso (nem nome, nem quantidade de linhas); no front a linha de abas, os cartões
  da capa e as rotas nem são montados.
- **Lista da produtividade:** `GET/PUT /productivity-staff` só para administradores; corpo
  validado (até 100 nomes de até 120 caracteres, objeto estrito); troca registrada no log
  com quem entrou e quem saiu.
- **Consultas:** seis novas, só leitura, com parâmetros (`$1...`, listas por `= ANY`), na
  carga horária e no mesmo pool. A dos ZTE usados foi reescrita com funções de janela: a
  forma direta (subconsulta por linha) passava de 90 s; a nova leva ~8 s e confere com a
  regra original.
- **Dados pessoais:** nomes de quem lançou romaneio (produtividade) e de quem entregou/
  recebeu flat (só para filtrar) — os mesmos do Power BI, agora restritos à seção.

# Laboratório · Entrada e saída (06/11/2026)

Aba nova (Power BI "LAB - Produtividade Laboratório") em Outras áreas, na carga horária.

- **Duas consultas novas, só leitura:** `lab_events.sql` (~53 s, a lógica do Power BI
  sem mudança, com a data de início como parâmetro) e `lab_backlog.sql` (~28 s, sem
  parâmetro). Medidas com `statement_timeout` antes de entrar na carga; rodam na mesma
  conexão de atividade das outras.
- **Mesma autenticação** das outras telas: `GET /api/v1/reports/lab-movements` e as três
  exportações exigem login (401 testado); exportação com rate limit e CSV com
  neutralização de fórmula.
- **Dados pessoais:** nenhum — o usuário que lançou a ocorrência (o "fornecedor" do Power
  BI, que a aba não usava) saiu da consulta. Patrimônio, serial e item são cadastro de
  equipamento.
- **Sem planilha:** a planilha Google de apontamentos do laboratório (abas ocultas do
  relatório) não é lida.

