-- Réplica da consulta "Notas Romaneio Patrimônios" do Power BI (dsn=dbVoalle),
-- que alimenta a tabela "HISTÓRICO DE ROMANEIOS" da tela de alerta de patrimônios.
--
-- Diferença proposital: no Power BI a consulta trazia TODAS as ocorrências de
-- patrimônio desde 2024 (~1,3 milhão de linhas) e só o visual filtrava os
-- responsáveis do almoxarifado ($2) e descartava os recebedores que são contas
-- internas ($3). Como essa tabela não tem outro uso, os dois filtros vieram
-- para cá: o resultado do visual é o mesmo e a memória do servidor agradece.
SELECT *
FROM (
  SELECT DISTINCT
    u.name                                                          AS responsible,
    po.created                                                      AS created_at,
    p2.name                                                         AS holder,
    po.id                                                           AS occurrence_id,
    p.id                                                            AS patrimony_id,
    p.serial_number                                                 AS serial_number,
    p.tag_number                                                    AS patrimony_tag,
    p.title                                                         AS description,
    po.date                                                         AS moved_date,
    SUBSTRING(po.description FROM 'Sob Responsabilidade de (.+)')   AS received_by
  FROM patrimony_occurrences po
  LEFT JOIN patrimonies p ON p.id = po.patrimony_id
  LEFT JOIN people p2 ON p2.id = p.person_id
  LEFT JOIN users u ON u.id = po.created_by
  WHERE po.date >= $1::date
    AND u.name = ANY($2::text[])
) notes
WHERE received_by IS NOT NULL
  AND NOT (received_by = ANY($3::text[]));
