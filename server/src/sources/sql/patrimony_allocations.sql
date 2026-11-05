-- Réplica da consulta "Consumo Patrimônios" do Power BI (dsn=dbVoalle).
--
-- Cada linha é a saída de um patrimônio num romaneio de atendimento (packing
-- list), com o retorno, quem alocou e o cliente/responsável que recebeu.
-- O JOIN com assignment_incidents é o do Power BI e pode repetir a saída quando
-- o atendimento tem mais de um protocolo — a tela conta exatamente como lá.
--
-- Diferença proposital: são ~570 mil linhas desde 2024, então só vêm as colunas
-- que alguma tela mostra ou filtra. Os JOINs que só alimentavam colunas nunca
-- exibidas (quem registrou, ponto de acesso, tipo de incidente, problema)
-- casavam pela chave primária: tirá-los não muda nenhuma linha.
SELECT
  ai.protocol           AS protocol_number,
  p.title               AS equipment,
  p.tag_number          AS patrimony_tag,
  p.serial_number       AS serial_number,
  plis.created          AS out_at,
  plis.returned         AS returned,
  plis.returned_date    AS returned_date,
  p3.name               AS allocated_by,
  p4.name               AS current_holder,
  as2.title             AS site,
  p4.city               AS city
FROM patrimony_packing_list_items plis
LEFT JOIN patrimony_packing_lists ppl ON ppl.id = plis.patrimony_packing_list_id
LEFT JOIN assignments a ON a.id = ppl.assignment_id
LEFT JOIN assignment_incidents ai ON ai.assignment_id = a.id
LEFT JOIN patrimonies p ON p.id = plis.patrimony_id
LEFT JOIN people p3 ON p3.id = plis.person_allocator_id
LEFT JOIN people p4 ON p4.id = ppl.responsible_id
LEFT JOIN authentication_sites as2 ON as2.id = ppl.authentication_site_id
WHERE plis.out_date > $1::date;
