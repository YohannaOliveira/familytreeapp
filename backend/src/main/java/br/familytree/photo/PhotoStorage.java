package br.familytree.photo;

import java.util.Map;

/** Armazenamento de objetos de foto. Interface para permitir mock nos testes. */
public interface PhotoStorage {

    /** URL pre-assinada para PUT; o cliente deve enviar exatamente os cabecalhos retornados. */
    PresignedUpload presignUpload(String key, String contentType, long size);

    /** Remove o objeto; ausencia nao e erro. */
    void delete(String key);

    record PresignedUpload(String url, Map<String, String> headers) {}
}
