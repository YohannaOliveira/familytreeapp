package br.familytree.photo;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuracao do armazenamento de fotos (Cloudflare R2); credenciais vem sempre de variaveis de ambiente. */
@ConfigurationProperties("app.photos")
public record PhotoProperties(
        String endpoint,
        String bucket,
        String accessKeyId,
        String secretAccessKey,
        String publicBaseUrl,
        Duration uploadUrlTtl,
        long maxBytes) {

    public boolean configured() {
        return notBlank(endpoint) && notBlank(bucket) && notBlank(accessKeyId) && notBlank(secretAccessKey);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
