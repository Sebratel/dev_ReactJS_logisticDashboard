-- Consulta "general" do Power BI "LAB - Produtividade Laboratório" (dsn=dbVoalle),
-- a da aba "Entrada/ Saída Laboratório" — EXATAMENTE como está no relatório
-- (decisão da área, 06/11/2026: nenhum filtro ou limite a mais nesta aba).
--
-- Eventos de cada patrimônio no laboratório, reconstruídos das ocorrências de
-- troca de responsável (tipo 5, "Sob Responsabilidade de ..."), do RMA/garantia
-- e do descarte interno: ENTRADA, SAIDA, RMA e DESCARTE INTERNO, por ciclo,
-- com os dias no laboratório nos eventos de fechamento. O corte de 2026 é o do
-- próprio Power BI. ~53 s no Voalle (nov/2026), ~43 mil eventos.

WITH movimentos AS (
    SELECT
        po.id            AS ocorrencia_id,
        po.created       AS data_movimento,
        po.occurrence_type,
        po.title         AS titulo_ocorrencia,
        po.description   AS descricao_ocorrencia,
        p.id             AS patrimonio_id,
        p.serial_number  AS serial,
        p.tag_number     AS patrimonio,
        sp.code          AS produto_codigo,
        sp.title         AS produto_titulo,
        cpbu.description AS base_descricao,
        SUBSTRING(po.description FROM 'N[º°]\s*(\d+)') AS nota_romaneio,
        u.name           AS fornecedor,
        RTRIM(SUBSTRING(po.description FROM 'Sob Responsabilidade de\s+(.+)'), ' .') AS recebedor,
        -- motivo do descarte: apenas o que vem após a primeira quebra de linha
        CASE WHEN po.title = 'Descarte Interno' THEN
            NULLIF(TRIM(
                CASE
                    WHEN POSITION(E'\n' IN po.description) > 0
                    THEN SUBSTRING(po.description FROM POSITION(E'\n' IN po.description) + 1)
                    ELSE po.description
                END
            ), '')
        END AS motivo_descarte
    FROM patrimony_occurrences po
    JOIN patrimonies p                        ON p.id = po.patrimony_id
    JOIN service_products sp                  ON sp.id = p.service_product_id
    JOIN company_place_business_units cpbu    ON cpbu.id = p.company_place_business_unit_id
    JOIN companies_places cp                  ON cp.id = cpbu.company_place_id
    LEFT JOIN users u                         ON u.id = po.created_by
    WHERE (
            (po.occurrence_type = '5' AND po.description LIKE '%Sob Responsabilidade de%')
         OR po.description ~* '\mRMA\M|GARANTIA'      -- encaminhamento RMA/Garantia
         OR po.title = 'Descarte Interno'             -- descarte interno
          )
      AND sp.title IS NOT NULL
      AND cp.id = 1
      AND cpbu.description <> 'PROJETO NHO'
      AND cpbu.deleted IS NOT TRUE
      -- performance: só patrimônios com ocorrência no período, mas com o histórico completo deles
      AND po.patrimony_id IN (
            SELECT patrimony_id
            FROM patrimony_occurrences
            WHERE created >= '2026-01-01'
      )
),
com_local AS (
    SELECT m.*,
        CASE
            -- descarte primeiro: o motivo pode citar "garantia" e não deve virar RMA
            WHEN titulo_ocorrencia = 'Descarte Interno'                         THEN 'Descarte Interno'
            WHEN descricao_ocorrencia ~* '\mRMA\M|GARANTIA'                     THEN 'RMA/Garantia'
            WHEN recebedor LIKE '%CANCELAMENTO / LABORATÓRIO / CANOAS%'         THEN 'Lab Cancelamento CAN'
            WHEN recebedor LIKE '%CANCELAMENTO / LABORATÓRIO / SLE%'            THEN 'Lab Cancelamento SLE'
            WHEN recebedor LIKE '%CONSERTO INTERNO / LABORATÓRIO CANOAS%'       THEN 'Lab Conserto Interno CAN'
            WHEN recebedor LIKE '%CONSERTO INTERNO / LABORATÓRIO SLE%'          THEN 'Lab Conserto Interno SLE'
            WHEN recebedor LIKE '%MANUTENÇÃO / LABORATÓRIO / CANOAS%'           THEN 'Lab Manutenção CAN'
            WHEN recebedor LIKE '%MANUTENÇÃO / LABORATÓRIO / SLE%'              THEN 'Lab Manutenção SLE'
            WHEN recebedor LIKE '%A.ALMOXARIFADO / CANOAS%'                     THEN 'Almox CAN'
            WHEN recebedor LIKE '%A.ALMOXARIFADO / SÃO LEO%'                    THEN 'Almox SLE'
            WHEN recebedor LIKE '%ALMOXARIFADO - CANOAS - CANCELAMENTO%'        THEN 'Almox CAN Cancelamento'
            WHEN recebedor LIKE '%ALMOXARIFADO - CANOAS - MANUTENÇÃO%'          THEN 'Almox CAN Manutenção'
            WHEN recebedor LIKE '%ALMOXARIFADO - SÃO LEOPOLDO - CANCELAMENTO%'  THEN 'Almox SLE Cancelamento'
            WHEN recebedor LIKE '%ALMOXARIFADO - SÃO LEOPOLDO - MANUTENÇÃO%'    THEN 'Almox SLE Manutenção'
        END AS local,
        -- toda troca de responsável (qualquer dashboard, mesmo fora da lista acima)
        CASE WHEN occurrence_type = '5'
              AND recebedor IS NOT NULL
              AND titulo_ocorrencia IS DISTINCT FROM 'Descarte Interno'
             THEN 1 ELSE 0
        END AS is_responsabilidade
    FROM movimentos m
),
grupos_resp AS (
    -- cada troca de responsável abre um grupo; as ocorrências seguintes herdam esse grupo
    SELECT c.*,
        SUM(is_responsabilidade)
            OVER (PARTITION BY patrimonio_id ORDER BY data_movimento, ocorrencia_id) AS grupo_resp
    FROM com_local c
),
com_ultimo_resp AS (
    -- último responsável registrado até cada ocorrência
    SELECT g.*,
        CASE WHEN grupo_resp > 0 THEN
            FIRST_VALUE(local)
                OVER (PARTITION BY patrimonio_id, grupo_resp ORDER BY data_movimento, ocorrencia_id)
        END AS ultimo_responsavel_local
    FROM grupos_resp g
),
checkpoints AS (
    SELECT c.*,
        CASE
            WHEN local LIKE 'Lab%'          THEN 'LAB'
            WHEN local = 'RMA/Garantia'     THEN 'RMA'
            WHEN local = 'Descarte Interno' THEN 'DESCARTE'
            ELSE 'ALMOX'
        END AS classe
    FROM com_ultimo_resp c
    WHERE local IS NOT NULL
),
checkpoints_validos AS (
    -- RMA e Descarte são terminais: ignora qualquer checkpoint lançado depois do primeiro deles
    SELECT *
    FROM (
        SELECT ck.*,
            COUNT(*) FILTER (WHERE classe IN ('RMA', 'DESCARTE'))
                OVER (PARTITION BY patrimonio_id ORDER BY data_movimento, ocorrencia_id
                      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS terminais_anteriores
        FROM checkpoints ck
    ) x
    WHERE COALESCE(terminais_anteriores, 0) = 0
),
sequencia AS (
    SELECT ck.*,
        LAG(classe) OVER w AS classe_anterior,
        LAG(local)  OVER w AS local_anterior
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
        END AS tipo_evento
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
        MIN(data_movimento) OVER (PARTITION BY patrimonio_id, ciclo) AS data_entrada_ciclo,
        MAX(CASE WHEN tipo_evento = 'ENTRADA' THEN local END)
            OVER (PARTITION BY patrimonio_id, ciclo) AS laboratorio_entrada,
        MAX(
            CASE WHEN tipo_evento = 'ENTRADA' THEN
                CASE
                    WHEN local LIKE 'Lab Cancelamento%' THEN 'Cancelamento'
                    ELSE 'Manutenção'   -- Lab Manutenção e Lab Conserto Interno
                END
            END
        ) OVER (PARTITION BY patrimonio_id, ciclo) AS motivo_entrada
    FROM ciclos c
)
SELECT
    data_movimento,
    data_movimento::date AS data,
    tipo_evento,
    motivo_entrada,
    laboratorio_entrada,
    -- CAN ou SLE; nos eventos de fechamento, considera o último laboratório antes do evento
    RIGHT(CASE WHEN tipo_evento = 'ENTRADA' THEN local ELSE local_anterior END, 3) AS base_lab,
    CASE WHEN tipo_evento = 'SAIDA' THEN local END AS almoxarifado,
    CASE WHEN tipo_evento = 'DESCARTE INTERNO' THEN motivo_descarte END AS motivo,
    patrimonio_id,
    patrimonio,
    serial,
    produto_codigo,
    produto_titulo,
    base_descricao,
    ciclo,
    data_entrada_ciclo,
    CASE WHEN tipo_evento IN ('SAIDA', 'RMA', 'DESCARTE INTERNO')
         THEN ROUND((EXTRACT(EPOCH FROM data_movimento - data_entrada_ciclo) / 86400.0)::numeric, 1)
    END AS dias_no_laboratorio,
    nota_romaneio,
    fornecedor
FROM final
WHERE data_movimento >= '2026-01-01'
ORDER BY data_movimento DESC;
