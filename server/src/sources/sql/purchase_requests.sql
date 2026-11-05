-- Réplica da consulta "Pedidos Compra" do Power BI (dsn=dbVoalle).
--
-- Pedidos de aquisição aguardando entrega. A base de destino não existe como
-- campo: o time escreve o CEP da base na observação do pedido, e é por ele que
-- a base é reconhecida (mesma regra do Power BI).
--
-- `par.status = 4` é o código do Voalle para pedido aprovado aguardando entrega.
SELECT *
FROM (
  SELECT
    par.id                           AS request_id,
    sp.code                          AS product_code,
    sp.title                         AS product_title,
    par.date                         AS request_date,
    p.name                           AS requested_by,
    par.receipt_date_prevision       AS expected_date,
    pari.units                       AS units,
    par.observation                  AS observation,
    CASE
      WHEN UPPER(par.observation) LIKE '%93120%' THEN 'BASE OPERACIONAL - SÃO LEOPOLDO'
      WHEN UPPER(par.observation) LIKE '%92010%' THEN 'BASE OPERACIONAL - CANOAS'
      WHEN UPPER(par.observation) LIKE '%90230%' THEN 'SEDE - PORTO ALEGRE'
      ELSE ''
    END                              AS base_name
  FROM product_acquisition_requests par
  LEFT JOIN product_acquisition_request_items pari ON pari.product_acquisition_request_id = par.id
  LEFT JOIN service_products sp ON sp.id = pari.service_product_id
  LEFT JOIN people p ON p.id = par.person_id
  WHERE par.status = 4
    AND par.deleted IS FALSE
  GROUP BY par.id, sp.code, sp.title, par.date, p.name, par.receipt_date_prevision, pari.units
) requests
WHERE base_name <> ''
ORDER BY request_date DESC;
