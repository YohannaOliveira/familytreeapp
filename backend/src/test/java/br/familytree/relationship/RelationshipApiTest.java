package br.familytree.relationship;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.familytree.AbstractIntegrationTest;
import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@AutoConfigureMockMvc
class RelationshipApiTest extends AbstractIntegrationTest {

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

    ResultActions rel(String type, UUID from, UUID to, String subtype, String kind) throws Exception {
        String body = "{\"type\":\"" + type + "\",\"fromId\":\"" + from + "\",\"toId\":\"" + to + "\""
                + (subtype == null ? "" : ",\"subtype\":\"" + subtype + "\"")
                + (kind == null ? "" : ",\"kind\":\"" + kind + "\"") + "}";
        return mvc.perform(post("/api/v1/relationships").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    void parent(UUID p, UUID c, String subtype, String kind) throws Exception {
        rel("PARENT_OF", p, c, subtype, kind).andExpect(status().isCreated());
    }

    void conflict(ResultActions r, String code) throws Exception {
        r.andExpect(status().isConflict()).andExpect(jsonPath("$.code", is(code)));
    }

    @Test
    void halfSiblingsAndSecondUnion() throws Exception {
        UUID dad = person("Pai"), mom1 = person("Mae1"), mom2 = person("Mae2");
        UUID c1 = person("C1"), c2 = person("C2");
        rel("PARTNER", dad, mom1, "MARRIED", null).andExpect(status().isCreated());
        rel("PARTNER", mom1, dad, "EX", null).andExpect(status().isConflict());
        rel("PARTNER", dad, mom2, "MARRIED", null).andExpect(status().isCreated());
        parent(dad, c1, "FATHER", "BIOLOGICAL");
        parent(mom1, c1, "MOTHER", "BIOLOGICAL");
        parent(dad, c2, "FATHER", "BIOLOGICAL");
        parent(mom2, c2, "MOTHER", "BIOLOGICAL");
        mvc.perform(get("/api/v1/people/" + dad + "/relationships")).andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)));
        mvc.perform(get("/api/v1/people/" + c1 + "/relationships")).andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].role", is("PARENT")));
    }

    @Test
    void partnerAbEqualsBa() throws Exception {
        UUID a = person("A"), b = person("B");
        rel("PARTNER", a, b, "MARRIED", null).andExpect(status().isCreated());
        conflict(rel("PARTNER", b, a, "MARRIED", null), "DUPLICATE_RELATIONSHIP");
        conflict(rel("PARTNER", a, b, "EX", null), "DUPLICATE_RELATIONSHIP");
    }

    @Test
    void adoptionPlusBiologicalParents() throws Exception {
        UUID f = person("Pai bio"), m = person("Mae bio"), a1 = person("Adotivo1"), a2 = person("Adotivo2");
        UUID s = person("Padrasto"), kid = person("Filho");
        parent(f, kid, "FATHER", "BIOLOGICAL");
        parent(m, kid, "MOTHER", "BIOLOGICAL");
        parent(a1, kid, "FATHER", "ADOPTIVE");
        parent(a2, kid, "MOTHER", "ADOPTIVE");
        parent(s, kid, "PARENT", "STEP");
        mvc.perform(get("/api/v1/people/" + kid + "/relationships")).andExpect(jsonPath("$", hasSize(5)));
    }

    @Test
    void thirdBiologicalParentRejected() throws Exception {
        UUID a = person("A"), b = person("B"), c = person("C"), kid = person("K");
        parent(a, kid, "PARENT", "BIOLOGICAL");
        parent(b, kid, "PARENT", "BIOLOGICAL");
        conflict(rel("PARENT_OF", c, kid, "PARENT", "BIOLOGICAL"), "TOO_MANY_BIOLOGICAL_PARENTS");
    }

    @Test
    void secondBiologicalFatherRejected() throws Exception {
        UUID a = person("A"), b = person("B"), kid = person("K");
        parent(a, kid, "FATHER", "BIOLOGICAL");
        conflict(rel("PARENT_OF", b, kid, "FATHER", "BIOLOGICAL"), "DUPLICATE_PARENT_ROLE");
    }

    @Test
    void cousinsCanMarry() throws Exception {
        UUID gp = person("Avo"), u1 = person("Tio"), u2 = person("Pai");
        UUID cousin1 = person("Primo"), cousin2 = person("Prima");
        parent(gp, u1, "PARENT", "BIOLOGICAL");
        parent(gp, u2, "PARENT", "BIOLOGICAL");
        parent(u1, cousin1, "FATHER", "BIOLOGICAL");
        parent(u2, cousin2, "FATHER", "BIOLOGICAL");
        rel("PARTNER", cousin1, cousin2, "MARRIED", null).andExpect(status().isCreated());
    }

    @Test
    void cycleBlockedAcrossManyGenerations() throws Exception {
        UUID[] g = new UUID[7];
        for (int i = 0; i < g.length; i++) {
            g[i] = person("G" + i);
            if (i > 0) {
                parent(g[i - 1], g[i], "PARENT", "ADOPTIVE");
            }
        }
        conflict(rel("PARENT_OF", g[6], g[0], "PARENT", "ADOPTIVE"), "CYCLE_DETECTED");
        conflict(rel("PARENT_OF", g[3], g[1], "PARENT", "ADOPTIVE"), "CYCLE_DETECTED");
        // atalho entre geracoes nao-ciclico continua permitido
        parent(g[0], g[5], "PARENT", "ADOPTIVE");
    }

    @Test
    void invalidRequests() throws Exception {
        UUID a = person("A"), b = person("B");
        rel("PARENT_OF", a, a, "PARENT", "BIOLOGICAL").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("SELF_RELATION")));
        rel("PARENT_OF", a, b, null, null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("INVALID_RELATIONSHIP")));
        rel("PARTNER", a, b, "MARRIED", "BIOLOGICAL").andExpect(status().isBadRequest());
        rel("PARTNER", a, b, "FATHER", null).andExpect(status().isBadRequest());
        rel("PARENT_OF", a, UUID.randomUUID(), "PARENT", "BIOLOGICAL").andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/relationships").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code", is("VALIDATION_ERROR")));
        mvc.perform(get("/api/v1/people/" + UUID.randomUUID() + "/relationships")).andExpect(status().isNotFound());
    }

    @Test
    void differentTreesRejected() throws Exception {
        UUID a = person("A");
        UUID otherTree = jdbc.queryForObject("INSERT INTO tree (name) VALUES ('Outra') RETURNING id", UUID.class);
        UUID b = jdbc.queryForObject(
                "INSERT INTO person (tree_id, full_name, search_name) VALUES (?, 'B', 'b') RETURNING id",
                UUID.class, otherTree);
        try {
            conflict(rel("PARTNER", a, b, "MARRIED", null), "DIFFERENT_TREE");
        } finally {
            jdbc.update("DELETE FROM tree WHERE id = ?", otherTree);
        }
    }

    @Test
    void duplicateParentRelationshipRejected() throws Exception {
        UUID p = person("Pai"), kid = person("Filho");
        parent(p, kid, "FATHER", "BIOLOGICAL");
        conflict(rel("PARENT_OF", p, kid, "FATHER", "BIOLOGICAL"), "DUPLICATE_RELATIONSHIP");
        // mesmo par com outro tipo de vinculo tambem e duplicata
        conflict(rel("PARENT_OF", p, kid, "PARENT", "ADOPTIVE"), "DUPLICATE_RELATIONSHIP");
    }

    @Test
    void directCycleAndSecondBiologicalMotherRejected() throws Exception {
        UUID a = person("A"), b = person("B"), m1 = person("Mae1"), m2 = person("Mae2"), kid = person("K");
        parent(a, b, "PARENT", "BIOLOGICAL");
        conflict(rel("PARENT_OF", b, a, "PARENT", "BIOLOGICAL"), "CYCLE_DETECTED");
        parent(m1, kid, "MOTHER", "BIOLOGICAL");
        conflict(rel("PARENT_OF", m2, kid, "MOTHER", "BIOLOGICAL"), "DUPLICATE_PARENT_ROLE");
        // um "PARENT" generico nao entra na regra de papel, mas ainda conta no limite de 2
        parent(m2, kid, "PARENT", "BIOLOGICAL");
    }

    @Test
    void nonBiologicalParentsHaveNoLimit() throws Exception {
        UUID kid = person("Filho");
        for (int i = 0; i < 4; i++) {
            parent(person("Adotivo" + i), kid, "FATHER", "ADOPTIVE");
            parent(person("Padrasto" + i), kid, "MOTHER", "STEP");
        }
        mvc.perform(get("/api/v1/people/" + kid + "/relationships")).andExpect(jsonPath("$", hasSize(8)));
    }

    @Test
    void removingBiologicalParentFreesTheSlot() throws Exception {
        UUID a = person("A"), b = person("B"), c = person("C"), kid = person("K");
        parent(a, kid, "PARENT", "BIOLOGICAL");
        String body = rel("PARENT_OF", b, kid, "PARENT", "BIOLOGICAL").andReturn().getResponse().getContentAsString();
        conflict(rel("PARENT_OF", c, kid, "PARENT", "BIOLOGICAL"), "TOO_MANY_BIOLOGICAL_PARENTS");
        mvc.perform(delete("/api/v1/relationships/" + JsonPath.<String>read(body, "$.id")))
                .andExpect(status().isNoContent());
        parent(c, kid, "PARENT", "BIOLOGICAL");
    }

    @Test
    void unknownSubtypeOrKindRejected() throws Exception {
        UUID a = person("A"), b = person("B");
        for (String[] bad : new String[][] {{"UNCLE", "BIOLOGICAL"}, {"FATHER", "ADOPTED"}}) {
            rel("PARENT_OF", a, b, bad[0], bad[1]).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code", is("INVALID_RELATIONSHIP")));
        }
        rel("PARTNER", a, b, "ROOMMATES", null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("INVALID_RELATIONSHIP")));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM relationship", Integer.class)).isZero();
    }

    /** O lock da arvore serializa criacoes: em disputa, o limite de 2 pais biologicos nao pode ser furado. */
    @Test
    void concurrentBiologicalParentsNeverExceedTwo() throws Exception {
        UUID kid = person("Filho");
        int n = 8;
        UUID[] parents = new UUID[n];
        for (int i = 0; i < n; i++) {
            parents[i] = person("Candidato" + i);
        }
        var pool = java.util.concurrent.Executors.newFixedThreadPool(n);
        var start = new java.util.concurrent.CountDownLatch(1);
        try {
            var futures = new java.util.ArrayList<java.util.concurrent.Future<Integer>>();
            for (UUID p : parents) {
                futures.add(pool.submit(() -> {
                    start.await();
                    String body = "{\"type\":\"PARENT_OF\",\"fromId\":\"" + p + "\",\"toId\":\"" + kid
                            + "\",\"subtype\":\"PARENT\",\"kind\":\"BIOLOGICAL\"}";
                    return mvc.perform(post("/api/v1/relationships")
                                    .with(org.springframework.security.test.web.servlet.request
                                            .SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN"))
                                    .contentType(MediaType.APPLICATION_JSON).content(body))
                            .andReturn().getResponse().getStatus();
                }));
            }
            start.countDown();
            int created = 0;
            for (var f : futures) {
                int status = f.get(30, java.util.concurrent.TimeUnit.SECONDS);
                assertThat(status).isIn(201, 409);
                if (status == 201) {
                    created++;
                }
            }
            assertThat(created).isEqualTo(2);
        } finally {
            pool.shutdownNow();
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM relationship WHERE to_person_id = ?", Integer.class, kid))
                .isEqualTo(2);
    }

    @Test
    void deleteRelationship() throws Exception {
        UUID a = person("A"), b = person("B");
        String body = rel("PARTNER", a, b, "MARRIED", null).andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.id");
        mvc.perform(delete("/api/v1/relationships/" + id)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/v1/relationships/" + id)).andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM relationship", Integer.class)).isZero();
    }
}
