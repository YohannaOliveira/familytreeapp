package br.familytree;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

/** Por padrao os testes rodam autenticados; os de seguranca usam @WithAnonymousUser. */
@SpringBootTest
@WithMockUser(roles = "ADMIN")
public abstract class AbstractIntegrationTest {

    public static final String ADMIN_USER = "admin";
    public static final String ADMIN_PASSWORD = "test-password";

    // Singleton: iniciado uma vez e compartilhado entre classes (o contexto Spring em cache reutiliza a mesma conexao).
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void securityProperties(DynamicPropertyRegistry registry) {
        String hash = new BCryptPasswordEncoder(4).encode(ADMIN_PASSWORD);
        registry.add("app.security.admin-user", () -> ADMIN_USER);
        registry.add("app.security.admin-password-hash", () -> hash);
        registry.add("app.security.jwt-secret", () -> "test-secret-test-secret-test-secret-0123456789");
    }
}
