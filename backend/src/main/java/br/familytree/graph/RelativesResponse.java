package br.familytree.graph;

import java.util.List;
import java.util.UUID;

/** Parentes derivados do grafo (nada disso e armazenado). */
public record RelativesResponse(List<Relative> parents, List<Relative> children, List<Relative> siblings,
        List<Relative> halfSiblings, List<Relative> grandparents, List<Relative> grandchildren,
        List<Relative> unclesAunts, List<Relative> cousins, List<Relative> partners) {

    public record Relative(UUID id, String fullName) {}
}
