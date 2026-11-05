-- Réplica da consulta "ÚLTIMO VÍNCULO" do Power BI
-- "CTR - Movimentação Equipamentos para Campo" (dsn=dbvoalle).
--
-- Equipamento USADO enviado a campo: toda ocorrência que passa o patrimônio
-- para "A.ALMOXARIFADO" DEPOIS de ele ter ido para o laboratório
-- ("CANCELAMENTO / LABORATÓRIO" ou "MANUTENÇÃO / LABORATÓRIO"), dos modelos
-- acompanhados ($1, lista em business-rules.ts).
--
-- A busca da passagem pelo laboratório olha o histórico inteiro; só a saída
-- é recortada em $2 — o painel não mostra nada antes disso.
WITH occurrence AS (
  SELECT
    po.patrimony_id      AS patrimony_id,
    po.created           AS created_at,
    po.description       AS description,
    p.title              AS equipment
  FROM patrimony_occurrences po
  LEFT JOIN patrimonies p ON p.id = po.patrimony_id
  WHERE p.title = ANY($1::text[])
)
SELECT patrimony_id, created_at, equipment, description
FROM occurrence
WHERE description LIKE '%A.ALMOXARIFADO%'
  AND created_at >= $2::date
  AND EXISTS (
    SELECT 1
    FROM occurrence lab
    WHERE lab.patrimony_id = occurrence.patrimony_id
      AND (lab.description LIKE '%CANCELAMENTO / LABORATÓRIO%' OR lab.description LIKE '%MANUTENÇÃO / LABORATÓRIO%')
      AND lab.created_at < occurrence.created_at
  )
ORDER BY patrimony_id, created_at;
