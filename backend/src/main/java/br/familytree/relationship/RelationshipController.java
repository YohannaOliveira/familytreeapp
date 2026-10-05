package br.familytree.relationship;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class RelationshipController {

    private final RelationshipService service;

    public RelationshipController(RelationshipService service) {
        this.service = service;
    }

    @PostMapping("/relationships")
    public ResponseEntity<RelationshipResponse> create(@Valid @RequestBody RelationshipRequest req) {
        RelationshipResponse created = service.create(req);
        return ResponseEntity.created(URI.create("/api/v1/relationships/" + created.id())).body(created);
    }

    @DeleteMapping("/relationships/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/people/{id}/relationships")
    public List<PersonRelationship> list(@PathVariable UUID id) {
        return service.listFor(id);
    }
}
