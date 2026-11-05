-- Réplica da consulta "DASH_ATUAL_TECNICOS" do Power BI "LOG - Objetos em Carga" (dsn=dbVoalle).
--
-- Patrimônios em carga: todo patrimônio que tem uma pessoa como responsável no
-- Voalle, com o produto, o valor de compra e a última movimentação.
--
-- SEM o join com os itens da nota fiscal de entrada que o Power BI fazia: ele
-- repetia o patrimônio uma vez por item da nota (até 123 vezes) e o valor total
-- saía 2,6x maior — R$ 26,4 mi contra R$ 10,15 mi em 04/11/2026. Corrigido por
-- decisão da área; a quantidade (contagem distinta) não muda.
SELECT
  p.id               AS patrimony_id,
  p.tag_number       AS patrimony_tag,
  p.serial_number    AS serial_number,
  p.title            AS description,
  sp.code            AS product_code,
  p.purchase_amount  AS item_value,
  p2.name            AS holder,
  p2.city            AS holder_city,
  p.modified         AS moved_at,
  -- filtros "Patrimônio ativo?" e "Patrimônio deletado?" (cadastro do patrimônio)
  p.active           AS is_active,
  p.deleted          AS is_deleted
FROM patrimonies p
JOIN people p2 ON p2.id = p.person_id
LEFT JOIN service_products sp ON sp.id = p.service_product_id
WHERE p2.name IS NOT NULL;
