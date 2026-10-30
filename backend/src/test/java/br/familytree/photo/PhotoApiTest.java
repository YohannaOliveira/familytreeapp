package br.familytree.photo;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.familytree.AbstractIntegrationTest;
import com.jayway.jsonpath.JsonPath;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class PhotoApiTest extends AbstractIntegrationTest {

    static final String KEY_A = "photos/" + UUID.randomUUID() + ".webp";
    static final String KEY_B = "photos/" + UUID.randomUUID() + ".webp";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @MockitoBean
    PhotoStorage storage;

    @BeforeEach
    void clean() {
        reset(storage);
        jdbc.update("DELETE FROM person");
    }

    String createPerson() throws Exception {
        String body = mvc.perform(post("/api/v1/people").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Maria\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    void setPhoto(String id, String key) throws Exception {
        mvc.perform(put("/api/v1/people/" + id + "/photo").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"photoKey\":\"" + key + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photoKey", is(key)));
    }

    @Test
    void uploadUrlReturnsPresignedUrlAndNewKey() throws Exception {
        when(storage.presignUpload(anyString(), eq("image/webp"), eq(40_000L)))
                .thenReturn(new PhotoStorage.PresignedUpload("https://r2.example/put",
                        Map.of("Content-Type", "image/webp")));

        mvc.perform(post("/api/v1/photos/upload-url").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contentType\":\"image/webp\",\"size\":40000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uploadUrl", is("https://r2.example/put")))
                .andExpect(jsonPath("$.key", startsWith("photos/")))
                .andExpect(jsonPath("$.headers['Content-Type']", is("image/webp")));
    }

    @Test
    void uploadUrlRejectsInvalidTypeAndSize() throws Exception {
        mvc.perform(post("/api/v1/photos/upload-url").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contentType\":\"application/pdf\",\"size\":1000}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("INVALID_PHOTO_TYPE")));

        mvc.perform(post("/api/v1/photos/upload-url").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contentType\":\"image/webp\",\"size\":99999999}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("PHOTO_TOO_LARGE")));

        mvc.perform(post("/api/v1/photos/upload-url").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contentType\":\"image/webp\",\"size\":0}"))
                .andExpect(status().isBadRequest());

        verify(storage, never()).presignUpload(anyString(), anyString(), anyLong());
    }

    @Test
    void replacingPhotoDeletesOldObject() throws Exception {
        String id = createPerson();
        setPhoto(id, KEY_A);
        verify(storage, never()).delete(anyString());

        setPhoto(id, KEY_B);
        verify(storage).delete(KEY_A);
    }

    @Test
    void removingPhotoClearsKeyAndDeletesObject() throws Exception {
        String id = createPerson();
        setPhoto(id, KEY_A);

        mvc.perform(delete("/api/v1/people/" + id + "/photo")).andExpect(status().isNoContent());

        verify(storage).delete(KEY_A);
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/people/" + id))
                .andExpect(jsonPath("$.photoKey", nullValue()));
    }

    @Test
    void deletingPersonDeletesPhotoObject() throws Exception {
        String id = createPerson();
        setPhoto(id, KEY_A);

        mvc.perform(delete("/api/v1/people/" + id)).andExpect(status().isNoContent());

        verify(storage).delete(KEY_A);
    }

    @Test
    void rejectsMalformedKeyAndUnknownPerson() throws Exception {
        String id = createPerson();
        mvc.perform(put("/api/v1/people/" + id + "/photo").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"photoKey\":\"../../etc/passwd\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("INVALID_PHOTO_KEY")));

        mvc.perform(put("/api/v1/people/" + UUID.randomUUID() + "/photo").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"photoKey\":\"" + KEY_A + "\"}"))
                .andExpect(status().isNotFound());
    }
}
