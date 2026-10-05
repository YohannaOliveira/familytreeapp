package br.familytree.person;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class PersonRepository {

    private static final String COLUMNS = "id, full_name, gender, photo_key, notes, created_at, updated_at";

    private static final String MATCH = "(search_name % :q OR search_name LIKE :like ESCAPE '\\')";

    private static final RowMapper<PersonResponse> MAPPER = PersonRepository::map;

    private final JdbcClient jdbc;

    public PersonRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private static PersonResponse map(ResultSet rs, int row) throws SQLException {
        String gender = rs.getString("gender");
        return new PersonResponse(
                rs.getObject("id", UUID.class),
                rs.getString("full_name"),
                gender == null ? null : Gender.valueOf(gender),
                rs.getString("photo_key"),
                rs.getString("notes"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class));
    }

    /** MVP: uma unica arvore. */
    private UUID defaultTreeId() {
        return jdbc.sql("SELECT id FROM tree ORDER BY created_at, id LIMIT 1").query(UUID.class).single();
    }

    public PersonResponse insert(PersonRequest req, String searchName) {
        return jdbc.sql("INSERT INTO person (tree_id, full_name, search_name, gender, notes)"
                        + " VALUES (:tree, :name, :search, :gender, :notes) RETURNING " + COLUMNS)
                .param("tree", defaultTreeId())
                .param("name", req.fullName())
                .param("search", searchName)
                .param("gender", req.gender() == null ? null : req.gender().name())
                .param("notes", req.notes())
                .query(MAPPER)
                .single();
    }

    public Optional<PersonResponse> update(UUID id, PersonRequest req, String searchName) {
        return jdbc.sql("UPDATE person SET full_name = :name, search_name = :search, gender = :gender,"
                        + " notes = :notes, updated_at = now() WHERE id = :id RETURNING " + COLUMNS)
                .param("id", id)
                .param("name", req.fullName())
                .param("search", searchName)
                .param("gender", req.gender() == null ? null : req.gender().name())
                .param("notes", req.notes())
                .query(MAPPER)
                .optional();
    }

    public Optional<PersonResponse> findById(UUID id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM person WHERE id = :id")
                .param("id", id).query(MAPPER).optional();
    }

    public boolean delete(UUID id) {
        return jdbc.sql("DELETE FROM person WHERE id = :id").param("id", id).update() > 0;
    }

    public List<PersonResponse> list(int limit, long offset) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM person ORDER BY search_name, id LIMIT :limit OFFSET :offset")
                .param("limit", limit).param("offset", offset).query(MAPPER).list();
    }

    public long count() {
        return jdbc.sql("SELECT count(*) FROM person").query(Long.class).single();
    }

    /**
     * Casamento por trigram (similaridade) ou por substring (buscas parciais),
     * ambos atendidos pelo indice GIN em search_name; ordenado por similaridade.
     */
    public List<PersonResponse> search(String normalizedQuery, int limit, long offset) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM person WHERE " + MATCH
                        + " ORDER BY similarity(search_name, :q) DESC, search_name, id"
                        + " LIMIT :limit OFFSET :offset")
                .param("q", normalizedQuery)
                .param("like", "%" + escapeLike(normalizedQuery) + "%")
                .param("limit", limit).param("offset", offset)
                .query(MAPPER).list();
    }

    public long countSearch(String normalizedQuery) {
        return jdbc.sql("SELECT count(*) FROM person WHERE " + MATCH)
                .param("q", normalizedQuery)
                .param("like", "%" + escapeLike(normalizedQuery) + "%")
                .query(Long.class).single();
    }

    private static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
