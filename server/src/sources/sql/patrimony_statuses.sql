-- Réplica da consulta "Status Real Patrimonio" do Power BI (dsn=dbVoalle).
--
-- O status atual de cada patrimônio é deduzido da ÚLTIMA ocorrência registrada
-- para ele (maior id). Os códigos de occurrence_type são do Voalle; a tradução
-- abaixo é exatamente a do Power BI, inclusive a regra do laboratório: uma
-- movimentação técnica (5) para o laboratório que termina em ponto final já
-- foi recebida ("Resp. Lab"); sem o ponto, ainda está a caminho.
WITH ultimas_ocorrencias AS (
  SELECT
    p.id AS patrimony_id,
    p.serial_number,
    p.tag_number,
    p.p_is_disponible,
    p.last_occurrence_description,
    p.service_product_id,
    p.company_place_business_unit_id,
    po.occurrence_type,
    po.title AS occurrence_title,
    ROW_NUMBER() OVER (PARTITION BY po.patrimony_id ORDER BY po.id DESC, po.date DESC) AS rn
  FROM patrimony_occurrences po
  LEFT JOIN patrimonies p ON p.id = po.patrimony_id
)
SELECT
  sp.id                 AS product_id,
  sp.code               AS product_code,
  sp.title              AS product_title,
  p.title               AS patrimony_title,
  pe.name               AS responsible,
  cpbu.description      AS base_name,
  uo.patrimony_id       AS patrimony_id,
  uo.serial_number      AS serial_number,
  uo.tag_number         AS patrimony_tag,
  -- filtros "Ativo?" e "Deletado?" do status real (cadastro do patrimônio)
  p.active              AS is_active,
  p.deleted             AS is_deleted,
  CASE
    WHEN uo.occurrence_type IN ('12', '23') THEN 'Aguardando Retorno'
    WHEN uo.occurrence_type = '33' THEN 'Extraviado'
    WHEN uo.occurrence_type = '13' THEN 'Descarte'
    WHEN uo.occurrence_type = '28' THEN 'Vendido'
    WHEN uo.occurrence_type = '2'  THEN 'Alocado Cliente'
    WHEN uo.occurrence_type = '15' THEN 'Alocado Site'
    WHEN uo.occurrence_type = '5' THEN
      CASE
        WHEN (uo.last_occurrence_description LIKE '%MANUTENÇÃO / LABORATÓRIO / CANOAS%'
              OR uo.last_occurrence_description LIKE '%CANCELAMENTO / LABORATÓRIO / SLE%')
             AND TRIM(uo.last_occurrence_description) LIKE '%.'
        THEN 'Resp. Lab'
        WHEN (uo.last_occurrence_description LIKE '%MANUTENÇÃO / LABORATÓRIO / CANOAS%'
              OR uo.last_occurrence_description LIKE '%CANCELAMENTO / LABORATÓRIO / SLE%')
        THEN 'Aguardando Retorno'
        ELSE 'Resp. Técnico'
      END
    WHEN uo.p_is_disponible IS TRUE THEN 'Disponível'
    WHEN uo.occurrence_type IN ('6', '10', '1') OR uo.occurrence_title LIKE '%Disponível%' THEN 'Disponível'
    ELSE 'Outros (' || COALESCE(uo.occurrence_title, 'Sem Histórico') || ')'
  END                   AS current_status
FROM ultimas_ocorrencias uo
LEFT JOIN service_products sp ON sp.id = uo.service_product_id
LEFT JOIN company_place_business_units cpbu ON cpbu.id = uo.company_place_business_unit_id
LEFT JOIN companies_places cp ON cp.id = cpbu.company_place_id
LEFT JOIN patrimonies p ON p.id = uo.patrimony_id
LEFT JOIN people pe ON pe.id = p.person_id
WHERE uo.rn = 1
  AND sp.title IS NOT NULL
  AND cp.id = 1
  AND cpbu.description <> 'PROJETO NHO'
  AND cpbu.deleted IS NOT TRUE;
