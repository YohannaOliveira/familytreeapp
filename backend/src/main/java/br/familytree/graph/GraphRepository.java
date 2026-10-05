package br.familytree.graph;

import br.familytree.graph.GraphResponse.GraphPerson;
import br.familytree.graph.GraphResponse.GraphRelationship;
import br.familytree.graph.GraphResponse.HiddenCount;
import br.familytree.person.Gender;
import br.familytree.relationship.RelationshipType;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** SQL das consultas de grafo. Listas de ids vao como um unico literal uuid[] (sem N+1, sem IN gigante). */
@Repository
public class GraphRepository {

    private final JdbcClient jdbc;

    public GraphRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private static String arr(Collection<UUID> ids) {
        return ids.stream().map(UUID::toString).collect(Collectors.joining(",", "{", "}"));
    }

    /** Foco + ancestrais ate {@code up} + descendentes ate {@code down} (+ parceiros), mais proximos primeiro. */
    public List<UUID> collectIds(UUID focus, int up, int down, boolean partners, int limit) {
        return jdbc.sql("""
                WITH RECURSIVE
                anc(id, d) AS (
                    SELECT CAST(:focus AS uuid), 0
                    UNION
                    SELECT r.from_person_id, a.d + 1 FROM relationship r JOIN anc a ON r.to_person_id = a.id
                    WHERE r.type = 'PARENT_OF' AND a.d < :up),
                dsc(id, d) AS (
                    SELECT CAST(:focus AS uuid), 0
                    UNION
                    SELECT r.to_person_id, x.d + 1 FROM relationship r JOIN dsc x ON r.from_person_id = x.id
                    WHERE r.type = 'PARENT_OF' AND x.d < :down),
                core AS (SELECT id, d FROM anc UNION SELECT id, d FROM dsc),
                allp AS (
                    SELECT id, d FROM core
                    UNION ALL
                    SELECT CASE WHEN r.from_person_id = c.id THEN r.to_person_id ELSE r.from_person_id END, c.d + 1
                    FROM core c JOIN relationship r
                      ON r.type = 'PARTNER' AND (r.from_person_id = c.id OR r.to_person_id = c.id)
                    WHERE :partners)
                SELECT id FROM allp GROUP BY id ORDER BY min(d), id LIMIT :limit
                """)
                .param("focus", focus).param("up", up).param("down", down)
                .param("partners", partners).param("limit", limit)
                .query(UUID.class).list();
    }

    /** Vizinhos diretos: PARENTS ({@code up}), CHILDREN ({@code down}) ou PARTNERS. */
    public List<UUID> neighbors(UUID id, GraphService.Direction direction, int limit) {
        String sql = switch (direction) {
            case UP -> "SELECT from_person_id FROM relationship WHERE type = 'PARENT_OF' AND to_person_id = :id";
            case DOWN -> "SELECT to_person_id FROM relationship WHERE type = 'PARENT_OF' AND from_person_id = :id";
            case PARTNERS -> "SELECT CASE WHEN from_person_id = :id THEN to_person_id ELSE from_person_id END"
                    + " FROM relationship WHERE type = 'PARTNER' AND (from_person_id = :id OR to_person_id = :id)";
        };
        return jdbc.sql(sql + " LIMIT :limit").param("id", id).param("limit", limit).query(UUID.class).list();
    }

    public List<GraphPerson> persons(Collection<UUID> ids) {
        return jdbc.sql("SELECT id, full_name, gender, photo_key FROM person WHERE id = ANY(CAST(:ids AS uuid[]))"
                        + " ORDER BY search_name, id")
                .param("ids", arr(ids))
                .query((rs, n) -> {
                    String g = rs.getString("gender");
                    return new GraphPerson(rs.getObject("id", UUID.class), rs.getString("full_name"),
                            g == null ? null : Gender.valueOf(g), rs.getString("photo_key"));
                }).list();
    }

    /** Arestas com os dois extremos dentro do conjunto. */
    public List<GraphRelationship> edgesAmong(Collection<UUID> ids) {
        return jdbc.sql("SELECT id, type, from_person_id, to_person_id, subtype, kind FROM relationship"
                        + " WHERE from_person_id = ANY(CAST(:ids AS uuid[])) AND to_person_id = ANY(CAST(:ids AS uuid[]))"
                        + " ORDER BY type, created_at, id")
                .param("ids", arr(ids))
                .query((rs, n) -> new GraphRelationship(rs.getObject("id", UUID.class),
                        RelationshipType.valueOf(rs.getString("type")),
                        rs.getObject("from_person_id", UUID.class), rs.getObject("to_person_id", UUID.class),
                        rs.getString("subtype"), rs.getString("kind"))).list();
    }

    /** Para cada pessoa do conjunto, quantos pais/filhos/parceiros ficaram fora dele (so > 0). */
    public Map<UUID, HiddenCount> hiddenCounts(Collection<UUID> ids) {
        Map<UUID, HiddenCount> out = new LinkedHashMap<>();
        jdbc.sql("""
                SELECT x.pid,
                  count(*) FILTER (WHERE r.type = 'PARENT_OF' AND r.to_person_id = x.pid
                                   AND NOT r.from_person_id = ANY(CAST(:ids AS uuid[]))) AS parents,
                  count(*) FILTER (WHERE r.type = 'PARENT_OF' AND r.from_person_id = x.pid
                                   AND NOT r.to_person_id = ANY(CAST(:ids AS uuid[]))) AS children,
                  count(*) FILTER (WHERE r.type = 'PARTNER'
                                   AND NOT (CASE WHEN r.from_person_id = x.pid THEN r.to_person_id
                                                 ELSE r.from_person_id END) = ANY(CAST(:ids AS uuid[]))) AS partners
                FROM unnest(CAST(:ids AS uuid[])) AS x(pid)
                JOIN relationship r ON r.from_person_id = x.pid OR r.to_person_id = x.pid
                GROUP BY x.pid
                """)
                .param("ids", arr(ids))
                .query((rs, n) -> {
                    HiddenCount h = new HiddenCount(rs.getInt("parents"), rs.getInt("children"), rs.getInt("partners"));
                    if (h.parents() + h.children() + h.partners() > 0) {
                        out.put(rs.getObject("pid", UUID.class), h);
                    }
                    return null;
                }).list();
        return out;
    }

    /** Todos os parentes derivados numa unica query: (categoria, id, nome). */
    public List<Map.Entry<String, RelativesResponse.Relative>> relatives(UUID id) {
        return jdbc.sql("""
                WITH par AS (
                    SELECT from_person_id AS id FROM relationship WHERE type = 'PARENT_OF' AND to_person_id = :id),
                kids AS (
                    SELECT to_person_id AS id FROM relationship WHERE type = 'PARENT_OF' AND from_person_id = :id),
                sibc AS (
                    SELECT r2.to_person_id AS id, count(DISTINCT r2.from_person_id) AS n
                    FROM relationship r1
                    JOIN relationship r2 ON r2.from_person_id = r1.from_person_id AND r2.type = 'PARENT_OF'
                    WHERE r1.type = 'PARENT_OF' AND r1.to_person_id = :id AND r2.to_person_id <> :id
                    GROUP BY r2.to_person_id),
                unc AS (
                    SELECT DISTINCT r2.to_person_id AS id
                    FROM par
                    JOIN relationship r1 ON r1.to_person_id = par.id AND r1.type = 'PARENT_OF'
                    JOIN relationship r2 ON r2.from_person_id = r1.from_person_id AND r2.type = 'PARENT_OF'
                    WHERE r2.to_person_id <> par.id AND r2.to_person_id <> :id
                      AND r2.to_person_id NOT IN (SELECT id FROM par)),
                u AS (
                    SELECT 'parents' AS cat, id FROM par
                    UNION ALL SELECT 'children', id FROM kids
                    UNION ALL SELECT 'siblings', id FROM sibc WHERE n >= 2
                    UNION ALL SELECT 'halfSiblings', id FROM sibc WHERE n = 1
                    UNION ALL SELECT 'grandparents', r.from_person_id
                              FROM relationship r JOIN par ON r.to_person_id = par.id WHERE r.type = 'PARENT_OF'
                    UNION ALL SELECT 'grandchildren', r.to_person_id
                              FROM relationship r JOIN kids ON r.from_person_id = kids.id WHERE r.type = 'PARENT_OF'
                    UNION ALL SELECT 'unclesAunts', id FROM unc
                    UNION ALL SELECT 'cousins', r.to_person_id
                              FROM relationship r JOIN unc ON r.from_person_id = unc.id
                              WHERE r.type = 'PARENT_OF' AND r.to_person_id <> :id
                    UNION ALL SELECT 'partners',
                              CASE WHEN from_person_id = :id THEN to_person_id ELSE from_person_id END
                              FROM relationship
                              WHERE type = 'PARTNER' AND (from_person_id = :id OR to_person_id = :id))
                SELECT c.cat, p.id, p.full_name
                FROM (SELECT DISTINCT cat, id FROM u) c JOIN person p ON p.id = c.id
                ORDER BY c.cat, p.search_name, p.id
                """)
                .param("id", id)
                .query((rs, n) -> Map.entry(rs.getString("cat"),
                        new RelativesResponse.Relative(rs.getObject("id", UUID.class), rs.getString("full_name"))))
                .list();
    }
}
