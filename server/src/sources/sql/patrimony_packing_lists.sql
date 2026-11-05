-- Réplica da consulta "Romaneio de Patrimônios" do Power BI (dsn=dbVoalle).
--
-- Ocorrências do tipo 5 (movimento técnico/romaneio) cuja descrição segue o
-- padrão "... Nº 1234 ... Sob Responsabilidade de FULANO." — o número do
-- romaneio e o recebedor só existem nesse texto. Fornecedor é o usuário que
-- registrou a ocorrência, restrito ao time do almoxarifado ($2).
--
-- Mesma CORREÇÃO da consulta de romaneio de produtos: a vírgula que faltava
-- entre 'RAONI SILVA DA SILVA' e 'SAMUEL FIGUEIRA DUTRA' (ver lá).
SELECT
  po.created                                                        AS moved_at,
  sp.code                                                           AS product_code,
  sp.title                                                          AS product_title,
  cpbu.description                                                  AS base_name,
  p.id                                                              AS patrimony_id,
  p.serial_number                                                   AS serial_number,
  p.tag_number                                                      AS patrimony_tag,
  SUBSTRING(po.description FROM 'N[º°]\s*(\d+)')                    AS packing_number,
  u.name                                                            AS supplier,
  RTRIM(SUBSTRING(po.description FROM 'Sob Responsabilidade de\s+(.+)'), ' .') AS receiver
FROM patrimony_occurrences po
LEFT JOIN patrimonies p ON p.id = po.patrimony_id
LEFT JOIN service_products sp ON sp.id = p.service_product_id
LEFT JOIN company_place_business_units cpbu ON cpbu.id = p.company_place_business_unit_id
LEFT JOIN companies_places cp ON cp.id = cpbu.company_place_id
LEFT JOIN users u ON u.id = po.created_by
WHERE po.occurrence_type = '5'
  AND po.description LIKE '%Sob Responsabilidade de%'
  AND sp.title IS NOT NULL
  AND cp.id = 1
  AND cpbu.description <> 'PROJETO NHO'
  AND cpbu.deleted IS NOT TRUE
  AND po.created >= $1::date
  AND u.name = ANY($2::text[]);
