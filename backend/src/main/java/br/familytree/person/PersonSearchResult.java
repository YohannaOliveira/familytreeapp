package br.familytree.person;

import java.util.List;
import java.util.UUID;

/** Resultado de busca: {@code parents} traz os nomes dos pais para distinguir homonimos. */
public record PersonSearchResult(UUID id, String fullName, Gender gender, String photoKey, List<String> parents) {}
