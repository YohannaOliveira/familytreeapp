package br.familytree.common;

import lombok.Getter;

public class ConflictException extends RuntimeException {
    @Getter
    private final String code;

    public ConflictException(String message) {
        this("CONFLICT", message);
    }

    public ConflictException(String code, String message) {
        super(message);
        this.code = code;
    }
}
