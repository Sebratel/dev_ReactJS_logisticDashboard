-- Réplica da consulta "Base_Senior" do Power BI (dsn=dbMaria).
-- Uma linha por nome (a matrícula mais recente), com a base operacional e a
-- equipe do colaborador no RH. Casa com o responsável do patrimônio pelo nome.
WITH ranked AS (
  SELECT sn.name,
         sn.registration,
         sn.operational_base,
         sn.team,
         ROW_NUMBER() OVER (PARTITION BY sn.name ORDER BY sn.registration DESC) AS rn
  FROM API_WebDeveloper.db_senior_collaborators sn
)
SELECT name, registration, operational_base, team
FROM ranked
WHERE rn = 1;
