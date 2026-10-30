package br.familytree.security;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Configuracao de seguranca; segredos vem sempre de variaveis de ambiente. */
@Validated
@ConfigurationProperties("app.security")
public record SecurityProperties(
        @NotBlank String adminUser,
        @NotBlank String adminPasswordHash,
        @NotBlank @Size(min = 32, message = "JWT_SECRET precisa ter ao menos 32 caracteres") String jwtSecret,
        @NotNull Duration jwtTtl,
        @NotNull List<String> corsAllowedOrigins,
        @Min(1) int loginMaxAttempts,
        @NotNull Duration loginWindow,
        @Min(1) int apiMaxRequests,
        @NotNull Duration apiWindow) {
}
