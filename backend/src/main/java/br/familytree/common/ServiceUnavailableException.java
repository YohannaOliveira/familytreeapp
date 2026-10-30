package br.familytree.common;

import lombok.Getter;

public class ServiceUnavailableException extends RuntimeException {
    @Getter
    private final String code;

    public ServiceUnavailableException(String code, String message) {
        super(message);
        this.code = code;
    }
}
