package br.familytree.relationship;

import java.time.OffsetDateTime;
import java.util.UUID;

public record RelationshipResponse(UUID id, RelationshipType type, UUID fromId, UUID toId, String subtype,
        String kind, OffsetDateTime createdAt) {}
