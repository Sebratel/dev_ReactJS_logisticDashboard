-- Consulta "backlog" do Power BI "LAB - Produtividade Laboratório" (dsn=dbVoalle)
-- — EXATAMENTE como está no relatório (decisão da área, 06/11/2026).
--
-- Patrimônios que estão no laboratório agora: o responsável atual é um
-- laboratório, nunca houve RMA/descarte, e a entrada é a primeira passagem por
-- laboratório depois da última ida ao almoxarifado. Dias em aberto e o
-- "acima de 90 dias" contados na hora da consulta. ~28 s, ~350 patrimônios.

WITH oc AS (
    SELECT
        po.id,
        po.patrimony_id,
        po.created,
        RTRIM(SUBSTRING(po.description FROM 'Sob Responsabilidade de\s+(.+)'), ' .') AS recebedor,
        CASE
            WHEN po.title = 'Descarte Interno'
              OR po.description ~* '\mRMA\M|GARANTIA'
                THEN 'TERMINAL'
            WHEN po.description ~ '(CANCELAMENTO|MANUTENÇÃO) / LABORATÓRIO / (CANOAS|SLE)|CONSERTO INTERNO / LABORATÓRIO (CANOAS|SLE)'
                THEN 'LAB'
            WHEN po.description ~ 'A\.ALMOXARIFADO / (CANOAS|SÃO LEO)|ALMOXARIFADO - (CANOAS|SÃO LEOPOLDO) - (CANCELAMENTO|MANUTENÇÃO)'
                THEN 'ALMOX'
        END AS classe,
        -- troca de responsável em qualquer dashboard
        (po.occurrence_type = '5'
         AND po.description LIKE '%Sob Responsabilidade de%'
         AND po.title IS DISTINCT FROM 'Descarte Interno') AS is_resp
    FROM patrimony_occurrences po
    WHERE (po.occurrence_type = '5' AND po.description LIKE '%Sob Responsabilidade de%')
       OR po.description ~* '\mRMA\M|GARANTIA'
       OR po.title = 'Descarte Interno'
),
resumo AS (
    SELECT
        patrimony_id,
        (ARRAY_AGG(classe    ORDER BY created DESC, id DESC) FILTER (WHERE is_resp))[1] AS classe_resp_atual,
        (ARRAY_AGG(recebedor ORDER BY created DESC, id DESC) FILTER (WHERE is_resp))[1] AS responsavel_atual,
        BOOL_OR(classe = 'TERMINAL')                    AS teve_terminal,
        MAX(created) FILTER (WHERE classe = 'ALMOX')    AS ultimo_almox
    FROM oc
    GROUP BY patrimony_id
)
SELECT
    r.patrimony_id,
    r.responsavel_atual                                                         AS laboratorio_atual,
    MIN(oc.created)                                                             AS data_entrada_lab,
    ROUND((EXTRACT(EPOCH FROM NOW() - MIN(oc.created)) / 86400.0)::numeric, 1)  AS dias_em_aberto,
    CASE WHEN NOW() - MIN(oc.created) > INTERVAL '90 days'
         THEN 'Acima de 90 dias' ELSE 'Até 90 dias' END                         AS status_backlog_90
FROM resumo r
JOIN oc ON oc.patrimony_id = r.patrimony_id
       AND oc.classe = 'LAB'
       AND oc.created > COALESCE(r.ultimo_almox, '-infinity')
WHERE r.classe_resp_atual = 'LAB'
  AND NOT r.teve_terminal
GROUP BY r.patrimony_id, r.responsavel_atual;
