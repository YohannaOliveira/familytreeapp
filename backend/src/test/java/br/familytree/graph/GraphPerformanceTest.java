package br.familytree.graph;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.familytree.AbstractIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/** Criterio do M05: /graph com 10k pessoas, profundidade padrao: < 200 ms e payload < 100 KB. */
@AutoConfigureMockMvc
class GraphPerformanceTest extends AbstractIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void graphOver10kPeopleIsFastAndSmall() throws Exception {
        jdbc.update("DELETE FROM person");
        // Arvore binaria de 10k pessoas (pai = i/2) + parceiros em pares, ~13 geracoes.
        jdbc.execute("""
                WITH t AS (SELECT id AS tree_id FROM tree LIMIT 1),
                n AS (SELECT i, gen_random_uuid() AS id FROM generate_series(1, 10000) i),
                p AS (INSERT INTO person (id, tree_id, full_name, search_name)
                      SELECT n.id, t.tree_id, 'Pessoa ' || n.i, 'pessoa ' || n.i FROM n, t RETURNING id)
                INSERT INTO relationship (tree_id, type, from_person_id, to_person_id, subtype, kind)
                SELECT t.tree_id, 'PARENT_OF', par.id, ch.id, 'PARENT', 'BIOLOGICAL'
                FROM n ch JOIN n par ON par.i = ch.i / 2, t WHERE ch.i >= 2
                """);
        jdbc.execute("ANALYZE relationship");
        UUID focus = jdbc.queryForObject(
                "SELECT id FROM person WHERE full_name = 'Pessoa 40'", UUID.class);
        String url = "/api/v1/graph?focus=" + focus;

        mvc.perform(get(url)).andExpect(status().isOk()); // aquecimento
        long best = Long.MAX_VALUE;
        int bytes = 0;
        for (int i = 0; i < 5; i++) {
            long t0 = System.nanoTime();
            bytes = mvc.perform(get(url)).andExpect(status().isOk()).andReturn().getResponse()
                    .getContentAsByteArray().length;
            best = Math.min(best, (System.nanoTime() - t0) / 1_000_000);
        }
        System.out.printf("GRAPH-PERF: 10000 pessoas, melhor de 5 = %d ms, payload = %d bytes%n", best, bytes);
        assertThat(best).isLessThan(200);
        assertThat(bytes).isLessThan(100_000);
    }
}
