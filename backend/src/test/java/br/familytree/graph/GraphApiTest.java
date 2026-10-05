package br.familytree.graph;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.familytree.AbstractIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@AutoConfigureMockMvc
class GraphApiTest extends AbstractIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void clean() {
        jdbc.update("DELETE FROM person");
    }

    UUID person(String name) {
        return jdbc.queryForObject(
                "INSERT INTO person (tree_id, full_name, search_name) SELECT id, ?, lower(?) FROM tree LIMIT 1"
                        + " RETURNING id", UUID.class, name, name);
    }

    void parent(UUID p, UUID c, String kind) {
        jdbc.update("INSERT INTO relationship (tree_id, type, from_person_id, to_person_id, subtype, kind)"
                + " SELECT id, 'PARENT_OF', ?, ?, 'PARENT', ? FROM tree LIMIT 1", p, c, kind);
    }

    void partner(UUID a, UUID b) {
        UUID lo = a.toString().compareTo(b.toString()) < 0 ? a : b;
        UUID hi = lo.equals(a) ? b : a;
        jdbc.update("INSERT INTO relationship (tree_id, type, from_person_id, to_person_id, subtype)"
                + " SELECT id, 'PARTNER', ?, ?, 'MARRIED' FROM tree LIMIT 1", lo, hi);
    }

    ResultActions graph(UUID focus, String params) throws Exception {
        return mvc.perform(get("/api/v1/graph?focus=" + focus + params)).andExpect(status().isOk());
    }

    @Test
    void pedigreeCollapseYieldsEachPersonOnce() throws Exception {
        // avos -> (tio, pai) ; primos casados -> filho: avos aparecem uma vez so
        UUID gm = person("Avo"), gf = person("Avo2"), dad = person("Pai");
        UUID mom = person("Mae"), me = person("Eu");
        parent(gm, dad, "BIOLOGICAL");
        parent(gf, dad, "BIOLOGICAL");
        parent(gm, mom, "BIOLOGICAL"); // mae e filha dos mesmos avos (irma do pai) -> colapso de pedigree
        parent(gf, mom, "BIOLOGICAL");
        parent(dad, me, "BIOLOGICAL");
        parent(mom, me, "BIOLOGICAL");
        partner(dad, mom);
        graph(me, "&up=2&down=0")
                .andExpect(jsonPath("$.persons", hasSize(5)))
                .andExpect(jsonPath("$.truncated", is(false)))
                .andExpect(jsonPath("$.families", hasSize(2)));
    }

    @Test
    void depthLimitsAndHiddenCounts() throws Exception {
        UUID[] g = new UUID[5];
        for (int i = 0; i < g.length; i++) {
            g[i] = person("G" + i);
            if (i > 0) {
                parent(g[i - 1], g[i], "BIOLOGICAL");
            }
        }
        graph(g[2], "&up=1&down=1")
                .andExpect(jsonPath("$.persons", hasSize(3)))
                .andExpect(jsonPath("$.relationships", hasSize(2)))
                .andExpect(jsonPath("$.hiddenCounts['" + g[1] + "'].parents", is(1)))
                .andExpect(jsonPath("$.hiddenCounts['" + g[3] + "'].children", is(1)))
                .andExpect(jsonPath("$.hiddenCounts['" + g[2] + "']").doesNotExist());
        graph(g[2], "&up=0&down=0").andExpect(jsonPath("$.persons", hasSize(1)))
                .andExpect(jsonPath("$.hiddenCounts['" + g[2] + "'].parents", is(1)))
                .andExpect(jsonPath("$.hiddenCounts['" + g[2] + "'].children", is(1)));
    }

    @Test
    void partnersFlagAndSecondUnion() throws Exception {
        UUID dad = person("Pai"), mom1 = person("Mae1"), mom2 = person("Mae2"), c1 = person("C1"), c2 = person("C2");
        partner(dad, mom1);
        partner(dad, mom2);
        parent(dad, c1, "BIOLOGICAL");
        parent(mom1, c1, "BIOLOGICAL");
        parent(dad, c2, "BIOLOGICAL");
        parent(mom2, c2, "BIOLOGICAL");
        graph(dad, "&up=0&down=1&partners=true").andExpect(jsonPath("$.persons", hasSize(5)))
                .andExpect(jsonPath("$.families", hasSize(2)));
        graph(dad, "&up=0&down=1&partners=false").andExpect(jsonPath("$.persons", hasSize(3)))
                .andExpect(jsonPath("$.hiddenCounts['" + dad + "'].partners", is(2)))
                // com partners=false os filhos ficam com so um dos pais no subgrafo: familia monoparental
                .andExpect(jsonPath("$.families", hasSize(1)));
    }

    @Test
    void expandReturnsOnlyNeighbors() throws Exception {
        UUID gp = person("Avo"), dad = person("Pai"), mom = person("Mae"), me = person("Eu");
        parent(gp, dad, "BIOLOGICAL");
        parent(dad, me, "BIOLOGICAL");
        parent(mom, me, "BIOLOGICAL");
        partner(dad, mom);
        mvc.perform(get("/api/v1/graph/expand/" + me + "?direction=up")).andExpect(status().isOk())
                .andExpect(jsonPath("$.persons", hasSize(2)))
                .andExpect(jsonPath("$.relationships", hasSize(3)))
                .andExpect(jsonPath("$.hiddenCounts['" + dad + "'].parents", is(1)));
        mvc.perform(get("/api/v1/graph/expand/" + dad + "?direction=PARTNERS")).andExpect(jsonPath("$.persons", hasSize(1)));
        mvc.perform(get("/api/v1/graph/expand/" + me + "?direction=down")).andExpect(jsonPath("$.persons", empty()));
        mvc.perform(get("/api/v1/graph/expand/" + me + "?direction=sideways")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("INVALID_DIRECTION")));
        mvc.perform(get("/api/v1/graph/expand/" + UUID.randomUUID() + "?direction=up")).andExpect(status().isNotFound());
    }

    @Test
    void relativesDerived() throws Exception {
        UUID gp = person("Avo"), dad = person("Pai"), mom = person("Mae"), uncle = person("Tio");
        UUID me = person("Eu"), full = person("Irmao"), half = person("MeioIrmao"), cousin = person("Primo");
        UUID kid = person("Filho"), grandkid = person("Neto"), wife = person("Esposa"), dad2 = person("Pai2");
        parent(gp, dad, "BIOLOGICAL");
        parent(gp, uncle, "BIOLOGICAL");
        parent(dad, me, "BIOLOGICAL");
        parent(mom, me, "BIOLOGICAL");
        parent(dad, full, "BIOLOGICAL");
        parent(mom, full, "BIOLOGICAL");
        parent(dad, half, "BIOLOGICAL");
        parent(dad2, half, "BIOLOGICAL");
        parent(uncle, cousin, "BIOLOGICAL");
        parent(me, kid, "BIOLOGICAL");
        parent(kid, grandkid, "BIOLOGICAL");
        partner(me, wife);
        mvc.perform(get("/api/v1/people/" + me + "/relatives")).andExpect(status().isOk())
                .andExpect(jsonPath("$.parents[*].fullName", containsInAnyOrder("Pai", "Mae")))
                .andExpect(jsonPath("$.children[*].fullName", containsInAnyOrder("Filho")))
                .andExpect(jsonPath("$.siblings[*].fullName", containsInAnyOrder("Irmao")))
                .andExpect(jsonPath("$.halfSiblings[*].fullName", containsInAnyOrder("MeioIrmao")))
                .andExpect(jsonPath("$.grandparents[*].fullName", containsInAnyOrder("Avo")))
                .andExpect(jsonPath("$.grandchildren[*].fullName", containsInAnyOrder("Neto")))
                .andExpect(jsonPath("$.unclesAunts[*].fullName", containsInAnyOrder("Tio")))
                .andExpect(jsonPath("$.cousins[*].fullName", containsInAnyOrder("Primo")))
                .andExpect(jsonPath("$.partners[*].fullName", containsInAnyOrder("Esposa")));
        mvc.perform(get("/api/v1/people/" + UUID.randomUUID() + "/relatives")).andExpect(status().isNotFound());
    }

    @Test
    void adoptionCountsAsParent() throws Exception {
        UUID bio = person("Bio"), adopt = person("Adotivo"), kid = person("Crianca");
        parent(bio, kid, "BIOLOGICAL");
        parent(adopt, kid, "ADOPTIVE");
        graph(kid, "&up=1&down=0").andExpect(jsonPath("$.persons", hasSize(3)))
                .andExpect(jsonPath("$.families", hasSize(1)))
                .andExpect(jsonPath("$.relationships[?(@.kind=='ADOPTIVE')]", hasSize(1)));
    }

    @Test
    void validation() throws Exception {
        mvc.perform(get("/api/v1/graph?focus=" + UUID.randomUUID())).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/graph?focus=" + person("X") + "&up=11")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/graph")).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM person", Integer.class)).isEqualTo(1);
    }
}
