package br.familytree.person;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PersonRequest(
        @NotBlank(message = "nome e obrigatorio")
        @Size(max = 200, message = "nome deve ter no maximo 200 caracteres") String fullName,
        Gender gender,
        @Size(max = 10000, message = "observacoes devem ter no maximo 10000 caracteres") String notes) {

    public PersonRequest {
        if (fullName != null) {
            fullName = fullName.trim();
        }
    }
}
