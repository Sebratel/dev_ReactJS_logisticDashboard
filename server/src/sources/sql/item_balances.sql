-- Réplica da consulta "Produtos" do Power BI "CMP - Lançamento e Saldos" (dsn=dbVoalle).
--
-- Saldo disponível já SOMADO por produto e unidade de negócio (base) da
-- empresa 1. Não é o mesmo recorte do "Saldo de estoque" das telas de alerta:
-- aqui entram todas as bases (inclusive as de projeto) e a unidade de medida.
--
-- Lida a cada minuto (carga "ao vivo"): ~20 mil linhas em menos de 1 s.
SELECT
  sp.code                AS product_code,
  sp.title               AS product_title,
  cpbu.description       AS base_name,
  SUM(v.disponible)      AS available_units,
  um.title               AS unit_measure,
  sp.inventory_update    AS updates_stock,
  sp.generate_patrimony  AS generates_patrimony
FROM v_company_place_business_units_movimentations v
LEFT JOIN company_place_business_units cpbu ON cpbu.id = v.company_place_business_unit_id
LEFT JOIN service_products sp ON sp.id = v.service_product_id
LEFT JOIN companies_places cp ON cp.id = v.company_place_id
LEFT JOIN units_measures um ON um.id = sp.first_unit
WHERE sp.title IS NOT NULL
  AND cp.id = 1
  AND cpbu.deleted IS NOT TRUE
GROUP BY sp.code, sp.title, um.title, cpbu.description, sp.inventory_update, sp.generate_patrimony
ORDER BY sp.title;
