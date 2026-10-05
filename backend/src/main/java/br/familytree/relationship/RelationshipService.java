package br.familytree.relationship;

import br.familytree.common.BadRequestException;
import br.familytree.common.ConflictException;
import br.familytree.common.NotFoundException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class RelationshipService {

    private static final Set<String> PARENT_SUBTYPES = Set.of("FATHER", "MOTHER", "PARENT");
    private static final Set<String> PARENT_KINDS = Set.of("BIOLOGICAL", "ADOPTIVE", "STEP", "FOSTER", "UNKNOWN");
    private static final Set<String> PARTNER_SUBTYPES = Set.of("MARRIED", "PARTNERS", "EX");
    private static final int MAX_BIOLOGICAL_PARENTS = 2;

    private final RelationshipRepository repository;

    public RelationshipService(RelationshipRepository repository) {
        this.repository = repository;
    }

    public RelationshipResponse create(RelationshipRequest req) {
        validateShape(req);
        if (req.fromId().equals(req.toId())) {
            throw new BadRequestException("SELF_RELATION", "Uma pessoa nao pode se relacionar consigo mesma");
        }
        UUID tree = repository.treeOf(req.fromId())
                .orElseThrow(() -> new NotFoundException("Pessoa nao encontrada: " + req.fromId()));
        UUID otherTree = repository.treeOf(req.toId())
                .orElseThrow(() -> new NotFoundException("Pessoa nao encontrada: " + req.toId()));
        if (!tree.equals(otherTree)) {
            throw new ConflictException("DIFFERENT_TREE", "As pessoas pertencem a arvores diferentes");
        }
        repository.lockTree(tree);
        return req.type() == RelationshipType.PARENT_OF ? createParent(tree, req) : createPartner(tree, req);
    }

    private RelationshipResponse createParent(UUID tree, RelationshipRequest req) {
        UUID parent = req.fromId();
        UUID child = req.toId();
        if (repository.exists("PARENT_OF", parent, child)) {
            throw duplicate();
        }
        if (repository.isDescendant(child, parent)) {
            throw new ConflictException("CYCLE_DETECTED",
                    "A relacao criaria um ciclo: o pai/mae ja e descendente do filho(a)");
        }
        if ("BIOLOGICAL".equals(req.kind())) {
            if (repository.countBiologicalParents(child) >= MAX_BIOLOGICAL_PARENTS) {
                throw new ConflictException("TOO_MANY_BIOLOGICAL_PARENTS",
                        "Uma pessoa pode ter no maximo 2 pais biologicos");
            }
            if (!"PARENT".equals(req.subtype()) && repository.hasBiologicalParentWithSubtype(child, req.subtype())) {
                throw new ConflictException("DUPLICATE_PARENT_ROLE",
                        "A pessoa ja possui " + (req.subtype().equals("FATHER") ? "um pai" : "uma mae") + " biologico(a)");
            }
        }
        return repository.insert(tree, req, parent, child);
    }

    private RelationshipResponse createPartner(UUID tree, RelationshipRequest req) {
        // Nao dirigida: grava com ids ordenados como o Postgres compara uuid (bytes sem sinal = ordem do texto hex).
        boolean swap = req.fromId().toString().compareTo(req.toId().toString()) > 0;
        UUID from = swap ? req.toId() : req.fromId();
        UUID to = swap ? req.fromId() : req.toId();
        if (repository.exists("PARTNER", from, to)) {
            throw duplicate();
        }
        return repository.insert(tree, req, from, to);
    }

    private void validateShape(RelationshipRequest req) {
        if (req.type() == RelationshipType.PARENT_OF) {
            requireOneOf("subtype", req.subtype(), PARENT_SUBTYPES);
            requireOneOf("kind", req.kind(), PARENT_KINDS);
        } else {
            requireOneOf("subtype", req.subtype(), PARTNER_SUBTYPES);
            if (req.kind() != null) {
                throw new BadRequestException("INVALID_RELATIONSHIP", "kind nao se aplica a PARTNER");
            }
        }
    }

    private static void requireOneOf(String field, String value, Set<String> allowed) {
        if (value == null || !allowed.contains(value)) {
            throw new BadRequestException("INVALID_RELATIONSHIP",
                    field + " deve ser um de " + allowed.stream().sorted().toList());
        }
    }

    private static ConflictException duplicate() {
        return new ConflictException("DUPLICATE_RELATIONSHIP", "Relacionamento ja existe");
    }

    public void delete(UUID id) {
        if (!repository.delete(id)) {
            throw new NotFoundException("Relacionamento nao encontrado: " + id);
        }
    }

    @Transactional(readOnly = true)
    public List<PersonRelationship> listFor(UUID personId) {
        repository.treeOf(personId).orElseThrow(() -> new NotFoundException("Pessoa nao encontrada: " + personId));
        return repository.listFor(personId);
    }
}
