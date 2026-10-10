package br.familytree.photo;

import br.familytree.person.PersonResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PhotoController {

    private final PhotoService service;

    public PhotoController(PhotoService service) {
        this.service = service;
    }

    @PostMapping("/api/v1/photos/upload-url")
    public PhotoService.UploadUrlResponse uploadUrl(@Valid @RequestBody UploadUrlRequest req) {
        return service.createUploadUrl(req.contentType(), req.size());
    }

    @PutMapping("/api/v1/people/{id}/photo")
    public PersonResponse setPhoto(@PathVariable UUID id, @Valid @RequestBody SetPhotoRequest req) {
        return service.setPhoto(id, req.photoKey());
    }

    @DeleteMapping("/api/v1/people/{id}/photo")
    public ResponseEntity<Void> removePhoto(@PathVariable UUID id) {
        service.removePhoto(id);
        return ResponseEntity.noContent().build();
    }

    public record UploadUrlRequest(
            @NotBlank(message = "contentType e obrigatorio") String contentType,
            @NotNull(message = "size e obrigatorio") @Positive(message = "size deve ser positivo") Long size) {}

    public record SetPhotoRequest(@NotBlank(message = "photoKey e obrigatorio") String photoKey) {}
}
