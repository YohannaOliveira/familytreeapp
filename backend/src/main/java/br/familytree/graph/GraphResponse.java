package br.familytree.graph;

import br.familytree.person.Gender;
import br.familytree.relationship.RelationshipType;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Subgrafo para a UI. Cada pessoa aparece uma vez. {@code families} e derivado (pais com filhos em comum);
 * {@code hiddenCounts} so lista pessoas com vizinhos fora do subgrafo.
 */
public record GraphResponse(UUID focusId, List<GraphPerson> persons, List<GraphRelationship> relationships,
        List<Family> families, Map<UUID, HiddenCount> hiddenCounts, boolean truncated) {

    public record GraphPerson(UUID id, String fullName, Gender gender, String photoKey) {}

    public record GraphRelationship(UUID id, RelationshipType type, UUID fromId, UUID toId, String subtype,
            String kind) {}

    public record Family(List<UUID> parentIds, List<UUID> childIds) {}

    public record HiddenCount(int parents, int children, int partners) {}
}
