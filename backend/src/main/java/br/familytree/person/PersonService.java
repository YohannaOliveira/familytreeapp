package br.familytree.person;

import br.familytree.common.NotFoundException;
import br.familytree.common.PageResponse;
import br.familytree.photo.PhotoService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PersonService {

    private final PersonRepository repository;
    private final PhotoService photos;

    public PersonService(PersonRepository repository, PhotoService photos) {
        this.repository = repository;
        this.photos = photos;
    }

    public PersonResponse create(PersonRequest req) {
        return repository.insert(req, NameNormalizer.normalize(req.fullName()));
    }

    public PersonResponse update(UUID id, PersonRequest req) {
        return repository.update(id, req, NameNormalizer.normalize(req.fullName()))
                .orElseThrow(() -> notFound(id));
    }

    @Transactional(readOnly = true)
    public PersonResponse get(UUID id) {
        return repository.findById(id).orElseThrow(() -> notFound(id));
    }

    public void delete(UUID id) {
        String photoKey = repository.findById(id).map(PersonResponse::photoKey).orElse(null);
        if (!repository.delete(id)) {
            throw notFound(id);
        }
        photos.deleteQuietly(photoKey, null);
    }

    @Transactional(readOnly = true)
    public PageResponse<PersonResponse> list(int page, int size, String q) {
        String normalized = NameNormalizer.normalize(q);
        long offset = (long) page * size;
        if (normalized.isEmpty()) {
            return new PageResponse<>(repository.list(size, offset), page, size, repository.count());
        }
        return new PageResponse<>(repository.search(normalized, size, offset), page, size,
                repository.countSearch(normalized));
    }

    @Transactional(readOnly = true)
    public List<PersonSearchResult> search(String q, int limit) {
        List<PersonResponse> found = repository.search(NameNormalizer.normalize(q), limit, 0);
        Map<UUID, List<String>> parents = repository.parentNames(found.stream().map(PersonResponse::id).toList());
        return found.stream()
                .map(p -> new PersonSearchResult(p.id(), p.fullName(), p.gender(), p.photoKey(),
                        parents.getOrDefault(p.id(), List.of())))
                .toList();
    }

    private static NotFoundException notFound(UUID id) {
        return new NotFoundException("Pessoa nao encontrada: " + id);
    }
}
