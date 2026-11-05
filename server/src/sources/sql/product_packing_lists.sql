-- Réplica da consulta "Romaneio Produtos/ Cabos" do Power BI (dsn=dbVoalle).
--
-- Movimentações de produto (sp.type = 1) entre pessoas feitas pelo time do
-- almoxarifado: quem cria a movimentação é o FORNECEDOR, a pessoa de destino é
-- o RECEBEDOR. A lista de fornecedores vem do modelo ($2), do mesmo arquivo de
-- regras de negócio usado pelos filtros das telas.
--
-- CORREÇÃO em relação ao Power BI: na consulta original faltava uma vírgula
-- entre 'RAONI SILVA DA SILVA' e 'SAMUEL FIGUEIRA DUTRA'. O PostgreSQL junta
-- literais separados por quebra de linha, então os dois nomes viravam um só e
-- as movimentações dos dois ficavam de fora. Com a lista em parâmetro os dois
-- entram, como era a intenção (eles aparecem nos filtros visuais do relatório).
--
-- A exclusão de 04/09/2025 replica o ajuste do Power BI: nesse dia houve uma
-- carga de inventário para as contas de almoxarifado que não é romaneio.
SELECT DISTINCT
  ppm.id                AS movement_id,
  ivn.document_number   AS document_number,
  ppm.units             AS units,
  sp.code               AS product_code,
  sp.id                 AS product_id,
  sp.title              AS product_title,
  cpbu.description      AS base_name,
  ppm.created           AS created_at,
  p.name                AS receiver,
  p2.name               AS supplier
FROM person_product_movimentations ppm
LEFT JOIN people p ON p.id = ppm.person_id
LEFT JOIN service_products sp ON sp.id = ppm.service_product_id
LEFT JOIN v_users p2 ON p2.id = ppm.created_by
LEFT JOIN company_place_business_units cpbu ON cpbu.id = ppm.company_place_business_unit_id
LEFT JOIN invoice_notes ivn ON ivn.id = ppm.invoice_note_id
WHERE ppm.created >= $1::date
  AND p2.name = ANY($2::text[])
  AND sp."type" = '1'
  AND NOT (
    DATE(ppm.created) = '2025-09-04'
    AND p.name IN ('A.ALMOXARIFADO / SÃO LEO', 'A.ALMOXARIFADO / SEDE PORTO ALEGRE', 'A.ALMOXARIFADO / CANOAS')
  );
