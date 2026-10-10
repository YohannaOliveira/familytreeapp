package br.familytree.person;

import br.familytree.common.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/people")
@Validated
public class PersonController {

    private final PersonService service;

    public PersonController(PersonService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<PersonResponse> create(@Valid @RequestBody PersonRequest req) {
        PersonResponse created = service.create(req);
        return ResponseEntity.created(URI.create("/api/v1/people/" + created.id())).body(created);
    }

    @GetMapping
    public PageResponse<PersonResponse> list(
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "deve ser >= 0") int page,
            @RequestParam(defaultValue = "20") @Min(value = 1, message = "deve ser >= 1")
                    @Max(value = 100, message = "deve ser <= 100") int size,
            @RequestParam(required = false) String q) {
        return service.list(page, size, q);
    }

    @GetMapping("/search")
    public List<PersonSearchResult> search(
            @RequestParam @NotBlank(message = "q e obrigatorio") String q,
            @RequestParam(defaultValue = "10") @Min(value = 1, message = "deve ser >= 1")
                    @Max(value = 50, message = "deve ser <= 50") int limit) {
        return service.search(q, limit);
    }

    @GetMapping("/{id}")
    public PersonResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PutMapping("/{id}")
    public PersonResponse update(@PathVariable UUID id, @Valid @RequestBody PersonRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
