-- Réplica da consulta "Pedido de Compra" do Power BI "CMP - Lançamento e Saldos" (dsn=dbVoalle).
--
-- Uma linha por item de pedido de aquisição lançado a partir de $1 (o Power BI
-- fixava 01/01/2026), em qualquer status, inclusive cancelado e deletado — a
-- tela filtra. Pedido sem item vem numa linha só, sem produto.
--
-- A base de entrega não existe como campo: é reconhecida pelo endereço que o
-- time escreve na observação do pedido (rua da base — regra do Power BI). Sem
-- endereço reconhecido, fica em branco.
--
-- Lida a cada minuto (carga "ao vivo"): ~8 mil linhas em menos de 0,5 s.
SELECT
  par.id                      AS order_id,
  par.date                    AS order_date,
  par.receipt_date_prevision  AS expected_date,
  p2.name                     AS supplier,
  p.name                      AS requested_by,
  par.status                  AS status_code,
  par.deleted                 AS deleted,
  par.total_request           AS order_total,
  CASE
    WHEN UPPER(par.observation) LIKE '%SCHARLAU%' THEN 'BASE OPERACIONAL - SÃO LEOPOLDO'
    WHEN UPPER(par.observation) LIKE '%VICTOR BARRETO%' THEN 'BASE OPERACIONAL - CANOAS'
    WHEN UPPER(par.observation) LIKE '%NAVEGANTES%' THEN 'SEDE - PORTO ALEGRE'
  END                         AS base_name,
  pari.id                     AS item_id,
  sp.code                     AS product_code,
  sp.title                    AS product_title,
  um.title                    AS unit_measure,
  pari.units                  AS units,
  pari.unit_amount            AS unit_amount,
  pari.item_amount            AS item_amount,
  pari.total_amount           AS total_amount,
  sp.inventory_update         AS updates_stock,
  sp.generate_patrimony       AS generates_patrimony
FROM product_acquisition_requests par
LEFT JOIN product_acquisition_request_items pari ON pari.product_acquisition_request_id = par.id
LEFT JOIN service_products sp ON sp.id = pari.service_product_id
LEFT JOIN units_measures um ON um.id = sp.first_unit
LEFT JOIN people p ON p.id = par.person_id
LEFT JOIN people p2 ON p2.id = par.supplier_id
WHERE par.date >= $1
ORDER BY par.id DESC, pari.id;
