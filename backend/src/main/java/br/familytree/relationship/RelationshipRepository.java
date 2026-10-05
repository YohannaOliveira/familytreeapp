package br.familytree.relationship;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class RelationshipRepository {

    private static final String COLUMNS = "id, type, from_person_id, to_person_id, subtype, kind, created_at";

    private static final RowMapper<RelationshipResponse> MAPPER = (rs, row) -> new RelationshipResponse(
            rs.getObject("id", UUID.class),
            RelationshipType.valueOf(rs.getString("type")),
            rs.getObject("from_person_id", UUID.class),
            rs.getObject("to_person_id", UUID.class),
            rs.getString("subtype"),
            rs.getString("kind"),
            rs.getObject("created_at", OffsetDateTime.class));

    private final JdbcClient jdbc;

    public RelationshipRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Arvore da pessoa, se existir. */
    public Optional<UUID> treeOf(UUID personId) {
        return jdbc.sql("SELECT tree_id FROM person WHERE id = :id").param("id", personId)
                .query(UUID.class).optional();
    }

    /** Serializa escritas de PARENT_OF na arvore (evita ciclo/3o pai por corrida entre transacoes). */
    public void lockTree(UUID treeId) {
        jdbc.sql("SELECT pg_advisory_xact_lock(hashtextextended(:tree, 0))").param("tree", treeId.toString())
                .query().singleValue();
    }

    public RelationshipResponse insert(UUID treeId, RelationshipRequest r, UUID from, UUID to) {
        return jdbc.sql("INSERT INTO relationship (tree_id, type, from_person_id, to_person_id, subtype, kind)"
                        + " VALUES (:tree, :type, :from, :to, :subtype, :kind) RETURNING " + COLUMNS)
                .param("tree", treeId).param("type", r.type().name())
                .param("from", from).param("to", to)
                .param("subtype", r.subtype()).param("kind", r.kind())
                .query(MAPPER).single();
    }

    public boolean delete(UUID id) {
        return jdbc.sql("DELETE FROM relationship WHERE id = :id").param("id", id).update() > 0;
    }

    public boolean exists(String type, UUID from, UUID to) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM relationship WHERE type = :type"
                        + " AND from_person_id = :from AND to_person_id = :to)")
                .param("type", type).param("from", from).param("to", to).query(Boolean.class).single();
    }

    /** True se {@code candidate} ja e descendente de {@code root} via PARENT_OF (CTE recursiva; UNION evita loops). */
    public boolean isDescendant(UUID root, UUID candidate) {
        return jdbc.sql("WITH RECURSIVE d(id) AS ("
                        + " SELECT to_person_id FROM relationship WHERE type = 'PARENT_OF' AND from_person_id = :root"
                        + " UNION"
                        + " SELECT r.to_person_id FROM relationship r JOIN d ON r.from_person_id = d.id"
                        + "  WHERE r.type = 'PARENT_OF')"
                        + " SELECT EXISTS (SELECT 1 FROM d WHERE id = :candidate)")
                .param("root", root).param("candidate", candidate).query(Boolean.class).single();
    }

    public int countBiologicalParents(UUID child) {
        return jdbc.sql("SELECT count(*) FROM relationship WHERE type = 'PARENT_OF' AND kind = 'BIOLOGICAL'"
                        + " AND to_person_id = :child")
                .param("child", child).query(Integer.class).single();
    }

    public boolean hasBiologicalParentWithSubtype(UUID child, String subtype) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM relationship WHERE type = 'PARENT_OF' AND kind = 'BIOLOGICAL'"
                        + " AND to_person_id = :child AND subtype = :subtype)")
                .param("child", child).param("subtype", subtype).query(Boolean.class).single();
    }

    public List<PersonRelationship> listFor(UUID personId) {
        return jdbc.sql("SELECT r.id, r.type, r.subtype, r.kind, r.from_person_id, p.id AS other_id, p.full_name"
                        + " FROM relationship r"
                        + " JOIN person p ON p.id = CASE WHEN r.from_person_id = :id THEN r.to_person_id"
                        + "                              ELSE r.from_person_id END"
                        + " WHERE r.from_person_id = :id OR r.to_person_id = :id"
                        + " ORDER BY r.type, r.created_at, r.id")
                .param("id", personId)
                .query((rs, row) -> {
                    RelationshipType type = RelationshipType.valueOf(rs.getString("type"));
                    boolean isFrom = personId.equals(rs.getObject("from_person_id", UUID.class));
                    PersonRelationship.Role role = type == RelationshipType.PARTNER ? PersonRelationship.Role.PARTNER
                            : isFrom ? PersonRelationship.Role.CHILD : PersonRelationship.Role.PARENT;
                    return new PersonRelationship(rs.getObject("id", UUID.class), type, role,
                            rs.getString("subtype"), rs.getString("kind"),
                            new PersonRelationship.Other(rs.getObject("other_id", UUID.class),
                                    rs.getString("full_name")));
                }).list();
    }
}
