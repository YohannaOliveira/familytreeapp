package br.familytree.photo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.familytree.common.ServiceUnavailableException;
import java.time.Duration;
import org.junit.jupiter.api.Test;

/** Assinatura e local (sem rede): so verifica o formato da URL gerada. */
class S3PhotoStorageTest {

    @Test
    void presignsPutUrlForConfiguredBucket() {
        PhotoProperties props = new PhotoProperties("https://acct.r2.cloudflarestorage.com", "fotos", "AKIATEST",
                "secret-secret-secret", "https://cdn.example", Duration.ofMinutes(5), 204_800);

        PhotoStorage.PresignedUpload up = new S3PhotoStorage(props)
                .presignUpload("photos/abc.webp", "image/webp", 40_000);

        assertThat(up.url()).startsWith("https://acct.r2.cloudflarestorage.com/fotos/photos/abc.webp?")
                .contains("X-Amz-Signature=")
                .contains("X-Amz-Expires=300");
        assertThat(up.headers()).containsEntry("Content-Type", "image/webp");
    }

    @Test
    void failsWithServiceUnavailableWhenNotConfigured() {
        PhotoProperties empty = new PhotoProperties("", "", "", "", "", Duration.ofMinutes(5), 204_800);

        assertThatThrownBy(() -> new S3PhotoStorage(empty).presignUpload("photos/a.webp", "image/webp", 10))
                .isInstanceOf(ServiceUnavailableException.class);
    }
}
