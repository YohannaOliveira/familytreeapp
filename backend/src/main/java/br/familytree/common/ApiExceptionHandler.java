package br.familytree.common;

import jakarta.validation.ConstraintViolationException;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** Formato unico de erro para toda a API; nunca expoe stacktrace. */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(NotFoundException.class)
    ResponseEntity<Object> notFound(NotFoundException ex) {
        return build(HttpStatus.NOT_FOUND, "NOT_FOUND", ex.getMessage(), null);
    }

    @ExceptionHandler(ConflictException.class)
    ResponseEntity<Object> conflict(ConflictException ex) {
        return build(HttpStatus.CONFLICT, ex.code(), ex.getMessage(), null);
    }

    @ExceptionHandler(BadRequestException.class)
    ResponseEntity<Object> badRequest(BadRequestException ex) {
        return build(HttpStatus.BAD_REQUEST, ex.code(), ex.getMessage(), null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<Object> integrity(DataIntegrityViolationException ex) {
        log.warn("Violacao de integridade", ex);
        String detail = String.valueOf(ex.getMostSpecificCause().getMessage());
        if (detail.contains("uq_relationship")) {
            return build(HttpStatus.CONFLICT, "DUPLICATE_RELATIONSHIP", "Relacionamento ja existe", null);
        }
        return build(HttpStatus.CONFLICT, "CONFLICT", "Operacao viola uma restricao de integridade", null);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<Object> constraint(ConstraintViolationException ex) {
        List<ErrorResponse.FieldError> errors = ex.getConstraintViolations().stream()
                .map(v -> {
                    String path = v.getPropertyPath().toString();
                    return new ErrorResponse.FieldError(path.substring(path.lastIndexOf('.') + 1), v.getMessage());
                })
                .toList();
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Parametros invalidos", errors);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<Object> typeMismatch(MethodArgumentTypeMismatchException ex) {
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Parametro invalido: " + ex.getName(),
                List.of(new ErrorResponse.FieldError(ex.getName(), "valor invalido")));
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<Object> unauthenticated(AuthenticationException ex) {
        return build(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Usuario ou senha invalidos", null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<Object> forbidden(AccessDeniedException ex) {
        return build(HttpStatus.FORBIDDEN, "FORBIDDEN", "Acesso negado", null);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Object> unexpected(Exception ex) {
        String traceId = newTraceId();
        log.error("Erro inesperado traceId={}", traceId, ex);
        return respond(HttpStatus.INTERNAL_SERVER_ERROR, new ErrorResponse(
                "INTERNAL_ERROR", "Erro interno do servidor", null, traceId));
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        List<ErrorResponse.FieldError> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> new ErrorResponse.FieldError(f.getField(), f.getDefaultMessage()))
                .toList();
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Dados invalidos", errors);
    }

    /** Demais erros do Spring MVC (JSON malformado, 404 de rota, metodo nao suportado...). */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, Object body, HttpHeaders headers,
            HttpStatusCode statusCode, WebRequest request) {
        HttpStatus status = HttpStatus.valueOf(statusCode.value());
        String code = status == HttpStatus.NOT_FOUND ? "NOT_FOUND"
                : status.is4xxClientError() ? "BAD_REQUEST" : "INTERNAL_ERROR";
        String message = status.is5xxServerError() ? "Erro interno do servidor"
                : status == HttpStatus.NOT_FOUND ? "Recurso nao encontrado" : "Requisicao invalida";
        return build(status, code, message, null);
    }

    private ResponseEntity<Object> build(HttpStatus status, String code, String message,
            List<ErrorResponse.FieldError> fieldErrors) {
        return respond(status, new ErrorResponse(code, message, fieldErrors, newTraceId()));
    }

    private ResponseEntity<Object> respond(HttpStatus status, ErrorResponse body) {
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON).body(body);
    }

    private static String newTraceId() {
        return UUID.randomUUID().toString();
    }
}
