package br.familytree.security;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.familytree.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
@WithAnonymousUser
@TestPropertySource(properties = {"app.security.login-max-attempts=3", "app.security.api-max-requests=10"})
class RateLimitTest extends AbstractIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Test
    void loginIsLimitedPerIpThenGeneralLimitApplies() throws Exception {
        String body = "{\"username\":\"admin\",\"password\":\"errada\"}";
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.code", is("RATE_LIMITED")));

        // 4 requisicoes de login ja consumiram o limite geral; mais 6 esgotam as 10.
        for (int i = 0; i < 6; i++) {
            mvc.perform(get("/api/v1/people")).andExpect(status().isUnauthorized());
        }
        mvc.perform(get("/api/v1/people")).andExpect(status().isTooManyRequests());
    }
}
