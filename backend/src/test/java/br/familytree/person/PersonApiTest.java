package br.familytree.person;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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

@AutoConfigureMockMvc
class PersonApiTest extends AbstractIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void clean() {
        jdbc.update("DELETE FROM person");
    }

    String create(String name) throws Exception {
        String body = mvc.perform(post("/api/v1/people").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"" + name + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    void assertSearchName(String id, String expected) {
        assertThat(jdbc.queryForObject("SELECT search_name FROM person WHERE id = ?::uuid", String.class, id))
                .isEqualTo(expected);
    }

    @Test
    void crudLifecycle() throws Exception {
        mvc.perform(post("/api/v1/people").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"  Maria   Souza \",\"gender\":\"FEMALE\",\"notes\":\"n\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fullName", is("Maria   Souza")))
                .andExpect(jsonPath("$.gender", is("FEMALE")));
        String id = jdbc.queryForObject("SELECT id::text FROM person", String.class);
        assertSearchName(id, "maria souza");

        mvc.perform(get("/api/v1/people/" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.notes", is("n")));

        mvc.perform(put("/api/v1/people/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Maria Álvares\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName", is("Maria Álvares")))
                .andExpect(jsonPath("$.gender", nullValue()));
        assertSearchName(id, "maria alvares");

        mvc.perform(delete("/api/v1/people/" + id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/people/" + id)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("NOT_FOUND")))
                .andExpect(jsonPath("$.traceId", notNullValue()));
    }

    @Test
    void validationErrors() throws Exception {
        mvc.perform(post("/api/v1/people").contentType(MediaType.APPLICATION_JSON).content("{\"fullName\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.fieldErrors[0].field", is("fullName")));
        mvc.perform(post("/api/v1/people").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"" + "a".repeat(201) + "\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/people").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"X\",\"gender\":\"ROBOT\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("BAD_REQUEST")));
        mvc.perform(post("/api/v1/people").contentType(MediaType.APPLICATION_JSON).content("{oops"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/people/not-a-uuid")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/people?size=1000")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("VALIDATION_ERROR")));
        mvc.perform(put("/api/v1/people/" + UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"X\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/people/" + UUID.randomUUID())).andExpect(status().isNotFound());
    }

    @Test
    void searchIgnoresAccentAndCase() throws Exception {
        create("João da Silva");
        create("Maria Oliveira");
        mvc.perform(get("/api/v1/people/search?q=joao")).andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].fullName", is("João da Silva")));
        mvc.perform(get("/api/v1/people/search?q=JOÃO")).andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(get("/api/v1/people/search?q=jo")).andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(get("/api/v1/people/search?q=silv")).andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(get("/api/v1/people/search?q=zzzz")).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/v1/people/search?q=")).andExpect(status().isBadRequest());
    }

    @Test
    void searchRanksMoreSimilarFirst() throws Exception {
        create("Ana Paula Santos");
        create("Ana");
        mvc.perform(get("/api/v1/people/search?q=ana")).andExpect(jsonPath("$[0].fullName", is("Ana")));
    }

    @Test
    void searchShowsParentNamesToTellNamesakesApart() throws Exception {
        String pai = create("Carlos Souza");
        String mae = create("Lucia Souza");
        String filho = create("Joao Souza");
        create("Joao Souza");
        for (String parent : new String[] {pai, mae}) {
            jdbc.update("INSERT INTO relationship (tree_id, type, from_person_id, to_person_id, subtype, kind)"
                    + " SELECT t.id, 'PARENT_OF', ?::uuid, ?::uuid, 'PARENT', 'BIOLOGICAL' FROM tree t", parent, filho);
        }
        String body = mvc.perform(get("/api/v1/people/search?q=joao")).andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andReturn().getResponse().getContentAsString();
        java.util.List<java.util.List<String>> parents = JsonPath.read(body, "$[?(@.id == '" + filho + "')].parents");
        assertThat(parents.get(0)).containsExactlyInAnyOrder("Carlos Souza", "Lucia Souza");
        java.util.List<java.util.List<String>> orphans = JsonPath.read(body, "$[?(@.id != '" + filho + "')].parents");
        assertThat(orphans.get(0)).isEmpty();
    }

    @Test
    void paginationAndFilter() throws Exception {
        for (int i = 0; i < 5; i++) {
            create("Pessoa " + (char) ('A' + i));
        }
        create("Zeca");
        mvc.perform(get("/api/v1/people?page=1&size=4")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.page", is(1)))
                .andExpect(jsonPath("$.size", is(4)))
                .andExpect(jsonPath("$.total", is(6)));
        mvc.perform(get("/api/v1/people?q=zeca")).andExpect(jsonPath("$.total", is(1)))
                .andExpect(jsonPath("$.items[0].fullName", is("Zeca")));
    }

    @Test
    void deletingPersonRemovesEdgesKeepsOthers() throws Exception {
        String a = create("Pai");
        String b = create("Filho");
        jdbc.update("INSERT INTO relationship (tree_id, type, from_person_id, to_person_id, subtype, kind)"
                + " SELECT t.id, 'PARENT_OF', ?::uuid, ?::uuid, 'FATHER', 'BIOLOGICAL' FROM tree t", a, b);
        mvc.perform(delete("/api/v1/people/" + a)).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/people/" + b)).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM relationship", Integer.class)).isZero();
    }
}
