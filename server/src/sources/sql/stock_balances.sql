-- Réplica da consulta "Saldo Voalle" do Power BI (dsn=dbVoalle).
--
-- Grão: produto x unidade de negócio (base operacional) da empresa 1, com o
-- saldo disponível calculado pela própria view do Voalle.
-- O cruzamento com a planilha "Controle Estoque" e com os pedidos de compra
-- (feito no Power Query) acontece no modelo em memória, não aqui.
SELECT
  sp.code                AS product_code,
  sp.id                  AS product_id,
  sp.title               AS product_title,
  cpbu.description       AS base_name,
  v.disponible           AS available_units,
  sp.minimum_inventory   AS minimum_inventory,
  CASE WHEN sp.generate_patrimony IS TRUE THEN 'PATRIMONY' ELSE 'PRODUCT' END AS item_type,
  -- filtros "Ativo?" e "Deletado?" das telas de alerta (cadastro do produto)
  sp.active              AS is_active,
  sp.deleted             AS is_deleted
FROM v_company_place_business_units_movimentations v
LEFT JOIN company_place_business_units cpbu ON cpbu.id = v.company_place_business_unit_id
LEFT JOIN service_products sp ON sp.id = v.service_product_id
LEFT JOIN companies_places cp ON cp.id = v.company_place_id
WHERE sp.title IS NOT NULL
  AND cp.id = 1
  AND cpbu.description <> 'PROJETO NHO'
  AND cpbu.deleted IS NOT TRUE;
