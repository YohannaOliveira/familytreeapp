package br.familytree.db;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.familytree.AbstractIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

class SchemaConstraintsTest extends AbstractIntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    UUID treeId() {
        return jdbc.queryForObject("SELECT id FROM tree LIMIT 1", UUID.class);
    }

    UUID person(String name) {
        return jdbc.queryForObject(
                "INSERT INTO person (tree_id, full_name, search_name) VALUES (?, ?, lower(?)) RETURNING id",
                UUID.class, treeId(), name, name);
    }

    void relate(String type, UUID from, UUID to, String subtype, String kind) {
        jdbc.update("INSERT INTO relationship (tree_id, type, from_person_id, to_person_id, subtype, kind)"
                + " VALUES (?, ?, ?, ?, ?, ?)", treeId(), type, from, to, subtype, kind);
    }

    @Test
    void defaultTreeExists() {
        assertThat(jdbc.queryForObject("SELECT count(*) FROM tree", Integer.class)).isEqualTo(1);
    }

    @Test
    void blankNameRejected() {
        assertThatThrownBy(() -> person("   ")).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void selfRelationRejected() {
        UUID a = person("Self");
        assertThatThrownBy(() -> relate("PARENT_OF", a, a, "PARENT", "BIOLOGICAL"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void duplicateParentRejected() {
        UUID p = person("Joao");
        UUID c = person("Maria");
        relate("PARENT_OF", p, c, "FATHER", "BIOLOGICAL");
        assertThatThrownBy(() -> relate("PARENT_OF", p, c, "FATHER", "BIOLOGICAL"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void partnerMustBeCanonicalOrder() {
        UUID a = person("A");
        UUID b = person("B");
        UUID lo = a.toString().compareTo(b.toString()) < 0 ? a : b;
        UUID hi = lo.equals(a) ? b : a;
        relate("PARTNER", lo, hi, "MARRIED", null);
        assertThatThrownBy(() -> relate("PARTNER", hi, lo, "MARRIED", null))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void parentRelationNeedsKind() {
        UUID p = person("P");
        UUID c = person("C");
        assertThatThrownBy(() -> relate("PARENT_OF", p, c, "MOTHER", null))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void deletingPersonRemovesEdgesButKeepsOthers() {
        UUID p = person("Pai");
        UUID c = person("Filho");
        relate("PARENT_OF", p, c, "FATHER", "BIOLOGICAL");
        jdbc.update("DELETE FROM person WHERE id = ?", p);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM relationship WHERE to_person_id = ?",
                Integer.class, c)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM person WHERE id = ?", Integer.class, c))
                .isEqualTo(1);
    }
}
