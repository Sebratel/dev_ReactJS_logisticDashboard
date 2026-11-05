-- Réplica da consulta "Usuários" do Power BI (dsn=dbVoalle).
-- Usada só para o filtro "colaborador/técnico ativo?", casando pelo NOME.
SELECT DISTINCT u.name AS name, u.active AS active
FROM users u
WHERE u.name IS NOT NULL;
