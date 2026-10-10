package br.familytree.photo;

import br.familytree.common.BadRequestException;
import br.familytree.common.NotFoundException;
import br.familytree.person.PersonRepository;
import br.familytree.person.PersonResponse;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PhotoService {

    private static final Logger log = LoggerFactory.getLogger(PhotoService.class);

    /** Tipo aceito -> extensao do objeto. O front converte para WebP; JPEG/PNG sao fallback. */
    private static final Map<String, String> EXTENSIONS =
            Map.of("image/webp", "webp", "image/jpeg", "jpg", "image/png", "png");

    private static final Pattern KEY = Pattern.compile("photos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(webp|jpg|png)");

    private final PhotoStorage storage;
    private final PhotoProperties props;
    private final PersonRepository people;

    public PhotoService(PhotoStorage storage, PhotoProperties props, PersonRepository people) {
        this.storage = storage;
        this.props = props;
        this.people = people;
    }

    public UploadUrlResponse createUploadUrl(String contentType, long size) {
        String ext = EXTENSIONS.get(contentType);
        if (ext == null) {
            throw new BadRequestException("INVALID_PHOTO_TYPE", "Tipo de imagem nao suportado: use WebP, JPEG ou PNG");
        }
        if (size <= 0 || size > props.maxBytes()) {
            throw new BadRequestException("PHOTO_TOO_LARGE",
                    "Imagem deve ter no maximo " + props.maxBytes() / 1024 + " KB");
        }
        String key = "photos/" + UUID.randomUUID() + "." + ext;
        PhotoStorage.PresignedUpload upload = storage.presignUpload(key, contentType, size);
        return new UploadUrlResponse(upload.url(), key, upload.headers(), props.uploadUrlTtl().toSeconds());
    }

    @Transactional
    public PersonResponse setPhoto(UUID personId, String photoKey) {
        if (photoKey == null || !KEY.matcher(photoKey).matches()) {
            throw new BadRequestException("INVALID_PHOTO_KEY", "Chave de foto invalida");
        }
        PersonResponse before = people.findById(personId).orElseThrow(() -> notFound(personId));
        people.setPhotoKey(personId, photoKey);
        deleteQuietly(before.photoKey(), photoKey);
        return people.findById(personId).orElseThrow(() -> notFound(personId));
    }

    @Transactional
    public void removePhoto(UUID personId) {
        PersonResponse before = people.findById(personId).orElseThrow(() -> notFound(personId));
        people.setPhotoKey(personId, null);
        deleteQuietly(before.photoKey(), null);
    }

    /** Apaga o objeto antigo sem derrubar a operacao: um orfao no bucket e preferivel a um erro ao usuario. */
    public void deleteQuietly(String oldKey, String keep) {
        if (oldKey == null || oldKey.equals(keep)) {
            return;
        }
        try {
            storage.delete(oldKey);
        } catch (RuntimeException e) {
            log.warn("Falha ao apagar foto {}", oldKey, e);
        }
    }

    private static NotFoundException notFound(UUID id) {
        return new NotFoundException("Pessoa nao encontrada: " + id);
    }

    public record UploadUrlResponse(String uploadUrl, String key, Map<String, String> headers, long expiresInSeconds) {}
}
