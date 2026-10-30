package br.familytree.relationship;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * PARENT_OF: fromId = pai/mae, toId = filho(a); subtype FATHER|MOTHER|PARENT; kind BIOLOGICAL|ADOPTIVE|STEP|FOSTER|UNKNOWN.
 * PARTNER: nao dirigida; subtype MARRIED|PARTNERS|EX; sem kind.
 */
public record RelationshipRequest(
        @NotNull(message = "type e obrigatorio") RelationshipType type,
        @NotNull(message = "fromId e obrigatorio") UUID fromId,
        @NotNull(message = "toId e obrigatorio") UUID toId,
        String subtype,
        String kind) {}
