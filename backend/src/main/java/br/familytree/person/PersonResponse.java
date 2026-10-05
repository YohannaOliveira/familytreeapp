package br.familytree.person;

import java.time.OffsetDateTime;
import java.util.UUID;

public record PersonResponse(UUID id, String fullName, Gender gender, String photoKey, String notes,
        OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
