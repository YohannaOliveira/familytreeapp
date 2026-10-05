package br.familytree.graph;

import br.familytree.common.NotFoundException;
import br.familytree.graph.GraphResponse.Family;
import br.familytree.graph.GraphResponse.GraphPerson;
import br.familytree.graph.GraphResponse.GraphRelationship;
import br.familytree.relationship.RelationshipType;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GraphService {

    public enum Direction { UP, DOWN, PARTNERS }

    private final GraphRepository repository;
    private final int maxNodes;

    public GraphService(GraphRepository repository, @Value("${familytree.graph.max-nodes:500}") int maxNodes) {
        this.repository = repository;
        this.maxNodes = maxNodes;
    }

    /** 4 queries por requisicao, independente do tamanho do subgrafo. */
    public GraphResponse graph(UUID focus, int up, int down, boolean partners) {
        List<UUID> ids = repository.collectIds(focus, up, down, partners, maxNodes + 1);
        return assemble(focus, ids, false);
    }

    /** Vizinhos diretos de {@code id}; o cliente descarta o que ja tem (o proprio {@code id} nao e reenviado). */
    public GraphResponse expand(UUID id, Direction direction) {
        List<UUID> ids = new ArrayList<>();
        ids.add(id);
        for (UUID n : repository.neighbors(id, direction, maxNodes + 1)) {
            if (!ids.contains(n)) {
                ids.add(n);
            }
        }
        return assemble(id, ids, true);
    }

    @Transactional(readOnly = true)
    public RelativesResponse relatives(UUID id) {
        Map<String, List<RelativesResponse.Relative>> byCat = new LinkedHashMap<>();
        repository.relatives(id).forEach(e -> byCat.computeIfAbsent(e.getKey(), k -> new ArrayList<>()).add(e.getValue()));
        if (byCat.isEmpty() && repository.persons(List.of(id)).isEmpty()) {
            throw new NotFoundException("Pessoa nao encontrada: " + id);
        }
        return new RelativesResponse(c(byCat, "parents"), c(byCat, "children"), c(byCat, "siblings"),
                c(byCat, "halfSiblings"), c(byCat, "grandparents"), c(byCat, "grandchildren"),
                c(byCat, "unclesAunts"), c(byCat, "cousins"), c(byCat, "partners"));
    }

    private static List<RelativesResponse.Relative> c(Map<String, List<RelativesResponse.Relative>> m, String k) {
        return m.getOrDefault(k, List.of());
    }

    private GraphResponse assemble(UUID focus, List<UUID> ids, boolean excludeFocus) {
        boolean truncated = ids.size() > maxNodes;
        if (truncated) {
            ids = ids.subList(0, maxNodes);
        }
        List<GraphPerson> persons = repository.persons(ids);
        if (persons.stream().noneMatch(p -> p.id().equals(focus))) {
            throw new NotFoundException("Pessoa nao encontrada: " + focus);
        }
        List<GraphRelationship> edges = repository.edgesAmong(ids);
        var hidden = repository.hiddenCounts(ids);
        if (excludeFocus) {
            persons = persons.stream().filter(p -> !p.id().equals(focus)).toList();
        }
        return new GraphResponse(focus, persons, edges, families(edges), hidden, truncated);
    }

    /** Pais (do subgrafo) agrupados por filhos em comum; inclui familias de um so pai/mae. */
    static List<Family> families(List<GraphRelationship> edges) {
        Map<UUID, TreeSet<UUID>> parentsOf = new LinkedHashMap<>();
        for (GraphRelationship e : edges) {
            if (e.type() == RelationshipType.PARENT_OF) {
                parentsOf.computeIfAbsent(e.toId(), k -> new TreeSet<>()).add(e.fromId());
            }
        }
        Map<List<UUID>, List<UUID>> grouped = new LinkedHashMap<>();
        parentsOf.forEach((child, parents) ->
                grouped.computeIfAbsent(List.copyOf(parents), k -> new ArrayList<>()).add(child));
        return grouped.entrySet().stream()
                .map(e -> new Family(e.getKey(), e.getValue().stream().sorted().toList()))
                .sorted(Comparator.comparing(f -> f.parentIds().toString()))
                .toList();
    }
}
