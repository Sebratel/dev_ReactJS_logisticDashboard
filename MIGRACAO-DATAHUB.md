# Migração para o Data Hub — tabelas e consultas

Tudo o que precisa ser cadastrado no Data Hub para este painel: as **tabelas** que
entram como fontes ([seção 2](#2-tabelas-para-adicionar-como-fontes)) e as **consultas**
prontas para os conjuntos calculados ([seção 3](#3-consultas-conjuntos-calculados)).

Hoje o servidor consulta o Voalle e o MariaDB direto (`server/src/sources/sql/*.sql`).
Depois da migração ele lê **conjuntos calculados do Data Hub** pelo endpoint público
`/api/public/v1/datasets/<slug>/rows`, e todo filtro de negócio, medida e cálculo fica
no app.

```
Voalle / MariaDB ──> 23 FONTES (tabelas puras no lake) ──> 22 CONJUNTOS calculados (DuckDB)
                                                                  │
                                         app: /rows?token=… ──────┘  filtros, medidas e regras
```

**Princípio usado nos conjuntos:** eles juntam as tabelas e entregam colunas limpas,
mas **não filtram regra de negócio**: datas de corte da tela, listas de pessoas
(almoxarifado, responsáveis, contas internas), empresa/base e situação ficam no app,
em `server/src/model/business-rules.ts`. Almoxarife novo, base nova ou outro corte de
data mudam só no app, sem mexer no Data Hub. O que ficou no SQL é o que **define o
registro** (ex.: "romaneio de produto" é movimentação de `service_products.type = 1`)
e um piso de volume (ver [Decisões](#decisões)).

---

## 1. Passo a passo

1. **Conexão do MariaDB da Senior.** A tabela `db_senior_collaborators` está no banco
   `API_WebDeveloper`. A conexão fixa "Massivas (MariaDB)" do Data Hub só lista as
   tabelas do banco configurado nela (`DB_MARIA_DATABASE`), que no `.env` compartilhado
   é outro. Se a tabela não aparecer em Conexões › Massivas, cadastre uma **conexão
   gerenciada** para o mesmo servidor MariaDB com o banco `API_WebDeveloper`.
2. **Publique as 23 fontes** da [seção 2](#2-tabelas-para-adicionar-como-fontes). Dê a cada uma
   **exatamente o nome da tabela** (ex.: `invoice_notes`): o SQL dos conjuntos cita as
   fontes pelo apelido com underscore, que sai desse nome. Publique as colunas listadas.
   Um calculado só enxerga coluna publicada, e coluna faltando dá erro na prévia.
   - Se a tabela **já existe** no Data Hub com outro nome, reaproveite: confira as
     colunas e troque o apelido nas consultas que a usam.
3. **Sincronize** e use *Administração › Padronizar atualização*. Ele propõe a chave
   incremental e a identidade de cada fonte. Publique também as colunas que ele pedir
   como chave (ex.: `modified`). A view do saldo não tem chave e fica em *snapshot*.
4. **Crie os 22 conjuntos calculados** da [seção 3](#3-consultas-conjuntos-calculados): em
   *Conjuntos › Novo calculado*, cole a consulta **inteira**. Os comentários do topo
   podem ir junto, porque o Data Hub os ignora. Use o slug sugerido: é por ele
   que o app vai ler.
5. **Gere um token de integração** com escopo nos 22 conjuntos. O token **não** vem
   pelo chat: ele entra como `DATAHUB_TOKEN` na stack do Portainer (e no `.env` local),
   junto com `DATAHUB_URL` (endereço **interno** do Data Hub; o nome público bloqueia por
   origem de servidor para servidor).
6. Com os conjuntos materializados, o app troca as consultas diretas pelo Data Hub
   (ver [seção 6](#6-o-que-muda-no-app)).

---

## 2. Tabelas para adicionar como fontes

Voalle = conexão **ELLEVEN (ERP)**, schema `erp`. Linhas = estimativa do Postgres
(nov/2026).

| # | Fonte (tabela) | Linhas | Colunas a publicar | Usada nas consultas |
|---|---|---:|---|---|
| 1 | `v_company_place_business_units_movimentations` **(VIEW)** | ~110 mil | `company_place_id`, `company_place_business_unit_id`, `service_product_id`, `disponible` | 01, 11 |
| 2 | `company_place_business_units` | 19 | `id`, `description`, `company_place_id`, `deleted` | 01, 03, 08, 09, 10, 11, 18, 21 |
| 3 | `service_products` | 5,9 mil | `id`, `code`, `title`, `type`, `generate_patrimony`, `minimum_inventory`, `inventory_update`, `first_unit`, `active`, `deleted` | 01, 02, 03, 06, 08, 09, 10, 11, 12, 15, 16, 18, 21 |
| 4 | `product_acquisition_requests` | 16 mil | `id`, `status`, `deleted`, `date`, `receipt_date_prevision`, `observation`, `person_id`, `supplier_id`, `total_request` | 02, 12 |
| 5 | `product_acquisition_request_items` | 38 mil | `id`, `product_acquisition_request_id`, `service_product_id`, `units`, `unit_amount`, `item_amount`, `total_amount` | 02, 12 |
| 6 | `people` | 308 mil | `id`, `name`, `city` | 02, 06, 07, 08, 09, 10, 12, 15, 16, 18, 19 |
| 7 | `patrimonies_pending_generations` | 2,8 mil | `id`, `invoice_note_id`, `service_product_id`, `company_place_business_unit_id`, `date`, `units`, `balance` | 03 |
| 8 | `invoice_notes` | **9,9 mi** | `id`, `document_number`, `status`, `created`, `issue_date` | 03, 06, 08 |
| 9 | `users` | 2,6 mil | `id`, `name`, `active`, `synsuite_code` | 04, 08, 09, 18, 20 |
| 10 | `person_product_movimentations` | 1,8 mi | `id`, `parent_id`, `assignment_id`, `person_id`, `service_product_id`, `first_units_measure_id`, `invoice_note_id`, `company_place_business_unit_id`, `units`, `signal`, `created`, `created_by`, `unit_amount` | 06, 08, 16, 18 |
| 11 | `units_measures` | — | `id`, `title` | 06, 11, 12, 16 |
| 12 | `assignments` | 2,3 mi | `id`, `title`, `region_id` | 06 |
| 13 | `regions` | 30 | `id`, `title` | 06 |
| 14 | `patrimony_packing_list_items` | 1,1 mi | `id`, `patrimony_packing_list_id`, `patrimony_id`, `person_allocator_id`, `created`, `out_date`, `returned`, `returned_date` | 07 |
| 15 | `patrimony_packing_lists` | 495 mil | `id`, `assignment_id`, `responsible_id`, `authentication_site_id` | 07 |
| 16 | `assignment_incidents` | 1,9 mi | `assignment_id`, `protocol` | 07 |
| 17 | `patrimonies` | 216 mil | `id`, `title`, `serial_number`, `tag_number`, `service_product_id`, `company_place_business_unit_id`, `person_id`, `p_is_disponible`, `last_occurrence_description`, `purchase_amount`, `modified`, `active`, `deleted` | 07, 09, 10, 13, 14, 15, 19, 21 |
| 18 | `authentication_sites` | 198 | `id`, `title` | 07 |
| 19 | `patrimony_occurrences` | 2,6 mi | `id`, `patrimony_id`, `occurrence_type`, `title`, `description`, `created`, `date`, `created_by` | 09, 10, 13, 14, 17, 20, 21, 22 |
| 20 | `db_senior_collaborators` (MariaDB, banco `API_WebDeveloper`) | ~2,5 mil | `name`, `registration`, `operational_base`, `team` | 05 |
| 21 | `v_internal_movimentations_products` **(VIEW)** | ~40 mil com saldo | `service_product_id`, `person_id`, `person_product_movimentation_id`, `first_units_measure_id`, `actual_balance` | 16 |
| 22 | `people_teams` | — | `person_id`, `team_id` | 18 |
| 23 | `teams` | — | `id`, `title` | 18 |

Pontos de atenção:

- **`invoice_notes` é a maior (9,9 mi)**: a primeira sincronização demora. Depois,
  incremental. Ela (e `assignments`, `assignment_incidents`, `people`) talvez já esteja
  no Data Hub por causa de outros painéis: reaproveite.
- **Views do Voalle:** das quatro usadas hoje, duas viram fonte — a do saldo e a de
  movimentação interna (saldo de produto com cada pessoa, conjunto 16; *snapshot*, como
  a do saldo):
  - `v_users` é `users` sem `synsuite_code`. O conjunto 08 faz esse filtro sobre
    a fonte `users`.
  - `v_allocated_products` (a consulta de ~7 min) foi **reescrita** no conjunto 06
    sobre `person_product_movimentations` e cadastros. No lake isso leva segundos, e a
    fonte pode ser incremental, o que a view não permite.
  - `v_company_place_business_units_movimentations` (saldo) **é publicada como
    fonte**. Recriá-la exigiria mais 9 tabelas, entre elas o histórico inteiro de
    movimentação de estoque e as notas provisórias, e uma mudança da regra de saldo no
    Voalle passaria despercebida. Por ser view, a sincronização é sempre completa
    (*snapshot*). Ela tem ~110 mil linhas e leva poucos segundos.
- **Colunas com dado pessoal:** `people.name`/`city` e `users.name` são o mínimo que as
  telas mostram (técnico, recebedor, cliente, cidade). Não publique outras colunas de
  `people` (documento, telefone, e-mail). Se o Data Hub permitir, marque `people.city`
  como sensível para quem explora a fonte.

---

## 3. Consultas (conjuntos calculados)

Cada consulta tem no topo um comentário com o que ela substitui, o grão, as fontes
e o que o app faz depois de carregar. Cole a consulta inteira, com o comentário.

| Consulta | Slug sugerido | Substitui (consulta atual) | Linhas | Cadência |
|---|---|---|---:|---|
| [01](#consulta-01-logistica-saldo-estoque) | `logistica-saldo-estoque` | Saldo Voalle | ~110 mil | hora em hora |
| [02](#consulta-02-logistica-pedidos-compra) | `logistica-pedidos-compra` | Pedidos Compra | ~40 mil | hora em hora |
| [03](#consulta-03-logistica-objetos-pendentes) | `logistica-objetos-pendentes` | Objetos Pendentes | ~3 mil | hora em hora |
| [04](#consulta-04-logistica-usuarios) | `logistica-usuarios` | Usuários | ~2,6 mil | diária |
| [05](#consulta-05-logistica-colaboradores-senior) | `logistica-colaboradores-senior` | Base_Senior | ~2,5 mil | diária |
| [06](#consulta-06-logistica-alocacao-produtos) | `logistica-alocacao-produtos` | Consumo Produtos | ~730 mil | hora em hora |
| [07](#consulta-07-logistica-alocacao-patrimonios) | `logistica-alocacao-patrimonios` | Consumo Patrimônios | ~570 mil | hora em hora |
| [08](#consulta-08-logistica-romaneio-produtos) | `logistica-romaneio-produtos` | Romaneio Produtos/Cabos | ~780 mil | hora em hora |
| [09](#consulta-09-logistica-romaneio-patrimonios) | `logistica-romaneio-patrimonios` | Romaneio de Patrimônios **e** Notas Romaneio Patrimônios | ~400 mil | hora em hora |
| [10](#consulta-10-logistica-status-patrimonios) | `logistica-status-patrimonios` | Status Real Patrimonio | ~200 mil | hora em hora |
| [11](#consulta-11-compras-saldo-itens) | `compras-saldo-itens` | Produtos (Power BI "CMP - Lançamento e Saldos") | ~110 mil | ver decisão 6 |
| [12](#consulta-12-compras-pedidos-itens) | `compras-pedidos-itens` | Pedido de Compra (Power BI "CMP - Lançamento e Saldos") | ~40 mil | ver decisão 6 |
| [13](#consulta-13-equipamentos-campo-novos) | `equipamentos-campo-novos` | PRIMEIRO VÍNCULO (Power BI "CTR - Movimentação Equipamentos para Campo") | ~220 mil | hora em hora |
| [14](#consulta-14-equipamentos-campo-usados) | `equipamentos-campo-usados` | ÚLTIMO VÍNCULO (Power BI "CTR - Movimentação Equipamentos para Campo") | ver seção 5 | hora em hora |
| [15](#consulta-15-logistica-patrimonios-em-carga) | `logistica-patrimonios-em-carga` | DASH_ATUAL_TECNICOS (Power BI "LOG - Objetos em Carga") | ~21 mil | hora em hora |
| [16](#consulta-16-logistica-produtos-em-carga) | `logistica-produtos-em-carga` | DASH_ATUAL_CONSUMOS (Power BI "LOG - Objetos em Carga") | ~40 mil | hora em hora |
| [17](#consulta-17-gerencial-objetos-criados) | `gerencial-objetos-criados` | OBJETOS CRIADOS (Power BI "LOG - Gerencial") | ~1,5 mil (dias) | hora em hora |
| [18](#consulta-18-gerencial-consumo-flat) | `gerencial-consumo-flat` | Consumo Voalle (Power BI "LOG - Gerencial") | ~45 mil | hora em hora |
| [19](#consulta-19-gerencial-equipamentos-obsoletos) | `gerencial-equipamentos-obsoletos` | EQUIPAMENTO OBSOLETOS (Power BI "LOG - Gerencial") | ~1,2 mil | hora em hora |
| [20](#consulta-20-gerencial-produtividade-almox) | `gerencial-produtividade-almox` | QuantidadeRomaneios (Power BI "LOG - Gerencial") | ~15 mil | hora em hora |
| [21](#consulta-21-laboratorio-eventos) | `laboratorio-eventos` | general (Power BI "LAB - Produtividade Laboratório") | ~45 mil | a cada 3 horas |
| [22](#consulta-22-laboratorio-backlog) | `laboratorio-backlog` | backlog (Power BI "LAB - Produtividade Laboratório") | ~350 | a cada 3 horas |

**Seção Gerencial (Power BI "LOG - Gerencial"):** as ONUs ZTE **novas** e **usadas** não
têm conjunto próprio: são o 13 (primeiro "Enviado em Romaneio" de cada patrimônio) e o
14 (voltas ao almoxarifado depois do laboratório, agora com a coluna `origin`) — os
mesmos registros das consultas "PRIMEIRO VÍNCULO" e "ÚLTIMO VÍNCULO"/"USADOS
CLASSIFICADO" do Gerencial; o app soma por dia, modelo e origem.

Cadência: prefira **hora em hora** (agendamento) a *cascata* nos conjuntos de
movimento. As fontes deles sincronizam com frequência, e em cascata o recálculo
pesado rodaria a cada sincronização (a documentação de SQL do próprio Data Hub explica
isso no item 7).

### Consulta 01: logistica-saldo-estoque

```sql
-- =============================================================================
-- LOGÍSTICA · SALDO DE ESTOQUE            conjunto calculado: logistica-saldo-estoque
--
-- Substitui a consulta "Saldo Voalle" (server/src/sources/sql/stock_balances.sql).
-- Grão: produto x base (unidade de negócio), com o saldo disponível calculado
-- pela própria view de saldo do Voalle.
--
-- Fontes: v_company_place_business_units_movimentations (VIEW publicada como
--         fonte — ver README), company_place_business_units, service_products.
--
-- Abrangente: todas as empresas e bases, inclusive excluídas. O app aplica,
-- depois de carregar:
--   * só produto com título (product_title não nulo);
--   * só a empresa 1 (company_place_id = 1);
--   * sem a base 'PROJETO NHO' e sem base excluída (base_deleted);
--   * item_type = PATRIMONY quando generate_patrimony, senão PRODUCT.
-- is_active / is_deleted (cadastro do produto) viram os filtros "Ativo?" e
-- "Deletado?" do alerta de PRODUTOS (Sim/Não); no de patrimônios eles saem do
-- cadastro de cada patrimônio (consulta 10).
--
-- Volume: ~60–110 mil linhas. Cadência sugerida: de hora em hora.
-- =============================================================================
SELECT
    sp.code                                            AS product_code,
    TRY_CAST(sp.id AS INTEGER)                         AS product_id,
    sp.title                                           AS product_title,
    cpbu.description                                   AS base_name,
    TRY_CAST(v.company_place_id AS INTEGER)            AS company_place_id,
    -- booleano robusto: no lake ele pode chegar como true, 'true' ou 1.0
    CASE WHEN cpbu.deleted IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(cpbu.deleted AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(cpbu.deleted AS VARCHAR) AS DOUBLE) <> 0) END
                                                       AS base_deleted,
    CAST(v.disponible AS DOUBLE)                       AS available_units,
    CAST(sp.minimum_inventory AS DOUBLE)               AS minimum_inventory,
    CASE WHEN sp.generate_patrimony IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(sp.generate_patrimony AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(sp.generate_patrimony AS VARCHAR) AS DOUBLE) <> 0) END
                                                       AS generate_patrimony,
    CASE WHEN sp.active IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(sp.active AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(sp.active AS VARCHAR) AS DOUBLE) <> 0) END
                                                       AS is_active,
    CASE WHEN sp.deleted IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(sp.deleted AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(sp.deleted AS VARCHAR) AS DOUBLE) <> 0) END
                                                       AS is_deleted
FROM v_company_place_business_units_movimentations v
LEFT JOIN company_place_business_units cpbu ON cpbu.id = v.company_place_business_unit_id
LEFT JOIN service_products sp ON sp.id = v.service_product_id
```

### Consulta 02: logistica-pedidos-compra

```sql
-- =============================================================================
-- LOGÍSTICA · PEDIDOS DE COMPRA           conjunto calculado: logistica-pedidos-compra
--
-- Substitui a consulta "Pedidos Compra" (purchase_requests.sql).
-- Grão: item de pedido de aquisição (pedido x produto). O DISTINCT reproduz o
-- GROUP BY do Power BI: o mesmo produto com a mesma quantidade repetido no
-- mesmo pedido conta uma vez.
--
-- Fontes: product_acquisition_requests, product_acquisition_request_items,
--         service_products, people.
--
-- Abrangente: todos os pedidos, de qualquer situação. O app aplica:
--   * status = 4 (aprovado, aguardando entrega) e deleted = false;
--   * a base pelo CEP escrito na observação (93120 = São Leopoldo,
--     92010 = Canoas, 90230 = Sede) — pedido sem CEP reconhecido sai;
--   * ordem: request_date mais recente primeiro.
--
-- Volume: ~40 mil linhas. Cadência sugerida: de hora em hora.
-- =============================================================================
SELECT DISTINCT
    TRY_CAST(par.id AS INTEGER)                                         AS request_id,
    TRY_CAST(par.status AS INTEGER)                                     AS status,
    CASE WHEN par.deleted IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(par.deleted AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(par.deleted AS VARCHAR) AS DOUBLE) <> 0) END
                                                                        AS deleted,
    sp.code                                                             AS product_code,
    sp.title                                                            AS product_title,
    strftime(TRY_CAST(par.date AS DATE), '%Y-%m-%d')                    AS request_date,
    p.name                                                              AS requested_by,
    strftime(TRY_CAST(par.receipt_date_prevision AS DATE), '%Y-%m-%d')  AS expected_date,
    CAST(pari.units AS DOUBLE)                                          AS units,
    par.observation                                                     AS observation
FROM product_acquisition_requests par
LEFT JOIN product_acquisition_request_items pari ON pari.product_acquisition_request_id = par.id
LEFT JOIN service_products sp ON sp.id = pari.service_product_id
LEFT JOIN people p ON p.id = par.person_id
```

### Consulta 03: logistica-objetos-pendentes

```sql
-- =============================================================================
-- LOGÍSTICA · OBJETOS PENDENTES           conjunto calculado: logistica-objetos-pendentes
--
-- Substitui a consulta "Objetos Pendentes" (pending_patrimonies.sql).
-- Grão: item comprado aguardando virar patrimônio (geração pendente).
--
-- Fontes: patrimonies_pending_generations, invoice_notes, service_products,
--         company_place_business_units.
--
-- Abrangente: todas as gerações, inclusive as já concluídas. O app aplica:
--   * pending_units diferente de 0 e de -1 (o Power Query descartava os dois).
--
-- Volume: ~3 mil linhas. Cadência sugerida: de hora em hora.
-- =============================================================================
SELECT
    -- número da nota como texto limpo: no lake o número chega como DOUBLE
    -- e um CAST direto viraria '123456.0'
    CAST(TRY_CAST(t.document_number AS BIGINT) AS VARCHAR)  AS invoice_number,
    strftime(TRY_CAST(ppg.date AS DATE), '%Y-%m-%d')        AS entry_date,
    sp.code                                                 AS product_code,
    sp.title                                                AS product_title,
    CAST(ppg.units AS DOUBLE)                               AS total_units,
    CAST(ppg.balance AS DOUBLE)                             AS pending_units,
    cpbu.description                                        AS base_name
FROM patrimonies_pending_generations ppg
LEFT JOIN invoice_notes t ON t.id = ppg.invoice_note_id
LEFT JOIN service_products sp ON sp.id = ppg.service_product_id
LEFT JOIN company_place_business_units cpbu ON cpbu.id = ppg.company_place_business_unit_id
```

### Consulta 04: logistica-usuarios

```sql
-- =============================================================================
-- LOGÍSTICA · USUÁRIOS                    conjunto calculado: logistica-usuarios
--
-- Substitui a consulta "Usuários" (users.sql). Alimenta o filtro "técnico
-- ativo?", que casa pelo NOME (o mesmo nome pode aparecer ativo e inativo).
--
-- Fontes: users.
--
-- Volume: ~2,6 mil linhas. Cadência sugerida: diária.
-- =============================================================================
SELECT DISTINCT
    u.name                                                            AS name,
    CASE WHEN u.active IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(u.active AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(u.active AS VARCHAR) AS DOUBLE) <> 0) END
                                                                      AS active
FROM users u
WHERE u.name IS NOT NULL
```

### Consulta 05: logistica-colaboradores-senior

```sql
-- =============================================================================
-- LOGÍSTICA · COLABORADORES (SENIOR)      conjunto calculado: logistica-colaboradores-senior
--
-- Substitui a consulta "Base_Senior" (senior_collaborators.sql). Dá a base
-- operacional e a equipe do responsável pelo patrimônio, casando pelo nome.
--
-- Fontes: db_senior_collaborators (MariaDB, banco API_WebDeveloper — ver
--         README: provavelmente precisa de uma conexão gerenciada própria).
--
-- Abrangente: todas as matrículas. O app aplica:
--   * uma linha por nome: a de maior matrícula (registration).
--
-- Volume: ~3 mil linhas. Cadência sugerida: diária.
-- =============================================================================
SELECT
    sn.name                                 AS name,
    TRY_CAST(sn.registration AS INTEGER)    AS registration,
    sn.operational_base                     AS operational_base,
    sn.team                                 AS team
FROM db_senior_collaborators sn
```

### Consulta 06: logistica-alocacao-produtos

```sql
-- =============================================================================
-- LOGÍSTICA · ALOCAÇÃO DE PRODUTOS        conjunto calculado: logistica-alocacao-produtos
--
-- Substitui a consulta "Consumo Produtos" (product_allocations.sql).
-- Grão: movimentação de produto/cabo entregue a um técnico e baixada em nota.
--
-- A view v_allocated_products do Voalle (a que levava ~7 min) NÃO precisa ser
-- publicada: ela é só person_product_movimentations com quatro cadastros e a
-- soma das devoluções. Está reescrita aqui, igual à definição da view:
--   * signal <> 1 e nota fora das situações 5 e 10;
--   * técnico obrigatório (JOIN, não LEFT JOIN, com people);
--   * quantidade alocada = unidades da movimentação - soma das unidades das
--     movimentações filhas (parent_id), que são as devoluções.
--
-- Fontes: person_product_movimentations, people, service_products,
--         units_measures, invoice_notes, assignments, regions.
--
-- Abrangente: todos os técnicos, produtos e regiões. O app aplica:
--   * issue_date >= CONSUMPTION_SINCE (hoje 2024-01-01);
--   * as contas internas que não são técnico (lista em business-rules.ts);
--   * BaseGrupo pela região, cabo x produto pela lista de cabos, categoria
--     pelo cadastro de controle de estoque.
--
-- PISO DE VOLUME: a última linha do WHERE corta o que é anterior a 2024 — o
-- painel nunca mostra nada antes disso e, sem ela, o app baixaria o dobro de
-- linhas a cada carga (~1,4 mi em vez de ~730 mil). Para trazer tudo, apague
-- a linha; nada mais muda.
--
-- Volume: ~730 mil linhas. Cadência sugerida: de hora em hora (não em cascata:
-- as fontes de movimento sincronizam muito e o recálculo é pesado).
-- =============================================================================
WITH devolvido AS (
    SELECT parent_id, sum(CAST(units AS DOUBLE)) AS units
    FROM person_product_movimentations
    WHERE parent_id IS NOT NULL
    GROUP BY parent_id
)
SELECT
    TRY_CAST(m.id AS INTEGER)                                         AS allocation_id,
    resp.name                                                         AS technician,
    sp.code                                                           AS product_code,
    sp.title                                                          AS product_title,
    CAST(m.units AS DOUBLE) - coalesce(d.units, 0)                    AS allocated_units,
    um.title                                                          AS unit_measure,
    CAST(TRY_CAST(i.document_number AS BIGINT) AS VARCHAR)            AS invoice_number,
    strftime(TRY_CAST(i.created AS TIMESTAMP), '%Y-%m-%d %H:%M:%S')   AS created_at,
    strftime(TRY_CAST(i.issue_date AS DATE), '%Y-%m-%d')              AS issue_date,
    -- "Protocolo 1874780 - TEC-MANUT-... - CLIENTE": os 7 dígitos a partir da 11ª posição
    substring(a.title, 11, 7)                                         AS protocol_number,
    r.title                                                           AS region
FROM person_product_movimentations m
JOIN people resp ON resp.id = m.person_id
LEFT JOIN service_products sp ON sp.id = m.service_product_id
LEFT JOIN units_measures um ON um.id = m.first_units_measure_id
LEFT JOIN invoice_notes i ON i.id = m.invoice_note_id
LEFT JOIN devolvido d ON d.parent_id = m.id
LEFT JOIN assignments a ON a.id = m.assignment_id
LEFT JOIN regions r ON r.id = a.region_id
WHERE TRY_CAST(m.signal AS INTEGER) <> 1
  AND coalesce(TRY_CAST(i.status AS INTEGER), 0) NOT IN (5, 10)
  AND TRY_CAST(i.issue_date AS DATE) >= DATE '2024-01-01'
```

### Consulta 07: logistica-alocacao-patrimonios

```sql
-- =============================================================================
-- LOGÍSTICA · ALOCAÇÃO DE PATRIMÔNIOS     conjunto calculado: logistica-alocacao-patrimonios
--
-- Substitui a consulta "Consumo Patrimônios" (patrimony_allocations.sql).
-- Grão: saída de um patrimônio num romaneio de atendimento. O LEFT JOIN com
-- assignment_incidents é o do Power BI e repete a saída quando o atendimento
-- tem mais de um protocolo — a tela conta exatamente como lá.
--
-- Fontes: patrimony_packing_list_items, patrimony_packing_lists,
--         assignment_incidents, patrimonies, people, authentication_sites.
--
-- Abrangente: todos os patrimônios, atendimentos e pessoas. O app aplica:
--   * out_date > CONSUMPTION_SINCE (hoje 2024-01-01);
--   * returned 1 -> "Retorno", 0 -> "-".
--
-- PISO DE VOLUME: a última linha do WHERE corta o que saiu antes de 2024
-- (~570 mil linhas em vez de ~1,15 mi). Para trazer tudo, apague a linha.
--
-- Volume: ~570 mil linhas. Cadência sugerida: de hora em hora.
-- =============================================================================
SELECT
    CAST(TRY_CAST(ai.protocol AS BIGINT) AS VARCHAR)                     AS protocol_number,
    p.title                                                              AS equipment,
    p.tag_number                                                         AS patrimony_tag,
    p.serial_number                                                      AS serial_number,
    strftime(TRY_CAST(plis.created AS TIMESTAMP), '%Y-%m-%d %H:%M:%S')   AS out_at,
    strftime(TRY_CAST(plis.out_date AS DATE), '%Y-%m-%d')                AS out_date,
    TRY_CAST(plis.returned AS INTEGER)                                   AS returned,
    strftime(TRY_CAST(plis.returned_date AS DATE), '%Y-%m-%d')           AS returned_date,
    allocator.name                                                       AS allocated_by,
    holder.name                                                          AS current_holder,
    site.title                                                           AS site,
    holder.city                                                          AS city
FROM patrimony_packing_list_items plis
LEFT JOIN patrimony_packing_lists ppl ON ppl.id = plis.patrimony_packing_list_id
LEFT JOIN assignment_incidents ai ON ai.assignment_id = ppl.assignment_id
LEFT JOIN patrimonies p ON p.id = plis.patrimony_id
LEFT JOIN people allocator ON allocator.id = plis.person_allocator_id
LEFT JOIN people holder ON holder.id = ppl.responsible_id
LEFT JOIN authentication_sites site ON site.id = ppl.authentication_site_id
WHERE TRY_CAST(plis.out_date AS DATE) >= DATE '2024-01-01'
```

### Consulta 08: logistica-romaneio-produtos

```sql
-- =============================================================================
-- LOGÍSTICA · ROMANEIO DE PRODUTOS/CABOS  conjunto calculado: logistica-romaneio-produtos
--
-- Substitui a consulta "Romaneio Produtos/ Cabos" (product_packing_lists.sql).
-- Grão: movimentação de PRODUTO (service_products.type = 1) entre pessoas.
-- Quem criou a movimentação é o FORNECEDOR; a pessoa de destino, o RECEBEDOR.
-- O fornecedor sai de users sem synsuite_code — é o que a view v_users do
-- Voalle fazia, então ela também não precisa ser publicada.
--
-- Fontes: person_product_movimentations, people, service_products, users,
--         company_place_business_units, invoice_notes.
--
-- Abrangente: TODOS os fornecedores (não só o time do almoxarifado). O app
-- aplica:
--   * supplier na lista do almoxarifado (business-rules.ts — almoxarife novo
--     entra lá, sem mexer no Data Hub);
--   * created_at >= PRODUCT_PACKING_SINCE (hoje 2025-01-01);
--   * a exclusão de 04/09/2025 (carga de inventário nas contas
--     A.ALMOXARIFADO, que não é romaneio).
--
-- PISO DE VOLUME: a última linha do WHERE corta o que é anterior a 2024
-- (~780 mil linhas em vez de ~1,5 mi). Para trazer tudo, apague a linha.
--
-- Volume: ~780 mil linhas. Cadência sugerida: de hora em hora.
-- =============================================================================
SELECT DISTINCT
    TRY_CAST(m.id AS INTEGER)                                         AS movement_id,
    CAST(TRY_CAST(i.document_number AS BIGINT) AS VARCHAR)            AS document_number,
    CAST(m.units AS DOUBLE)                                           AS units,
    sp.code                                                           AS product_code,
    TRY_CAST(sp.id AS INTEGER)                                        AS product_id,
    sp.title                                                          AS product_title,
    cpbu.description                                                  AS base_name,
    strftime(TRY_CAST(m.created AS TIMESTAMP), '%Y-%m-%d %H:%M:%S')   AS created_at,
    receiver.name                                                     AS receiver,
    supplier.name                                                     AS supplier
FROM person_product_movimentations m
LEFT JOIN people receiver ON receiver.id = m.person_id
LEFT JOIN service_products sp ON sp.id = m.service_product_id
LEFT JOIN users supplier ON supplier.id = m.created_by AND supplier.synsuite_code IS NULL
LEFT JOIN company_place_business_units cpbu ON cpbu.id = m.company_place_business_unit_id
LEFT JOIN invoice_notes i ON i.id = m.invoice_note_id
WHERE TRY_CAST(sp.type AS INTEGER) = 1
  AND TRY_CAST(m.created AS TIMESTAMP) >= TIMESTAMP '2024-01-01 00:00:00'
```

### Consulta 09: logistica-romaneio-patrimonios

```sql
-- =============================================================================
-- LOGÍSTICA · ROMANEIO DE PATRIMÔNIOS     conjunto calculado: logistica-romaneio-patrimonios
--
-- Substitui DUAS consultas, que liam a mesma tabela de ocorrências:
--   * "Romaneio de Patrimônios" (patrimony_packing_lists.sql) — tela
--     Patrimônios · Romaneio;
--   * "Notas Romaneio Patrimônios" (patrimony_packing_notes.sql) — tabela
--     HISTÓRICO DE ROMANEIOS da tela de alerta de patrimônios.
-- Um conjunto só: o app baixa as ocorrências uma vez e monta as duas tabelas.
--
-- Grão: ocorrência de patrimônio cuja descrição diz "... Sob Responsabilidade
-- de FULANO." — o número do romaneio e o recebedor só existem nesse texto.
--
-- Fontes: patrimony_occurrences, patrimonies, people, service_products,
--         company_place_business_units, users.
--
-- Abrangente: todos os tipos de ocorrência, todas as pessoas e bases. O app
-- aplica, para a tela de ROMANEIO:
--   * occurrence_type = 5 (movimento técnico) e product_title não nulo;
--   * company_place_id = 1, sem 'PROJETO NHO' e sem base excluída;
--   * registered_by na lista do almoxarifado; created_at >= PATRIMONY_PACKING_SINCE;
--   * recebedor = received_by sem o ponto/espaço final.
-- e, para o HISTÓRICO DE ROMANEIOS:
--   * registered_by na lista de responsáveis; moved_date >= PATRIMONY_NOTES_SINCE;
--   * received_by não nulo e fora da lista de contas internas.
--
-- (?s) nas expressões: no Postgres o ponto casa quebra de linha; no DuckDB
-- (RE2) só com essa opção — sem ela, descrição com quebra de linha cortaria o
-- nome do recebedor.
--
-- PISO DE VOLUME: a última linha do WHERE corta o que é anterior a 2024
-- (~400 mil linhas em vez de ~780 mil). Para trazer tudo, apague a linha.
--
-- Volume: ~400 mil linhas. Cadência sugerida: de hora em hora.
-- =============================================================================
SELECT
    TRY_CAST(po.id AS INTEGER)                                          AS occurrence_id,
    TRY_CAST(po.occurrence_type AS INTEGER)                             AS occurrence_type,
    strftime(TRY_CAST(po.created AS TIMESTAMP), '%Y-%m-%d %H:%M:%S')    AS created_at,
    strftime(TRY_CAST(po.date AS DATE), '%Y-%m-%d')                     AS moved_date,
    registrar.name                                                      AS registered_by,
    TRY_CAST(p.id AS INTEGER)                                           AS patrimony_id,
    p.serial_number                                                     AS serial_number,
    p.tag_number                                                        AS patrimony_tag,
    p.title                                                             AS patrimony_title,
    holder.name                                                         AS holder,
    sp.code                                                             AS product_code,
    sp.title                                                            AS product_title,
    cpbu.description                                                    AS base_name,
    TRY_CAST(cpbu.company_place_id AS INTEGER)                          AS company_place_id,
    CASE WHEN cpbu.deleted IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(cpbu.deleted AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(cpbu.deleted AS VARCHAR) AS DOUBLE) <> 0) END
                                                                        AS base_deleted,
    nullif(regexp_extract(po.description, '(?s)N[º°][[:space:]]*([0-9]+)', 1), '')
                                                                        AS packing_number,
    nullif(regexp_extract(po.description, '(?s)Sob Responsabilidade de[[:space:]]+(.+)', 1), '')
                                                                        AS received_by
FROM patrimony_occurrences po
LEFT JOIN patrimonies p ON p.id = po.patrimony_id
LEFT JOIN people holder ON holder.id = p.person_id
LEFT JOIN service_products sp ON sp.id = p.service_product_id
LEFT JOIN company_place_business_units cpbu ON cpbu.id = p.company_place_business_unit_id
LEFT JOIN users registrar ON registrar.id = po.created_by
WHERE po.description LIKE '%Sob Responsabilidade de%'
  AND (TRY_CAST(po.date AS DATE) >= DATE '2024-01-01' OR TRY_CAST(po.created AS TIMESTAMP) >= TIMESTAMP '2024-01-01 00:00:00')
```

### Consulta 10: logistica-status-patrimonios

```sql
-- =============================================================================
-- LOGÍSTICA · STATUS DOS PATRIMÔNIOS      conjunto calculado: logistica-status-patrimonios
--
-- Substitui a consulta "Status Real Patrimonio" (patrimony_statuses.sql).
-- Grão: patrimônio, com a ÚLTIMA ocorrência registrada para ele (maior id).
--
-- O que muda em relação à consulta atual: a tradução da ocorrência em status
-- ("Aguardando Retorno", "Resp. Lab", "Disponível", ...) sai do SQL e vai para
-- o app, junto das outras regras de negócio. Aqui ficam os insumos dela:
-- tipo e título da última ocorrência, a última descrição e se o Voalle marca
-- o patrimônio como disponível.
--
-- Fontes: patrimony_occurrences, patrimonies, service_products,
--         company_place_business_units, people.
--
-- Abrangente: todas as empresas e bases. O app aplica:
--   * product_title não nulo, company_place_id = 1, sem 'PROJETO NHO' e sem
--     base excluída;
--   * current_status pela regra de status do Power BI (mesma do SQL atual);
--   * base/equipe do responsável pelo conjunto de colaboradores da Senior.
-- is_active / is_deleted (cadastro do patrimônio) viram os filtros "Ativo?" e
-- "Deletado?" do status real (Sim/Não).
--
-- Volume: ~200 mil linhas (lê as ~2,6 mi de ocorrências, mas devolve uma
-- por patrimônio). Cadência sugerida: de hora em hora.
-- =============================================================================
WITH ultima AS (
    SELECT
        po.patrimony_id,
        po.occurrence_type,
        po.title,
        row_number() OVER (PARTITION BY po.patrimony_id ORDER BY po.id DESC, po.date DESC) AS posicao
    FROM patrimony_occurrences po
)
SELECT
    TRY_CAST(sp.id AS INTEGER)                        AS product_id,
    sp.code                                           AS product_code,
    sp.title                                          AS product_title,
    p.title                                           AS patrimony_title,
    responsible.name                                  AS responsible,
    cpbu.description                                  AS base_name,
    TRY_CAST(cpbu.company_place_id AS INTEGER)        AS company_place_id,
    CASE WHEN cpbu.deleted IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(cpbu.deleted AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(cpbu.deleted AS VARCHAR) AS DOUBLE) <> 0) END
                                                      AS base_deleted,
    TRY_CAST(p.id AS INTEGER)                         AS patrimony_id,
    p.serial_number                                   AS serial_number,
    p.tag_number                                      AS patrimony_tag,
    TRY_CAST(ult.occurrence_type AS INTEGER)          AS last_occurrence_type,
    ult.title                                         AS last_occurrence_title,
    p.last_occurrence_description                     AS last_occurrence_description,
    CASE WHEN p.p_is_disponible IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(p.p_is_disponible AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(p.p_is_disponible AS VARCHAR) AS DOUBLE) <> 0) END
                                                      AS is_available,
    CASE WHEN p.active IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(p.active AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(p.active AS VARCHAR) AS DOUBLE) <> 0) END
                                                      AS is_active,
    CASE WHEN p.deleted IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(p.deleted AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(p.deleted AS VARCHAR) AS DOUBLE) <> 0) END
                                                      AS is_deleted
FROM ultima ult
JOIN patrimonies p ON p.id = ult.patrimony_id
LEFT JOIN service_products sp ON sp.id = p.service_product_id
LEFT JOIN company_place_business_units cpbu ON cpbu.id = p.company_place_business_unit_id
LEFT JOIN people responsible ON responsible.id = p.person_id
WHERE ult.posicao = 1
```

### Consulta 11: compras-saldo-itens

```sql
-- =============================================================================
-- COMPRAS · SALDO DE ITENS                    conjunto calculado: compras-saldo-itens
--
-- Substitui a consulta "Produtos" do Power BI "CMP - Lançamento e Saldos"
-- (server/src/sources/sql/item_balances.sql).
-- Grão: produto x base (unidade de negócio) x empresa, com o saldo disponível
-- da view de saldo do Voalle SOMADO (o Power BI agrupava).
--
-- Fontes: v_company_place_business_units_movimentations, company_place_business_units,
--         service_products, units_measures.
--
-- Abrangente: todas as empresas e bases, inclusive excluídas e de projeto. O app
-- aplica, depois de carregar:
--   * só produto com título (product_title não nulo);
--   * só a empresa 1 (company_place_id = 1) e sem base excluída (base_deleted);
--   * Sim/Não em updates_stock e generates_patrimony.
--
-- Volume: até ~110 mil linhas (~20 mil depois do filtro). Cadência: ver a
-- decisão 6 (a tela de Compras é atualizada a cada minuto).
-- =============================================================================
SELECT
    TRY_CAST(v.company_place_id AS INTEGER)            AS company_place_id,
    sp.code                                            AS product_code,
    sp.title                                           AS product_title,
    cpbu.description                                   AS base_name,
    CASE WHEN cpbu.deleted IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(cpbu.deleted AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(cpbu.deleted AS VARCHAR) AS DOUBLE) <> 0) END
                                                       AS base_deleted,
    um.title                                           AS unit_measure,
    CASE WHEN sp.inventory_update IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(sp.inventory_update AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(sp.inventory_update AS VARCHAR) AS DOUBLE) <> 0) END
                                                       AS updates_stock,
    CASE WHEN sp.generate_patrimony IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(sp.generate_patrimony AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(sp.generate_patrimony AS VARCHAR) AS DOUBLE) <> 0) END
                                                       AS generates_patrimony,
    SUM(CAST(v.disponible AS DOUBLE))                  AS available_units
FROM v_company_place_business_units_movimentations v
LEFT JOIN company_place_business_units cpbu ON cpbu.id = v.company_place_business_unit_id
LEFT JOIN service_products sp ON sp.id = v.service_product_id
LEFT JOIN units_measures um ON um.id = sp.first_unit
GROUP BY ALL
```

### Consulta 12: compras-pedidos-itens

```sql
-- =============================================================================
-- COMPRAS · PEDIDOS DE COMPRA (ITENS)        conjunto calculado: compras-pedidos-itens
--
-- Substitui a consulta "Pedido de Compra" do Power BI "CMP - Lançamento e Saldos"
-- (server/src/sources/sql/purchase_order_items.sql).
-- Grão: item de pedido de aquisição. Pedido sem item vem numa linha só, sem produto.
--
-- Fontes: product_acquisition_requests, product_acquisition_request_items,
--         service_products, units_measures, people (solicitante e fornecedor).
--
-- Abrangente: todos os pedidos, de qualquer data e situação, inclusive
-- cancelados e excluídos. O app aplica:
--   * order_date >= PURCHASE_ORDERS_SINCE (2026-01-01, como o Power BI);
--   * o nome do status (1 Inclusão, 2 Cancelado, 4 Aguardando Entrega, 5 Recebido);
--   * a base pelo ENDEREÇO escrito na observação (SCHARLAU = São Leopoldo,
--     VICTOR BARRETO = Canoas, NAVEGANTES = Sede) — regra deste relatório, que
--     não é a do CEP usada no conjunto 02;
--   * Sim/Não e Deletado/Não.
--
-- Volume: ~40 mil linhas. Cadência: ver a decisão 6.
-- =============================================================================
SELECT
    TRY_CAST(par.id AS INTEGER)                                         AS order_id,
    strftime(TRY_CAST(par.date AS DATE), '%Y-%m-%d')                    AS order_date,
    strftime(TRY_CAST(par.receipt_date_prevision AS DATE), '%Y-%m-%d')  AS expected_date,
    p2.name                                                             AS supplier,
    p.name                                                              AS requested_by,
    TRY_CAST(par.status AS INTEGER)                                     AS status_code,
    CASE WHEN par.deleted IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(par.deleted AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(par.deleted AS VARCHAR) AS DOUBLE) <> 0) END
                                                                        AS deleted,
    CAST(par.total_request AS DOUBLE)                                   AS order_total,
    par.observation                                                     AS observation,
    TRY_CAST(pari.id AS INTEGER)                                        AS item_id,
    sp.code                                                             AS product_code,
    sp.title                                                            AS product_title,
    um.title                                                            AS unit_measure,
    CAST(pari.units AS DOUBLE)                                          AS units,
    CAST(pari.unit_amount AS DOUBLE)                                    AS unit_amount,
    CAST(pari.item_amount AS DOUBLE)                                    AS item_amount,
    CAST(pari.total_amount AS DOUBLE)                                   AS total_amount,
    CASE WHEN sp.inventory_update IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(sp.inventory_update AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(sp.inventory_update AS VARCHAR) AS DOUBLE) <> 0) END
                                                                        AS updates_stock,
    CASE WHEN sp.generate_patrimony IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(sp.generate_patrimony AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(sp.generate_patrimony AS VARCHAR) AS DOUBLE) <> 0) END
                                                                        AS generates_patrimony
FROM product_acquisition_requests par
LEFT JOIN product_acquisition_request_items pari ON pari.product_acquisition_request_id = par.id
LEFT JOIN service_products sp ON sp.id = pari.service_product_id
LEFT JOIN units_measures um ON um.id = sp.first_unit
LEFT JOIN people p ON p.id = par.person_id
LEFT JOIN people p2 ON p2.id = par.supplier_id
```

### Consulta 13: equipamentos-campo-novos

```sql
-- =============================================================================
-- EQUIPAMENTOS PARA CAMPO · NOVOS          conjunto calculado: equipamentos-campo-novos
--
-- Substitui a consulta "PRIMEIRO VÍNCULO" do Power BI "CTR - Movimentação
-- Equipamentos para Campo" (server/src/sources/sql/field_equipment_new.sql).
-- Grão: patrimônio — o PRIMEIRO "Enviado em Romaneio" de cada um, olhando o
-- histórico inteiro (um patrimônio que saiu em 2023 não é novo em 2025).
--
-- Fontes: patrimony_occurrences, patrimonies.
--
-- Abrangente: todos os patrimônios. O app aplica, depois de carregar:
--   * só os modelos acompanhados (FIELD_EQUIPMENT_MODELS, 9 modelos);
--   * created_at >= FIELD_EQUIPMENT_SINCE (2025-01-01);
--   * a data sem a hora e a quebra de linha da descrição como espaço.
--
-- Volume: até ~220 mil linhas (um por patrimônio que já saiu em romaneio).
-- Cadência sugerida: de hora em hora.
-- =============================================================================
WITH envio AS (
    SELECT
        TRY_CAST(po.patrimony_id AS INTEGER)                            AS patrimony_id,
        TRY_CAST(po.created AS TIMESTAMP)                               AS created,
        p.title                                                         AS equipment,
        po.description                                                  AS description,
        ROW_NUMBER() OVER (PARTITION BY po.patrimony_id
                           ORDER BY TRY_CAST(po.created AS TIMESTAMP))  AS rn
    FROM patrimony_occurrences po
    LEFT JOIN patrimonies p ON p.id = po.patrimony_id
    WHERE po.title = 'Enviado em Romaneio'
)
SELECT
    patrimony_id,
    strftime(created, '%Y-%m-%d %H:%M:%S')                              AS created_at,
    equipment,
    description
FROM envio
WHERE rn = 1
```

### Consulta 14: equipamentos-campo-usados

```sql
-- =============================================================================
-- EQUIPAMENTOS PARA CAMPO · USADOS         conjunto calculado: equipamentos-campo-usados
--
-- Substitui a consulta "ÚLTIMO VÍNCULO" do Power BI "CTR - Movimentação
-- Equipamentos para Campo" (server/src/sources/sql/field_equipment_used.sql).
-- Grão: ocorrência — cada passagem do patrimônio para "A.ALMOXARIFADO" DEPOIS
-- de ele ter ido para o laboratório ("CANCELAMENTO / LABORATÓRIO" ou
-- "MANUTENÇÃO / LABORATÓRIO"). "Ter passado pelo laboratório antes" é o mesmo
-- que a primeira passagem pelo laboratório ser anterior — o EXISTS do Power BI
-- virou um MIN por patrimônio.
--
-- Fontes: patrimony_occurrences, patrimonies.
--
-- origin: a passagem pelo laboratório MAIS RECENTE antes da volta (regra do
-- "USADOS CLASSIFICADO" do Power BI "LOG - Gerencial": cancelamento, manutenção
-- ou conserto interno; ILIKE) — usada pela seção Gerencial (ZTE usados). O
-- ASOF JOIN pega, por patrimônio, a última passagem estritamente anterior.
--
-- Abrangente: todos os patrimônios. O app aplica, depois de carregar:
--   * só os modelos acompanhados (FIELD_EQUIPMENT_MODELS, 9 modelos; no
--     Gerencial, ZTE_MOVEMENT_MODELS, 7);
--   * created_at >= FIELD_EQUIPMENT_SINCE (2025-01-01) — no Gerencial, sem piso;
--   * a data sem a hora e a quebra de linha da descrição como espaço.
--
-- Cadência sugerida: de hora em hora.
-- =============================================================================
WITH ocorrencia AS (
    SELECT
        TRY_CAST(po.patrimony_id AS INTEGER)                            AS patrimony_id,
        TRY_CAST(po.created AS TIMESTAMP)                               AS created,
        p.title                                                         AS equipment,
        po.description                                                  AS description
    FROM patrimony_occurrences po
    LEFT JOIN patrimonies p ON p.id = po.patrimony_id
),
laboratorio AS (
    SELECT patrimony_id, MIN(created) AS primeira_passagem
    FROM ocorrencia
    WHERE description LIKE '%CANCELAMENTO / LABORATÓRIO%'
       OR description LIKE '%MANUTENÇÃO / LABORATÓRIO%'
    GROUP BY patrimony_id
),
volta AS (
    SELECT o.patrimony_id, o.created, o.equipment, o.description
    FROM ocorrencia o
    JOIN laboratorio l ON l.patrimony_id = o.patrimony_id AND l.primeira_passagem < o.created
    WHERE o.description LIKE '%A.ALMOXARIFADO%'
),
origem AS (
    SELECT
        patrimony_id,
        created,
        CASE
            WHEN description ILIKE '%CANCELAMENTO%LABORAT%' THEN 'CANCELAMENTO'
            WHEN description ILIKE '%MANUTEN%LABORAT%' THEN 'MANUTENÇÃO'
            ELSE 'CONSERTO INTERNO (fora do escopo)'
        END                                                             AS origin
    FROM ocorrencia
    WHERE description ILIKE '%CANCELAMENTO%LABORAT%'
       OR description ILIKE '%MANUTEN%LABORAT%'
       OR description ILIKE '%CONSERTO INTERNO%LABORAT%'
)
SELECT
    v.patrimony_id,
    strftime(v.created, '%Y-%m-%d %H:%M:%S')                            AS created_at,
    v.equipment,
    v.description,
    coalesce(g.origin, 'SEM ORIGEM IDENTIFICADA')                       AS origin
FROM volta v
ASOF LEFT JOIN origem g ON g.patrimony_id = v.patrimony_id AND g.created < v.created
```

### Consulta 15: logistica-patrimonios-em-carga

```sql
-- =============================================================================
-- LOGÍSTICA · PATRIMÔNIOS EM CARGA   conjunto calculado: logistica-patrimonios-em-carga
--
-- Substitui a consulta "DASH_ATUAL_TECNICOS" do Power BI "LOG - Objetos em
-- Carga" (server/src/sources/sql/charged_patrimonies.sql).
-- Grão: patrimônio que tem uma pessoa como responsável.
--
-- SEM o join com os itens da nota fiscal de entrada do Power BI: ele repetia o
-- patrimônio uma vez por item da nota e inflava o valor (2,6x em 04/11/2026).
--
-- Fontes: patrimonies, people, service_products.
--
-- O app aplica, depois de carregar: a base pela cidade do responsável
-- (HOLDER_CITY_BASES), a data sem hora e o "tempo (dias)" até hoje.
-- is_active / is_deleted (cadastro do patrimônio) viram os filtros
-- "Patrimônio ativo?" e "Patrimônio deletado?" (Sim/Não).
--
-- Volume: ~21 mil linhas. Cadência sugerida: de hora em hora.
-- =============================================================================
SELECT
    TRY_CAST(p.id AS INTEGER)                                           AS patrimony_id,
    p.tag_number                                                        AS patrimony_tag,
    p.serial_number                                                     AS serial_number,
    p.title                                                             AS description,
    sp.code                                                             AS product_code,
    CAST(p.purchase_amount AS DOUBLE)                                   AS item_value,
    p2.name                                                             AS holder,
    p2.city                                                             AS holder_city,
    strftime(TRY_CAST(p.modified AS TIMESTAMP), '%Y-%m-%d %H:%M:%S')    AS moved_at,
    CASE WHEN p.active IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(p.active AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(p.active AS VARCHAR) AS DOUBLE) <> 0) END
                                                                        AS is_active,
    CASE WHEN p.deleted IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(p.deleted AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(p.deleted AS VARCHAR) AS DOUBLE) <> 0) END
                                                                        AS is_deleted
FROM patrimonies p
JOIN people p2 ON p2.id = p.person_id
LEFT JOIN service_products sp ON sp.id = p.service_product_id
WHERE p2.name IS NOT NULL
```

### Consulta 16: logistica-produtos-em-carga

```sql
-- =============================================================================
-- LOGÍSTICA · PRODUTOS EM CARGA        conjunto calculado: logistica-produtos-em-carga
--
-- Substitui a consulta "DASH_ATUAL_CONSUMOS" do Power BI "LOG - Objetos em
-- Carga" (server/src/sources/sql/charged_products.sql).
-- Grão: lançamento de produto com saldo com uma pessoa (view de movimentação
-- interna do Voalle), com o preço unitário do lançamento.
--
-- Fontes: v_internal_movimentations_products (VIEW publicada como fonte),
--         service_products, people, person_product_movimentations, units_measures.
--
-- O app aplica, depois de carregar: pessoa sem nome sai; agrupa por pessoa,
-- produto, unidade e preço somando o saldo (o Table.Group do Power Query);
-- valor = quantidade x preço; base pela cidade da pessoa.
-- is_active / is_deleted (cadastro do produto) viram os filtros
-- "Produto ativo?" e "Produto deletado?" (Sim/Não).
--
-- Volume: ~40 mil linhas. Cadência sugerida: de hora em hora.
-- =============================================================================
SELECT DISTINCT
    p.name                                                              AS holder,
    p.city                                                              AS holder_city,
    sp.code                                                             AS product_code,
    sp.title                                                            AS description,
    CAST(vimp.actual_balance AS DOUBLE)                                 AS balance,
    um.title                                                            AS unit_measure,
    CAST(ppm.unit_amount AS DOUBLE)                                     AS unit_value,
    TRY_CAST(ppm.id AS INTEGER)                                         AS movement_id,
    CASE WHEN sp.active IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(sp.active AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(sp.active AS VARCHAR) AS DOUBLE) <> 0) END
                                                                        AS is_active,
    CASE WHEN sp.deleted IS NULL THEN NULL
         ELSE coalesce(TRY_CAST(CAST(sp.deleted AS VARCHAR) AS BOOLEAN),
                       TRY_CAST(CAST(sp.deleted AS VARCHAR) AS DOUBLE) <> 0) END
                                                                        AS is_deleted
FROM v_internal_movimentations_products vimp
LEFT JOIN service_products sp ON sp.id = vimp.service_product_id
LEFT JOIN people p ON p.id = vimp.person_id
LEFT JOIN person_product_movimentations ppm ON ppm.id = vimp.person_product_movimentation_id
LEFT JOIN units_measures um ON um.id = vimp.first_units_measure_id
WHERE CAST(vimp.actual_balance AS DOUBLE) <> 0
```

### Consulta 17: gerencial-objetos-criados

```sql
-- =============================================================================
-- GERENCIAL · OBJETOS CRIADOS              conjunto calculado: gerencial-objetos-criados
--
-- Substitui a consulta "OBJETOS CRIADOS" do Power BI "LOG - Gerencial"
-- (server/src/sources/sql/management_created_objects.sql).
-- Grão: dia — quantas ocorrências "Criação do Objeto" (um patrimônio criado
-- no Voalle) houve no dia. O Power BI trazia uma linha por ocorrência e somava.
--
-- Fontes: patrimony_occurrences.
--
-- Abrangente: desde sempre. O app aplica, depois de carregar:
--   * day >= MANAGEMENT_SINCE.createdObjects (2022-01-01).
--
-- Volume: ~1,5 mil linhas (uma por dia com criação). Cadência sugerida: de hora em hora.
-- =============================================================================
WITH criacao AS (
    SELECT
        TRY_CAST(po.id AS BIGINT)                                        AS id,
        CAST(TRY_CAST(po.date AS TIMESTAMP) AS DATE)                     AS dia
    FROM patrimony_occurrences po
    WHERE po.title LIKE '%Criação do Objeto%'
)
SELECT
    strftime(dia, '%Y-%m-%d')                                            AS day,
    CAST(COUNT(DISTINCT id) AS INTEGER)                                  AS objects
FROM criacao
WHERE dia IS NOT NULL
GROUP BY dia
```

### Consulta 18: gerencial-consumo-flat

```sql
-- =============================================================================
-- GERENCIAL · CONSUMO DE FLAT              conjunto calculado: gerencial-consumo-flat
--
-- Substitui a consulta "Consumo Voalle" do Power BI "LOG - Gerencial"
-- (server/src/sources/sql/management_flat_consumption.sql).
-- Grão: dia x quem recebeu x quem entregou (usuário que lançou), com a soma
-- dos metros do cabo flat (código 00069).
--
-- O DISTINCT de dentro é o do Power BI, INCLUSIVE o join com as equipes de
-- quem recebeu: a mesma entrega entra uma vez por equipe da pessoa (~13% a
-- mais). Mantido por decisão da área (05/11/2026), para bater com o Power BI.
-- O "quem entregou" vem de users sem synsuite_code (a view v_users).
--
-- Fontes: person_product_movimentations, people, service_products, users,
--         company_place_business_units, people_teams, teams.
--
-- Fica no SQL (ver decisão 7): o código do flat, o piso de 2024 e o ajuste de
-- inventário de 04/09/2025 dos almoxarifados. O app aplica, depois de carregar:
--   * quem entregou na lista do almoxarifado (FLAT_SUPPLIERS);
--   * quem recebeu fora de FLAT_EXCLUDED_RECEIVERS (almoxarifados, sucata, RMA...).
--
-- Volume: ~45 mil linhas. Cadência sugerida: de hora em hora.
-- =============================================================================
WITH entrega AS (
    SELECT DISTINCT
        CAST(m.units AS DOUBLE)                                          AS units,
        sp.code                                                          AS product_code,
        TRY_CAST(sp.id AS INTEGER)                                       AS product_id,
        sp.title                                                         AS product_title,
        cpbu.description                                                 AS base_name,
        TRY_CAST(m.created AS TIMESTAMP)                                 AS created,
        receiver.name                                                    AS receiver,
        supplier.name                                                    AS supplier,
        t.title                                                          AS team
    FROM person_product_movimentations m
    LEFT JOIN people receiver ON receiver.id = m.person_id
    LEFT JOIN service_products sp ON sp.id = m.service_product_id
    LEFT JOIN users supplier ON supplier.id = m.created_by AND supplier.synsuite_code IS NULL
    LEFT JOIN company_place_business_units cpbu ON cpbu.id = m.company_place_business_unit_id
    LEFT JOIN people_teams pt ON pt.person_id = receiver.id
    LEFT JOIN teams t ON t.id = pt.team_id
    WHERE TRY_CAST(m.created AS TIMESTAMP) >= TIMESTAMP '2024-01-01'
      AND TRY_CAST(sp.type AS INTEGER) = 1
      AND sp.code = '00069'
      AND NOT (CAST(TRY_CAST(m.created AS TIMESTAMP) AS DATE) = DATE '2025-09-04'
               AND receiver.name IN ('A.ALMOXARIFADO / SÃO LEO', 'A.ALMOXARIFADO / SEDE PORTO ALEGRE', 'A.ALMOXARIFADO / CANOAS'))
)
SELECT
    strftime(CAST(created AS DATE), '%Y-%m-%d')                          AS day,
    receiver,
    supplier,
    SUM(units)                                                           AS units
FROM entrega
GROUP BY CAST(created AS DATE), receiver, supplier
```

### Consulta 19: gerencial-equipamentos-obsoletos

```sql
-- =============================================================================
-- GERENCIAL · EQUIPAMENTOS OBSOLETOS   conjunto calculado: gerencial-equipamentos-obsoletos
--
-- Substitui a consulta "EQUIPAMENTO OBSOLETOS" do Power BI "LOG - Gerencial"
-- (server/src/sources/sql/management_obsolete_equipment.sql).
-- Grão: serial — a primeira data (última modificação do patrimônio) de cada
-- serial sob a conta do depósito de rádio. A tela conta os seriais DISTINTOS
-- acumulados até o fim de cada período; o serial vazio conta como um valor,
-- como no DISTINCTCOUNT do Power BI.
--
-- Fontes: patrimonies, people.
--
-- Fica no SQL (ver decisão 7): a conta "A. RADIO / DEPOSITO" — é ela que define
-- o que é obsoleto. O app não aplica mais nada.
--
-- Volume: ~1,2 mil linhas. Cadência sugerida: de hora em hora.
-- =============================================================================
SELECT
    p.serial_number                                                      AS serial_number,
    strftime(MIN(CAST(TRY_CAST(p.modified AS TIMESTAMP) AS DATE)), '%Y-%m-%d') AS first_day
FROM patrimonies p
JOIN people holder ON holder.id = p.person_id
WHERE holder.name = 'A. RADIO / DEPOSITO'
GROUP BY p.serial_number
```

### Consulta 20: gerencial-produtividade-almox

```sql
-- =============================================================================
-- GERENCIAL · PRODUTIVIDADE ALMOX       conjunto calculado: gerencial-produtividade-almox
--
-- Substitui a consulta "QuantidadeRomaneios" do Power BI "LOG - Gerencial"
-- (server/src/sources/sql/management_packing_productivity.sql).
-- Grão: quem lançou x mês x romaneio (a descrição da ocorrência identifica o
-- romaneio), com quantos patrimônios foram no romaneio. O app conta os
-- romaneios como descrições DISTINTAS e soma os patrimônios.
-- "Quem lançou" vem de users sem synsuite_code (a view v_users).
--
-- Fontes: patrimony_occurrences, users.
--
-- Fica no SQL (ver decisão 7): só os últimos meses — a partir do 1º dia de três
-- meses atrás (a tela usa os dois últimos fechados; o terceiro é folga para a
-- virada do mês). O app aplica, depois de carregar:
--   * só os dois últimos meses fechados;
--   * só quem está na lista da Administração (productivity-staff.json).
--
-- Volume: ~15 mil linhas. Cadência sugerida: de hora em hora.
-- =============================================================================
WITH envio AS (
    SELECT
        TRY_CAST(po.id AS BIGINT)                                        AS id,
        CAST(TRY_CAST(po.date AS TIMESTAMP) AS DATE)                     AS dia,
        po.description                                                   AS description,
        u.name                                                           AS name
    FROM patrimony_occurrences po
    LEFT JOIN users u ON u.id = po.created_by AND u.synsuite_code IS NULL
    WHERE po.title LIKE '%Enviado em Romaneio%'
)
SELECT
    name,
    strftime(dia, '%Y-%m')                                               AS month,
    description,
    CAST(COUNT(id) AS INTEGER)                                           AS patrimonies
FROM envio
WHERE dia >= CAST(date_trunc('month', current_date) AS DATE) - INTERVAL 3 MONTH
GROUP BY name, strftime(dia, '%Y-%m'), description
```

### Consulta 21: laboratorio-eventos

```sql
-- =============================================================================
-- LABORATÓRIO · EVENTOS                    conjunto calculado: laboratorio-eventos
--
-- Substitui a consulta "general" do Power BI "LAB - Produtividade Laboratório"
-- (server/src/sources/sql/lab_events.sql). Grão: evento do patrimônio no
-- laboratório — ENTRADA (do almoxarifado para um laboratório), SAIDA (de volta a
-- um almoxarifado), RMA e DESCARTE INTERNO (terminais), numerados por ciclo,
-- com os dias no laboratório nos eventos de fechamento.
--
-- A lógica é a do Power BI, passo a passo (mesmos CTEs). Do Postgres para o
-- DuckDB: `~*` virou regexp_matches com (?i), `\m...\M` virou `\b`, o
-- SUBSTRING por regex virou regexp_extract (com (?s): no Postgres o ponto pega
-- a quebra de linha), o COUNT ... FILTER da janela virou SUM(CASE ...) e o
-- EXTRACT(EPOCH ...) virou epoch(). O filtro de desempenho do Power BI
-- (`patrimony_id IN (...created >= 2026)`) saiu: não muda o resultado (todo
-- evento de 2026 é uma ocorrência de 2026 do próprio patrimônio). As colunas
-- saem com os nomes da consulta original, na mesma ordem.
--
-- Fontes: patrimony_occurrences, patrimonies, service_products,
--         company_place_business_units, users.
--
-- Como no Power BI (ver decisão 8): empresa 1, sem PROJETO NHO e sem base
-- excluída (entram na escolha dos patrimônios) e o corte de 2026 nos eventos.
-- O app não aplica nada além disso.
--
-- Volume: ~45 mil linhas (nov/2026). Cadência sugerida: a cada 3 horas.
-- =============================================================================
WITH movimentos AS (
    SELECT
        TRY_CAST(po.id AS BIGINT)                                       AS ocorrencia_id,
        TRY_CAST(po.created AS TIMESTAMP)                               AS data_movimento,
        TRY_CAST(po.occurrence_type AS INTEGER)                         AS occurrence_type,
        po.title                                                        AS titulo_ocorrencia,
        po.description                                                  AS descricao_ocorrencia,
        TRY_CAST(p.id AS INTEGER)                                       AS patrimonio_id,
        p.serial_number                                                 AS serial,
        p.tag_number                                                    AS patrimonio,
        sp.code                                                         AS produto_codigo,
        sp.title                                                        AS produto_titulo,
        cpbu.description                                                AS base_descricao,
        NULLIF(regexp_extract(po.description, 'N[º°]\s*(\d+)', 1), '')  AS nota_romaneio,
        u.name                                                          AS fornecedor,
        rtrim(NULLIF(regexp_extract(po.description, '(?s)Sob Responsabilidade de\s+(.+)', 1), ''), ' .') AS recebedor,
        -- motivo do descarte: o que vem depois da primeira quebra de linha
        CASE WHEN po.title = 'Descarte Interno' THEN
            NULLIF(trim(
                CASE WHEN strpos(po.description, chr(10)) > 0
                     THEN substring(po.description, strpos(po.description, chr(10)) + 1)
                     ELSE po.description
                END
            ), '')
        END                                                             AS motivo_descarte
    FROM patrimony_occurrences po
    JOIN patrimonies p ON p.id = po.patrimony_id
    JOIN service_products sp ON sp.id = p.service_product_id
    JOIN company_place_business_units cpbu ON cpbu.id = p.company_place_business_unit_id
    LEFT JOIN users u ON u.id = po.created_by
    WHERE (
            (TRY_CAST(po.occurrence_type AS INTEGER) = 5 AND po.description LIKE '%Sob Responsabilidade de%')
         OR regexp_matches(po.description, '(?i)\bRMA\b|GARANTIA')
         OR po.title = 'Descarte Interno'
          )
      AND sp.title IS NOT NULL
      AND TRY_CAST(cpbu.company_place_id AS INTEGER) = 1
      AND cpbu.description <> 'PROJETO NHO'
      AND coalesce(TRY_CAST(CAST(cpbu.deleted AS VARCHAR) AS BOOLEAN),
                   TRY_CAST(CAST(cpbu.deleted AS VARCHAR) AS DOUBLE) <> 0, false) IS NOT TRUE
),
com_local AS (
    SELECT m.*,
        CASE
            -- descarte primeiro: o motivo pode citar "garantia" e não deve virar RMA
            WHEN titulo_ocorrencia = 'Descarte Interno'                          THEN 'Descarte Interno'
            WHEN regexp_matches(descricao_ocorrencia, '(?i)\bRMA\b|GARANTIA')     THEN 'RMA/Garantia'
            WHEN recebedor LIKE '%CANCELAMENTO / LABORATÓRIO / CANOAS%'          THEN 'Lab Cancelamento CAN'
            WHEN recebedor LIKE '%CANCELAMENTO / LABORATÓRIO / SLE%'             THEN 'Lab Cancelamento SLE'
            WHEN recebedor LIKE '%CONSERTO INTERNO / LABORATÓRIO CANOAS%'        THEN 'Lab Conserto Interno CAN'
            WHEN recebedor LIKE '%CONSERTO INTERNO / LABORATÓRIO SLE%'           THEN 'Lab Conserto Interno SLE'
            WHEN recebedor LIKE '%MANUTENÇÃO / LABORATÓRIO / CANOAS%'            THEN 'Lab Manutenção CAN'
            WHEN recebedor LIKE '%MANUTENÇÃO / LABORATÓRIO / SLE%'               THEN 'Lab Manutenção SLE'
            WHEN recebedor LIKE '%A.ALMOXARIFADO / CANOAS%'                      THEN 'Almox CAN'
            WHEN recebedor LIKE '%A.ALMOXARIFADO / SÃO LEO%'                     THEN 'Almox SLE'
            WHEN recebedor LIKE '%ALMOXARIFADO - CANOAS - CANCELAMENTO%'         THEN 'Almox CAN Cancelamento'
            WHEN recebedor LIKE '%ALMOXARIFADO - CANOAS - MANUTENÇÃO%'           THEN 'Almox CAN Manutenção'
            WHEN recebedor LIKE '%ALMOXARIFADO - SÃO LEOPOLDO - CANCELAMENTO%'   THEN 'Almox SLE Cancelamento'
            WHEN recebedor LIKE '%ALMOXARIFADO - SÃO LEOPOLDO - MANUTENÇÃO%'     THEN 'Almox SLE Manutenção'
        END                                                             AS local,
        -- toda troca de responsável (qualquer conta, mesmo fora da lista acima)
        CASE WHEN occurrence_type = 5 AND recebedor IS NOT NULL
                  AND titulo_ocorrencia IS DISTINCT FROM 'Descarte Interno'
             THEN 1 ELSE 0 END                                          AS is_responsabilidade
    FROM movimentos m
),
grupos_resp AS (
    -- cada troca de responsável abre um grupo; as ocorrências seguintes herdam esse grupo
    SELECT c.*,
        SUM(is_responsabilidade) OVER (PARTITION BY patrimonio_id ORDER BY data_movimento, ocorrencia_id) AS grupo_resp
    FROM com_local c
),
com_ultimo_resp AS (
    -- último responsável registrado até cada ocorrência
    SELECT g.*,
        CASE WHEN grupo_resp > 0 THEN
            FIRST_VALUE(local) OVER (PARTITION BY patrimonio_id, grupo_resp ORDER BY data_movimento, ocorrencia_id)
        END                                                             AS ultimo_responsavel_local
    FROM grupos_resp g
),
checkpoints AS (
    SELECT c.*,
        CASE
            WHEN local LIKE 'Lab%'          THEN 'LAB'
            WHEN local = 'RMA/Garantia'     THEN 'RMA'
            WHEN local = 'Descarte Interno' THEN 'DESCARTE'
            ELSE 'ALMOX'
        END                                                             AS classe
    FROM com_ultimo_resp c
    WHERE local IS NOT NULL
),
checkpoints_validos AS (
    -- RMA e descarte são terminais: ignora o que for lançado depois do primeiro deles
    SELECT * FROM (
        SELECT ck.*,
            SUM(CASE WHEN classe IN ('RMA', 'DESCARTE') THEN 1 ELSE 0 END)
                OVER (PARTITION BY patrimonio_id ORDER BY data_movimento, ocorrencia_id
                      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS terminais_anteriores
        FROM checkpoints ck
    ) x
    WHERE COALESCE(terminais_anteriores, 0) = 0
),
sequencia AS (
    SELECT ck.*,
        LAG(classe) OVER w                                              AS classe_anterior,
        LAG(local)  OVER w                                              AS local_anterior
    FROM checkpoints_validos ck
    WINDOW w AS (PARTITION BY patrimonio_id ORDER BY data_movimento, ocorrencia_id)
),
eventos AS (
    SELECT s.*,
        CASE
            WHEN classe = 'LAB'      AND (classe_anterior IS NULL OR classe_anterior = 'ALMOX') THEN 'ENTRADA'
            WHEN classe = 'ALMOX'    AND classe_anterior = 'LAB'                               THEN 'SAIDA'
            WHEN classe = 'RMA'      AND classe_anterior = 'LAB'                               THEN 'RMA'
            -- só conta se o último responsável antes do descarte era um laboratório
            WHEN classe = 'DESCARTE' AND classe_anterior = 'LAB'
                 AND ultimo_responsavel_local LIKE 'Lab%'                                      THEN 'DESCARTE INTERNO'
        END                                                             AS tipo_evento
    FROM sequencia s
),
ciclos AS (
    SELECT e.*,
        SUM(CASE WHEN tipo_evento = 'ENTRADA' THEN 1 ELSE 0 END)
            OVER (PARTITION BY patrimonio_id ORDER BY data_movimento, ocorrencia_id) AS ciclo
    FROM eventos e
    WHERE tipo_evento IS NOT NULL
),
final AS (
    SELECT c.*,
        MIN(data_movimento) OVER (PARTITION BY patrimonio_id, ciclo)   AS data_entrada_ciclo,
        MAX(CASE WHEN tipo_evento = 'ENTRADA' THEN local END)
            OVER (PARTITION BY patrimonio_id, ciclo)                    AS laboratorio_entrada,
        MAX(CASE WHEN tipo_evento = 'ENTRADA' THEN
                CASE WHEN local LIKE 'Lab Cancelamento%' THEN 'Cancelamento' ELSE 'Manutenção' END
            END) OVER (PARTITION BY patrimonio_id, ciclo)               AS motivo_entrada
    FROM ciclos c
)
SELECT
    strftime(data_movimento, '%Y-%m-%d %H:%M:%S')                       AS data_movimento,
    strftime(data_movimento, '%Y-%m-%d')                                AS data,
    tipo_evento,
    motivo_entrada,
    laboratorio_entrada,
    -- CAN ou SLE; nos eventos de fechamento, o último laboratório antes do evento
    right(CASE WHEN tipo_evento = 'ENTRADA' THEN local ELSE local_anterior END, 3) AS base_lab,
    CASE WHEN tipo_evento = 'SAIDA' THEN local END                      AS almoxarifado,
    CASE WHEN tipo_evento = 'DESCARTE INTERNO' THEN motivo_descarte END AS motivo,
    patrimonio_id,
    patrimonio,
    serial,
    produto_codigo,
    produto_titulo,
    base_descricao,
    CAST(ciclo AS INTEGER)                                              AS ciclo,
    strftime(data_entrada_ciclo, '%Y-%m-%d %H:%M:%S')                   AS data_entrada_ciclo,
    CASE WHEN tipo_evento IN ('SAIDA', 'RMA', 'DESCARTE INTERNO')
         THEN ROUND((epoch(data_movimento) - epoch(data_entrada_ciclo)) / 86400.0, 1)
    END                                                                 AS dias_no_laboratorio,
    nota_romaneio,
    fornecedor
FROM final
WHERE data_movimento >= TIMESTAMP '2026-01-01'
ORDER BY data_movimento DESC
```

### Consulta 22: laboratorio-backlog

```sql
-- =============================================================================
-- LABORATÓRIO · BACKLOG                    conjunto calculado: laboratorio-backlog
--
-- Substitui a consulta "backlog" do Power BI "LAB - Produtividade Laboratório"
-- (server/src/sources/sql/lab_backlog.sql). Grão: patrimônio que está no
-- laboratório agora — o responsável atual é um laboratório, nunca houve
-- RMA/descarte, e a entrada é a primeira passagem por laboratório depois da
-- última ida ao almoxarifado.
--
-- Lógica do Power BI (Postgres `~` virou regexp_matches; o ARRAY_AGG ... [1]
-- virou list(... ORDER BY ...)[1]; NOW() virou o relógio de São Paulo, porque
-- o `created` do Voalle é hora local). Os dias em aberto e o "acima de 90
-- dias" contam até a hora do cálculo do conjunto, como no Power BI até a hora
-- da consulta. As colunas saem com os nomes da consulta original.
--
-- Fontes: patrimony_occurrences.
--
-- Abrangente: o app não aplica nada além disso; a tela mostra o backlog dos
-- patrimônios que aparecem nos eventos filtrados (conjunto 21).
--
-- Volume: ~350 linhas. Cadência sugerida: a cada 3 horas.
-- =============================================================================
WITH agora AS (
    SELECT timezone('America/Sao_Paulo', now()) AS ts
),
oc AS (
    SELECT
        TRY_CAST(po.id AS BIGINT)                                       AS id,
        TRY_CAST(po.patrimony_id AS INTEGER)                            AS patrimony_id,
        TRY_CAST(po.created AS TIMESTAMP)                               AS created,
        rtrim(NULLIF(regexp_extract(po.description, '(?s)Sob Responsabilidade de\s+(.+)', 1), ''), ' .') AS recebedor,
        CASE
            WHEN po.title = 'Descarte Interno'
              OR regexp_matches(po.description, '(?i)\bRMA\b|GARANTIA')
                THEN 'TERMINAL'
            WHEN regexp_matches(po.description, '(CANCELAMENTO|MANUTENÇÃO) / LABORATÓRIO / (CANOAS|SLE)|CONSERTO INTERNO / LABORATÓRIO (CANOAS|SLE)')
                THEN 'LAB'
            WHEN regexp_matches(po.description, 'A\.ALMOXARIFADO / (CANOAS|SÃO LEO)|ALMOXARIFADO - (CANOAS|SÃO LEOPOLDO) - (CANCELAMENTO|MANUTENÇÃO)')
                THEN 'ALMOX'
        END                                                             AS classe,
        -- troca de responsável em qualquer conta
        (TRY_CAST(po.occurrence_type AS INTEGER) = 5
         AND po.description LIKE '%Sob Responsabilidade de%'
         AND po.title IS DISTINCT FROM 'Descarte Interno')               AS is_resp
    FROM patrimony_occurrences po
    WHERE (TRY_CAST(po.occurrence_type AS INTEGER) = 5 AND po.description LIKE '%Sob Responsabilidade de%')
       OR regexp_matches(po.description, '(?i)\bRMA\b|GARANTIA')
       OR po.title = 'Descarte Interno'
),
resumo AS (
    SELECT
        patrimony_id,
        (list(classe ORDER BY created DESC, id DESC) FILTER (WHERE is_resp))[1]    AS classe_resp_atual,
        (list(recebedor ORDER BY created DESC, id DESC) FILTER (WHERE is_resp))[1] AS responsavel_atual,
        bool_or(classe = 'TERMINAL')                                    AS teve_terminal,
        MAX(created) FILTER (WHERE classe = 'ALMOX')                    AS ultimo_almox
    FROM oc
    GROUP BY patrimony_id
)
SELECT
    r.patrimony_id,
    r.responsavel_atual                                                 AS laboratorio_atual,
    strftime(MIN(oc.created), '%Y-%m-%d %H:%M:%S')                      AS data_entrada_lab,
    ROUND((epoch(MAX(a.ts)) - epoch(MIN(oc.created))) / 86400.0, 1)     AS dias_em_aberto,
    CASE WHEN epoch(MAX(a.ts)) - epoch(MIN(oc.created)) > 90 * 86400
         THEN 'Acima de 90 dias' ELSE 'Até 90 dias' END                 AS status_backlog_90
FROM resumo r
JOIN oc ON oc.patrimony_id = r.patrimony_id
       AND oc.classe = 'LAB'
       AND oc.created > COALESCE(r.ultimo_almox, TIMESTAMP '-infinity')
CROSS JOIN agora a
WHERE r.classe_resp_atual = 'LAB'
  AND NOT r.teve_terminal
GROUP BY r.patrimony_id, r.responsavel_atual
```

### Validação feita

As 22 consultas rodaram no **mesmo motor do Data Hub** (`@duckdb/node-api` 1.5), passando pelo
guard de SQL do próprio Data Hub e embrulhados como ele faz
(`select * from (…) as __derivado`). Foram testados com dados sintéticos que exercitam
cada regra: a soma de devoluções da alocação, as notas canceladas, o recorte do
protocolo, a última ocorrência do patrimônio, o número do romaneio e o recebedor no
texto (inclusive com quebra de linha), o `DISTINCT` dos pedidos e o fornecedor sem
`synsuite_code`; no Gerencial, a origem da volta do laboratório (a mais recente antes
dela), a entrega de flat repetida por equipe, o ajuste de 04/09/2025, o primeiro dia de
cada serial e a janela dos últimos meses da produtividade; no laboratório, a sequência entrada → saída
→ nova entrada → descarte (com o motivo depois da quebra de linha), o que vem depois do
descarte ignorado, o número do romaneio e o recebedor no texto, e o backlog de quem ficou
no laboratório. Foram duas variações de tipo: o lake tipado, e o pior caso com
booleano como `1.0` e data como texto. O resultado foi idêntico nas duas.

**Não foi feito:** rodar contra o lake real (a ferramenta não tem acesso a ele). A
conferência fica para depois da primeira materialização (seção 5).

---

## 4. Regras que saem do SQL e passam para o app

| Conjunto | O app aplica |
|---|---|
| 01 saldo | título não nulo; `company_place_id = 1`; sem `PROJETO NHO`; sem base excluída; `item_type` por `generate_patrimony` |
| 02 pedidos | `status = 4` e não excluído; base pelo CEP na observação (93120, 92010, 90230); ordem por data |
| 03 pendentes | `pending_units` diferente de 0 e de -1 |
| 05 Senior | uma linha por nome (maior matrícula) |
| 06 alocação produtos | `issue_date >= CONSUMPTION_SINCE`; contas internas fora; BaseGrupo, cabo x produto, categoria |
| 07 alocação patrimônios | `out_date > CONSUMPTION_SINCE`; `returned` 1/0 -> "Retorno"/"-" |
| 08 romaneio produtos | fornecedor na lista do almoxarifado; `created_at >= PRODUCT_PACKING_SINCE`; exclusão de 04/09/2025 |
| 09 romaneio patrimônios | **romaneio:** tipo 5, título não nulo, empresa 1, sem NHO/excluída, registrador na lista do almoxarifado, `created_at >= PATRIMONY_PACKING_SINCE`, recebedor sem ponto final. **Histórico:** registrador na lista de responsáveis, `moved_date >= PATRIMONY_NOTES_SINCE`, recebedor fora das contas internas |
| 10 status | título não nulo, empresa 1, sem NHO/excluída; **status atual** pela regra do Power BI (hoje no `CASE` de `patrimony_statuses.sql`) |
| 11 saldo de itens (Compras) | título não nulo, empresa 1, sem base excluída; Sim/Não |
| 12 pedidos de compra (Compras) | `order_date >= PURCHASE_ORDERS_SINCE`; nome do status; base pelo endereço na observação; Sim/Não e Deletado/Não |
| 13 e 14 equipamentos para campo | só os 9 modelos de `FIELD_EQUIPMENT_MODELS`; `created_at >= FIELD_EQUIPMENT_SINCE`; data sem hora |
| 13 e 14 no Gerencial (ZTE novos e usados) | só os 7 modelos de `ZTE_MOVEMENT_MODELS`; soma por dia (e por modelo e origem no 14); nos ZTE usados, só `ZTE_CLASSIFIED_MODELS` |
| 15 patrimônios em carga | base pela cidade do responsável; data sem hora; tempo (dias) até hoje |
| 16 produtos em carga | pessoa com nome; agrupamento por pessoa, produto, unidade e preço somando o saldo; valor = quantidade x preço; base pela cidade |
| 17 objetos criados | `day >= MANAGEMENT_SINCE.createdObjects` (2022) |
| 18 consumo de flat | quem entregou em `FLAT_SUPPLIERS`; quem recebeu fora de `FLAT_EXCLUDED_RECEIVERS` |
| 19 obsoletos | — (a data sem dia vazio) |
| 20 produtividade | os dois últimos meses fechados; pessoas da lista da Administração; quem lançou com nome |
| 21 laboratório · eventos | — (a consulta do Power BI como está; ver decisão 8) |
| 22 laboratório · backlog | só os patrimônios que aparecem nos eventos filtrados (é assim que o filtro chegava a ele no Power BI) |

---

## 5. Conferência depois da primeira materialização

Depois que os conjuntos materializarem, compare com a última carga direta do banco
(04/11/2026). O número exato muda com o tempo, porque o ERP continua recebendo
movimento, mas a ordem de grandeza tem de bater:

| O que conferir | Carga direta (04/11/2026) |
|---|---:|
| 06 alocação produtos: linhas do conjunto (o filtro é o mesmo de hoje) | 698.652 |
| 07 alocação patrimônios: linhas do conjunto | 572.465 |
| 08 romaneio produtos: depois do filtro do app (lista do almoxarifado, desde 2025) | 151.715 |
| 09 → romaneio de patrimônios (filtro do app) | 55.515 |
| 09 → histórico de romaneios (filtro do app) | 125.268 |
| 10 status: depois do filtro do app | 213.032 |
| 01 saldo: depois do filtro do app | 20.232 |
| 11 saldo de itens: depois do filtro do app | 20.232 |
| 12 pedidos de compra: itens desde 2026 (filtro do app) | 8.262 (2.717 pedidos) |
| 13 equipamentos novos: 9 modelos, desde 2025 (filtro do app) | 46.091 (25.990 em 2025 + 20.101 em 2026) |
| 14 equipamentos usados: 9 modelos, desde 2025 (filtro do app) | 25.186 (11.211 em 2025 + 13.975 em 2026) |
| 15 patrimônios em carga: linhas do conjunto | 21.107 (R$ 10.152.211,69) |
| 16 produtos em carga: linhas do conjunto / grupos no app | 40.249 / 9.043 |
| 13 → ZTE novos (Gerencial): 7 modelos, desde sempre | 106.973 (05/11/2026) |
| 14 → ZTE usados (Gerencial): 7 modelos, desde sempre / por origem | 37.607 / out/2026: 555 cancelamento + 1.100 manutenção (05/11/2026) |
| 17 objetos criados: soma desde 2022 | 147.973 (05/11/2026) |
| 18 consumo de flat: metros em 2025 depois do filtro do app | 4.111.128 (05/11/2026) |
| 19 obsoletos: linhas (seriais distintos) | 1.147 (05/11/2026) |
| 20 produtividade: patrimônios em set+out/2026 de todas as pessoas | 30.412 (05/11/2026) |
| 21 laboratório · eventos desde 2026: entrada / saída / descarte / RMA | 43.432: 20.873 / 19.945 / 2.535 / 79 (06/11/2026) |
| 22 laboratório · backlog: linhas / com evento em 2026 (o que a tela mostra) | 351 / 316 (06/11/2026) |

---

## 6. O que muda no app

- Um cliente do Data Hub no servidor (mesmo desenho do `dados_ReactJS_CommercialDashboards/server/src/datahub.js`):
  - páginas de até 100 mil linhas por `limit`/`offset`;
  - o token nunca vai para log;
  - num 401/403, o erro diz se recusou a API ou um proxy no caminho.
- `source.registry.ts`: cada fonte troca o SQL pelo slug do conjunto. As regras da
  seção 4 entram em `business-rules.ts` e nos builders do modelo, filtrando **na
  leitura**: o que não passa no filtro não fica na memória.
- Variáveis novas: `DATAHUB_URL`, `DATAHUB_TOKEN`. As `DB_VOALLE_*` e `DB_MARIA_*` saem
  da stack, e o app deixa de ter acesso direto ao ERP.
- Os `.sql` atuais saem do servidor; este documento passa a ser a referência das consultas.
- **Gerencial:** `zteDispatches` e `zteReturns` passam a ler os conjuntos 13 e 14 (por
  patrimônio/ocorrência) e somar por dia, modelo e origem no app — hoje as consultas
  diretas já chegam somadas. Os outros quatro (17 a 20) têm as mesmas colunas das
  consultas diretas.

---

## Decisões

1. **Piso de 2024 nos quatro conjuntos de movimento** (06, 07, 08, 09) — confirmado
   com a área em 04/11/2026. É a única exceção ao "abrangente". O painel nunca mostra nada antes de 2024, e sem o piso o
   app baixaria **~5 milhões de linhas por carga** em vez de ~2,5 milhões, pelo
   mesmo `/rows`, para descartar metade. Para trazer o histórico inteiro, apague a
   última linha do `WHERE` da consulta; nada mais muda.
2. **Listas de pessoas fora do SQL.** Fornecedores do almoxarifado, responsáveis e contas
   internas ficam no app. O custo é transferir mais linhas: o romaneio de produtos
   desce de ~780 mil para ~150 mil depois do filtro.
3. **Números, datas e booleanos normalizados no conjunto.** No lake todo número chega
   como `DOUBLE` (é assim que o Data Hub grava). Por isso:
   - ids saem como `INTEGER`;
   - número de nota e protocolo saem como texto limpo (sem `.0`);
   - data/hora sai como texto `AAAA-MM-DD [HH:MM:SS]`, o mesmo formato que o app usa hoje;
   - booleanos saem como `true`/`false` mesmo que a fonte entregue `1.0` ou `'true'`.
4. **Romaneio e histórico de romaneios num conjunto só** (09): os dois liam as mesmas
   ocorrências, e assim o app baixa uma vez.
5. **Status do patrimônio calculado no app** (10): a tradução ocorrência -> status é
   regra de negócio e sai do SQL. O conjunto entrega os insumos dela.
6. **Tela de Compras (11 e 12) atualizada a cada minuto — decisão em aberto.** Hoje o
   app relê essas duas consultas direto do Voalle a cada minuto (~1 s as duas, só
   leitura). Pelo Data Hub, o minuto só se mantém se as fontes 1, 2, 3, 4, 5, 6 e 11
   sincronizarem de minuto em minuto (agendamento com intervalo de 1 min) e os
   conjuntos 11 e 12 recalcularem em cascata. O Data Hub sincroniza **uma fonte por
   vez no hub inteiro**, e a view do saldo é *snapshot* (~110 mil linhas a cada
   rodada): sete fontes por minuto disputariam a fila com as cargas dos outros
   painéis. Recomendação: migrar os conjuntos 01 a 10 e deixar 11 e 12 direto no
   Voalle até o Data Hub ter leitura ao vivo para calculado; ou aceitar que a tela de
   Compras passe a atualizar na cadência do Data Hub (ex.: a cada 15 min).
7. **Gerencial: três exceções ao "abrangente"** (05/11/2026), todas por volume ou por
   definirem o registro:
   - **18 consumo de flat:** o código do flat (00069), o piso de 2024 (o do Power BI) e o
     ajuste de inventário de 04/09/2025 ficam no SQL. Sem o código, o conjunto teria todos
     os produtos tipo 1 somados por dia, recebedor e entregador — perto de 1 milhão de
     linhas para a tela usar 45 mil.
   - **19 obsoletos:** a conta "A. RADIO / DEPOSITO" é o que define obsoleto. Abrir para
     todos os responsáveis seriam ~216 mil linhas para usar 1,2 mil.
   - **20 produtividade:** só os últimos três meses (a tela usa dois). O Power BI lia
     desde 2023, mas nenhum visual ou medida passava dos dois meses fechados.
8. **Laboratório: as consultas do Power BI como estão** (06/11/2026). Por decisão da
   área, a aba usa as duas consultas exatamente como no relatório, sem filtro, piso ou
   limite a mais no app — senão os dados mudam. Por isso ficam no SQL a empresa 1, o "sem
   PROJETO NHO" e o "sem base excluída", que escolhem os patrimônios ANTES de montar a
   sequência de eventos, e o corte de 2026 do próprio Power BI (o histórico inteiro de
   cada patrimônio continua montando a sequência; só os eventos que saem são de 2026 em
   diante). A única mudança na tradução é o filtro de desempenho
   (`patrimony_id IN (… created >= 2026)`), que não muda o resultado. Os dois conjuntos
   recalculam a cada 3 horas (a cadência da tela).

