package br.familytree.relationship;

import java.util.UUID;

/** Relacionamento visto de uma pessoa: role = papel da outra pessoa (PARENT, CHILD ou PARTNER) em relacao a ela. */
public record PersonRelationship(UUID relationshipId, RelationshipType type, Role role, String subtype, String kind,
        Other person) {

    public enum Role { PARENT, CHILD, PARTNER }

    public record Other(UUID id, String fullName) {}
}
