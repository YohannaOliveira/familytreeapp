package br.familytree.person;

import br.familytree.common.NotFoundException;
import br.familytree.common.PageResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PersonService {

    private final PersonRepository repository;

    public PersonService(PersonRepository repository) {
        this.repository = repository;
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
        if (!repository.delete(id)) {
            throw notFound(id);
        }
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
    public List<PersonResponse> search(String q, int limit) {
        return repository.search(NameNormalizer.normalize(q), limit, 0);
    }

    private static NotFoundException notFound(UUID id) {
        return new NotFoundException("Pessoa nao encontrada: " + id);
    }
}
