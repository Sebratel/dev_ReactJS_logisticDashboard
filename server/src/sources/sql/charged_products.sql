-- Réplica da consulta "DASH_ATUAL_CONSUMOS" do Power BI "LOG - Objetos em Carga" (dsn=dbVoalle).
--
-- Saldo de produtos em carga: o que cada pessoa tem de produto/cabo, pela view
-- de movimentação interna do Voalle (saldo atual diferente de zero), com o preço
-- unitário do lançamento. O app agrupa por pessoa, produto, unidade e preço
-- (como o Power Query) e calcula o valor como quantidade x preço unitário.
SELECT DISTINCT
  p.name                AS holder,
  p.city                AS holder_city,
  sp.code               AS product_code,
  sp.title              AS description,
  vimp.actual_balance   AS balance,
  um.title              AS unit_measure,
  ppm.unit_amount       AS unit_value,
  ppm.id                AS movement_id,
  -- filtros "Produto ativo?" e "Produto deletado?" (cadastro do produto)
  sp.active             AS is_active,
  sp.deleted            AS is_deleted
FROM v_internal_movimentations_products vimp
LEFT JOIN service_products sp ON sp.id = vimp.service_product_id
LEFT JOIN people p ON p.id = vimp.person_id
LEFT JOIN person_product_movimentations ppm ON ppm.id = vimp.person_product_movimentation_id
LEFT JOIN units_measures um ON um.id = vimp.first_units_measure_id
WHERE vimp.actual_balance <> 0;
