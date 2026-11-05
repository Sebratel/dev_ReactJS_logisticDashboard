-- Réplica da consulta "Objetos Pendentes" do Power BI (dsn=dbVoalle).
--
-- Itens comprados que ainda não viraram patrimônio (saldo a patrimoniar).
-- O Power Query descartava as linhas com saldo -1 depois da consulta; aqui o
-- filtro já vem no WHERE.
SELECT
  t.document_number     AS invoice_number,
  ppg.date              AS entry_date,
  sp.code               AS product_code,
  sp.title              AS product_title,
  ppg.units             AS total_units,
  ppg.balance           AS pending_units,
  cpbu.description      AS base_name
FROM patrimonies_pending_generations ppg
LEFT JOIN invoice_notes t ON t.id = ppg.invoice_note_id
LEFT JOIN service_products sp ON sp.id = ppg.service_product_id
LEFT JOIN company_place_business_units cpbu ON cpbu.id = ppg.company_place_business_unit_id
WHERE ppg.balance <> 0
  AND ppg.balance <> -1;
