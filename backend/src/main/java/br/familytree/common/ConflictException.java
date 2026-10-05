package br.familytree.common;

public class ConflictException extends RuntimeException {
    private final String code;

    public ConflictException(String message) {
        this("CONFLICT", message);
    }

    public ConflictException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
