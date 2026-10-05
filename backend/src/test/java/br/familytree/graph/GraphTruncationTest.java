package br.familytree.graph;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.familytree.AbstractIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
@TestPropertySource(properties = "familytree.graph.max-nodes=4")
class GraphTruncationTest extends AbstractIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void capsSubgraphAndFlagsTruncation() throws Exception {
        jdbc.update("DELETE FROM person");
        UUID parent = jdbc.queryForObject(
                "INSERT INTO person (tree_id, full_name, search_name) SELECT id, 'Pai', 'pai' FROM tree LIMIT 1"
                        + " RETURNING id", UUID.class);
        for (int i = 0; i < 8; i++) {
            UUID kid = jdbc.queryForObject(
                    "INSERT INTO person (tree_id, full_name, search_name) SELECT id, 'K" + i + "', 'k" + i
                            + "' FROM tree LIMIT 1 RETURNING id", UUID.class);
            jdbc.update("INSERT INTO relationship (tree_id, type, from_person_id, to_person_id, subtype, kind)"
                    + " SELECT id, 'PARENT_OF', ?, ?, 'PARENT', 'BIOLOGICAL' FROM tree LIMIT 1", parent, kid);
        }
        mvc.perform(get("/api/v1/graph?focus=" + parent + "&up=0&down=1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.truncated", is(true)))
                .andExpect(jsonPath("$.persons", hasSize(4)))
                .andExpect(jsonPath("$.hiddenCounts['" + parent + "'].children", is(5)));
    }
}
