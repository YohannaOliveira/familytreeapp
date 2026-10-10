package br.familytree.photo;

import br.familytree.common.ServiceUnavailableException;
import java.net.URI;
import java.util.Map;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

/** S3 API apontando para o Cloudflare R2. Os clientes so sao criados no primeiro uso, se houver configuracao. */
@Component
public class S3PhotoStorage implements PhotoStorage {

    private static final Region R2_REGION = Region.of("auto");

    private final PhotoProperties props;
    private volatile S3Client client;
    private volatile S3Presigner presigner;

    public S3PhotoStorage(PhotoProperties props) {
        this.props = props;
    }

    @Override
    public PresignedUpload presignUpload(String key, String contentType, long size) {
        PutObjectRequest put = PutObjectRequest.builder()
                .bucket(props.bucket()).key(key).contentType(contentType).contentLength(size).build();
        String url = presigner().presignPutObject(PutObjectPresignRequest.builder()
                        .signatureDuration(props.uploadUrlTtl()).putObjectRequest(put).build())
                .url().toString();
        return new PresignedUpload(url, Map.of("Content-Type", contentType));
    }

    @Override
    public void delete(String key) {
        client().deleteObject(DeleteObjectRequest.builder().bucket(props.bucket()).key(key).build());
    }

    private void requireConfigured() {
        if (!props.configured()) {
            throw new ServiceUnavailableException("PHOTOS_NOT_CONFIGURED", "Armazenamento de fotos nao configurado");
        }
    }

    private S3Presigner presigner() {
        requireConfigured();
        S3Presigner p = presigner;
        if (p == null) {
            synchronized (this) {
                if (presigner == null) {
                    presigner = S3Presigner.builder()
                            .endpointOverride(URI.create(props.endpoint()))
                            .region(R2_REGION)
                            .credentialsProvider(credentials())
                            .serviceConfiguration(s3Config())
                            .build();
                }
                p = presigner;
            }
        }
        return p;
    }

    private S3Client client() {
        requireConfigured();
        S3Client c = client;
        if (c == null) {
            synchronized (this) {
                if (client == null) {
                    client = S3Client.builder()
                            .endpointOverride(URI.create(props.endpoint()))
                            .region(R2_REGION)
                            .credentialsProvider(credentials())
                            .serviceConfiguration(s3Config())
                            .build();
                }
                c = client;
            }
        }
        return c;
    }

    private StaticCredentialsProvider credentials() {
        return StaticCredentialsProvider.create(AwsBasicCredentials.create(props.accessKeyId(), props.secretAccessKey()));
    }

    private static S3Configuration s3Config() {
        return S3Configuration.builder().pathStyleAccessEnabled(true).build();
    }
}
