-- EXPLAIN ANALYZE das consultas criticas (rodar com 10k pessoas semeadas):
--   docker exec -i ft-bench psql -U familytree -d familytree -f - < tools/seed/explain.sql
\set ON_ERROR_STOP on
SELECT p.id AS focus FROM person p
  JOIN relationship a ON a.to_person_id = p.id AND a.type = 'PARENT_OF'
  JOIN relationship b ON b.from_person_id = p.id AND b.type = 'PARENT_OF'
  GROUP BY p.id ORDER BY count(*) DESC, p.id LIMIT 1 \gset
\echo '=== graph: collectIds (up=10 down=10) ==='
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) WITH RECURSIVE
anc(id, d) AS (SELECT :'focus'::uuid, 0 UNION
  SELECT r.from_person_id, a.d + 1 FROM relationship r JOIN anc a ON r.to_person_id = a.id WHERE r.type = 'PARENT_OF' AND a.d < 10),
dsc(id, d) AS (SELECT :'focus'::uuid, 0 UNION
  SELECT r.to_person_id, x.d + 1 FROM relationship r JOIN dsc x ON r.from_person_id = x.id WHERE r.type = 'PARENT_OF' AND x.d < 10),
core AS (SELECT id, d FROM anc UNION SELECT id, d FROM dsc),
allp AS (SELECT id, d FROM core UNION ALL
  SELECT CASE WHEN r.from_person_id = c.id THEN r.to_person_id ELSE r.from_person_id END, c.d + 1
  FROM core c JOIN relationship r ON r.type = 'PARTNER' AND (r.from_person_id = c.id OR r.to_person_id = c.id))
SELECT id FROM allp GROUP BY id ORDER BY min(d), id LIMIT 501;
\echo '=== search: substring + trigram ==='
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) SELECT id FROM person
  WHERE (search_name % 'silva' OR search_name LIKE '%silva%') ORDER BY similarity(search_name, 'silva') DESC, search_name, id LIMIT 10;
\echo '=== search: nome raro (2 palavras) ==='
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) SELECT id FROM person
  WHERE (search_name % 'joao silva' OR search_name LIKE '%joao silva%') ORDER BY similarity(search_name, 'joao silva') DESC, search_name, id LIMIT 10;
