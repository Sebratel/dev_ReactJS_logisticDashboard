-- Réplica da consulta "Consumo Voalle" do Power BI "LOG - Gerencial" (dsn=dbVoalle),
-- a da página "CONSUMO DE FLAT".
--
-- Metros do cabo flat entregues, por dia, quem recebeu e quem entregou (o
-- usuário que lançou a movimentação). O DISTINCT de dentro é o do Power BI,
-- INCLUSIVE o join com as equipes de quem recebeu: a mesma entrega aparece
-- uma vez por equipe da pessoa e entra repetida na soma (~13% a mais). Mantido
-- por decisão da área (05/11/2026), para os números baterem com o Power BI.
--
-- Os filtros de quem entregou e de quem recebeu ficam no app
-- (FLAT_SUPPLIERS e FLAT_EXCLUDED_RECEIVERS em business-rules.ts).
-- $1 = início (2024-01-01) · $2 = código do flat · $3 = dia do ajuste de
-- inventário descartado · $4 = almoxarifados desse ajuste.
SELECT
  m.created::date   AS day,
  m.receiver        AS receiver,
  m.supplier        AS supplier,
  SUM(m.units)      AS units
FROM (
  SELECT DISTINCT
    ppm.units,
    sp.code,
    sp.id,
    sp.title,
    cpbu.description,
    ppm.created,
    p.name    AS receiver,
    p2.name   AS supplier,
    t.title   AS team
  FROM person_product_movimentations ppm
  LEFT JOIN people p ON p.id = ppm.person_id
  LEFT JOIN service_products sp ON sp.id = ppm.service_product_id
  LEFT JOIN v_users p2 ON p2.id = ppm.created_by
  LEFT JOIN company_place_business_units cpbu ON cpbu.id = ppm.company_place_business_unit_id
  LEFT JOIN people_teams pt ON pt.person_id = p.id
  LEFT JOIN teams t ON t.id = pt.team_id
  WHERE ppm.created >= $1
    AND sp."type" = '1'
    AND sp.code = $2
    AND NOT (DATE(ppm.created) = $3::date AND p.name = ANY($4))
) m
GROUP BY m.created::date, m.receiver, m.supplier;
