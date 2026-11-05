-- Réplica da consulta "OBJETOS CRIADOS" do Power BI "LOG - Gerencial" (dsn=dbVoalle).
--
-- Patrimônios criados no Voalle: a ocorrência "Criação do Objeto" de cada um.
-- O Power BI trazia uma linha por ocorrência (SELECT DISTINCT po.id, ...) e
-- somava a coluna CONTAGEM = 1 por dia; aqui a contagem já vem por dia.
-- $1 = início (2022-01-01, como no Power BI).
SELECT
  po.date::date            AS day,
  COUNT(DISTINCT po.id)    AS objects
FROM patrimony_occurrences po
WHERE po.title LIKE '%Criação do Objeto%'
  AND po.date >= $1
GROUP BY po.date::date;
