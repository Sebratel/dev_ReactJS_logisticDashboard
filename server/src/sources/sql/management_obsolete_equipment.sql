-- Réplica da consulta "EQUIPAMENTO OBSOLETOS" do Power BI "LOG - Gerencial" (dsn=dbVoalle).
--
-- Patrimônios sob a conta do depósito de rádio. A medida do Power BI conta os
-- seriais DISTINTOS com data de movimentação até o fim do período; para isso
-- basta a primeira data de cada serial (o serial vazio conta como um valor,
-- como no DISTINCTCOUNT). A data é a última modificação do patrimônio
-- (`modified`), a mesma do Power BI. Sem o join com os itens da nota fiscal,
-- que só repetia linhas que o DISTINCT juntava de novo.
-- $1 = a pessoa (OBSOLETE_EQUIPMENT_HOLDER em business-rules.ts).
SELECT
  p.serial_number           AS serial_number,
  MIN(p.modified::date)     AS first_day
FROM patrimonies p
LEFT JOIN people p2 ON p2.id = p.person_id
WHERE p2.name = $1
GROUP BY p.serial_number;
