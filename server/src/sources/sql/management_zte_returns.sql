-- Réplica das consultas "ÚLTIMO VÍNCULO" e "USADOS CLASSIFICADO" do Power BI
-- "LOG - Gerencial" (dsn=dbVoalle), juntas.
--
-- ONUs ZTE USADAS: cada volta ao almoxarifado ("A.ALMOXARIFADO" na descrição)
-- de um patrimônio que ANTES passou pelo laboratório (cancelamento ou
-- manutenção) — o "ÚLTIMO VÍNCULO", que apesar do nome traz todas as voltas.
-- A ORIGEM é a do "USADOS CLASSIFICADO": a passagem pelo laboratório mais
-- recente antes da volta (cancelamento, manutenção ou conserto interno). No
-- Power BI as duas tabelas se ligavam pela chave patrimônio + data/hora da
-- volta; aqui a origem já vem na mesma linha. Contado por dia, modelo e origem.
--
-- Uma passada só pelas ocorrências dos modelos (funções de janela): "antes"
-- é estritamente anterior, como o `<` das consultas originais — a janela
-- termina 1 microssegundo antes da ocorrência.
-- $1 = modelos (ZTE_MOVEMENT_MODELS em business-rules.ts).
WITH occurrences AS MATERIALIZED (
  SELECT
    po.patrimony_id,
    po.created,
    p.title,
    po.description LIKE '%A.ALMOXARIFADO%' AS is_return,
    -- o teste do ÚLTIMO VÍNCULO (LIKE, só cancelamento e manutenção)
    (po.description LIKE '%CANCELAMENTO / LABORATÓRIO%'
      OR po.description LIKE '%MANUTENÇÃO / LABORATÓRIO%') AS is_lab,
    -- a classificação do USADOS CLASSIFICADO (ILIKE, com o conserto interno)
    CASE
      WHEN po.description ILIKE '%CANCELAMENTO%LABORAT%' THEN 'CANCELAMENTO'
      WHEN po.description ILIKE '%MANUTEN%LABORAT%' THEN 'MANUTENÇÃO'
      WHEN po.description ILIKE '%CONSERTO INTERNO%LABORAT%' THEN 'CONSERTO INTERNO (fora do escopo)'
    END AS lab_origin
  FROM patrimony_occurrences po
  JOIN patrimonies p ON p.id = po.patrimony_id
  WHERE p.title = ANY($1)
),
marked AS (
  SELECT
    o.*,
    COUNT(*) FILTER (WHERE o.is_lab) OVER before AS labs_before,
    COUNT(o.lab_origin) OVER before            AS origins_before
  FROM occurrences o
  WINDOW before AS (
    PARTITION BY o.patrimony_id ORDER BY o.created
    RANGE BETWEEN UNBOUNDED PRECEDING AND '1 microsecond'::interval PRECEDING
  )
),
origins AS (
  SELECT
    patrimony_id,
    lab_origin,
    ROW_NUMBER() OVER (PARTITION BY patrimony_id ORDER BY created) AS n
  FROM occurrences
  WHERE lab_origin IS NOT NULL
)
SELECT
  m.created::date                                      AS day,
  m.title                                              AS model,
  COALESCE(g.lab_origin, 'SEM ORIGEM IDENTIFICADA')    AS origin,
  COUNT(*)                                             AS returns
FROM marked m
LEFT JOIN origins g ON g.patrimony_id = m.patrimony_id AND g.n = m.origins_before
WHERE m.is_return
  AND m.labs_before > 0
GROUP BY m.created::date, m.title, COALESCE(g.lab_origin, 'SEM ORIGEM IDENTIFICADA');
