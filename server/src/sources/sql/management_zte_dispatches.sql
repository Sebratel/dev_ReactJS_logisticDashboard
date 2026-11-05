-- Réplica da consulta "PRIMEIRO VÍNCULO" do Power BI "LOG - Gerencial" (dsn=dbVoalle).
--
-- ONUs ZTE NOVAS: o PRIMEIRO "Enviado em Romaneio" de cada patrimônio dos
-- modelos acompanhados, contado por dia.
-- $1 = modelos (ZTE_MOVEMENT_MODELS em business-rules.ts).
WITH ranked AS (
  SELECT
    p.id,
    po.created,
    ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY po.created ASC) AS rn
  FROM patrimony_occurrences po
  LEFT JOIN patrimonies p ON p.id = po.patrimony_id
  WHERE po.title = 'Enviado em Romaneio'
    AND p.title = ANY($1)
)
SELECT
  created::date   AS day,
  COUNT(*)        AS dispatches
FROM ranked
WHERE rn = 1
GROUP BY created::date;
