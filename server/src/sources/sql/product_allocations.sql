-- Réplica da consulta "Consumo Produtos" do Power BI (dsn=dbVoalle).
--
-- Produtos (e cabos) alocados em protocolo, com a nota de baixa. É a consulta
-- mais cara do painel: a view v_allocated_products leva minutos no Voalle.
--
-- Diferença proposital: o Power BI trazia o título inteiro do protocolo
-- ("Protocolo 1874780 - TEC-MANUT-... - NOME DO CLIENTE") e depois recortava
-- os 7 dígitos do número. Aqui o recorte acontece no banco: o título não é
-- exibido em lugar nenhum e carregar ~700 mil textos longos só para jogá-los
-- fora custava memória à toa. Mesmo recorte: Text.Middle(título, 10, 7).
SELECT
  vap.id                               AS allocation_id,
  vap.responsible_name                 AS technician,
  vap.service_product_code             AS product_code,
  vap.service_product_title            AS product_title,
  vap.allocated_amount                 AS allocated_units,
  vap.first_unit_measure_title         AS unit_measure,
  vap.invoice_note_document_number     AS invoice_number,
  i.created                            AS created_at,
  i.issue_date                         AS issue_date,
  SUBSTRING(a.title FROM 11 FOR 7)     AS protocol_number,
  r.title                              AS region
FROM v_allocated_products vap
LEFT JOIN invoice_notes i ON i.id = vap.invoice_note_id
LEFT JOIN assignments a ON a.id = vap.assignment_id
LEFT JOIN regions r ON r.id = a.region_id
WHERE i.issue_date >= $1::date;
