-- Réplica da consulta "QuantidadeRomaneios" do Power BI "LOG - Gerencial" (dsn=dbVoalle),
-- a da página "PRODUTIVIDADE ALMOX".
--
-- Patrimônios enviados em romaneio, por quem lançou, mês e romaneio (a
-- descrição da ocorrência identifica o romaneio: o Power BI contava os
-- romaneios como descrições DISTINTAS e os patrimônios como ocorrências).
-- Só os dois meses que a página usa (os dois últimos fechados): o Power BI
-- carregava desde 2023, mas todo visual e medida filtrava esses dois.
-- $1 = 1º dia do penúltimo mês fechado · $2 = 1º dia do mês corrente.
SELECT
  vu.name                         AS name,
  to_char(po.date, 'YYYY-MM')     AS month,
  po.description                  AS description,
  COUNT(po.id)                    AS patrimonies
FROM patrimony_occurrences po
LEFT JOIN v_users vu ON vu.id = po.created_by
WHERE po.title LIKE '%Enviado em Romaneio%'
  AND po.date >= $1::date
  AND po.date < $2::date
GROUP BY vu.name, to_char(po.date, 'YYYY-MM'), po.description;
