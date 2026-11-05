-- Réplica da consulta "PRIMEIRO VÍNCULO" do Power BI
-- "CTR - Movimentação Equipamentos para Campo" (dsn=dbvoalle).
--
-- Equipamento NOVO enviado a campo: o PRIMEIRO "Enviado em Romaneio" de cada
-- patrimônio dos modelos acompanhados ($1, lista em business-rules.ts).
--
-- O "primeiro" é calculado sobre o histórico inteiro (um patrimônio que saiu
-- em 2023 não é novo em 2025); só a SAÍDA é recortada em $2 — o painel não
-- mostra nada antes disso (no Power BI o recorte ficava nos visuais).
--
-- A lista "NOT IN" do Power BI não foi copiada: ela só tinha modelos que já
-- estão fora da lista "IN", então não mudava nada.
WITH first_link AS (
  SELECT
    p.id                 AS patrimony_id,
    po.created           AS created_at,
    p.title              AS equipment,
    po.description       AS description,
    ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY po.created ASC) AS rn
  FROM patrimony_occurrences po
  LEFT JOIN patrimonies p ON p.id = po.patrimony_id
  WHERE po.title = 'Enviado em Romaneio'
    AND p.title = ANY($1::text[])
)
SELECT patrimony_id, created_at, equipment, description
FROM first_link
WHERE rn = 1
  AND created_at >= $2::date;
