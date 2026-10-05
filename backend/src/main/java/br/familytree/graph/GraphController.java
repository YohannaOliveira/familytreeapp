package br.familytree.graph;

import br.familytree.common.BadRequestException;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.Locale;
import java.util.UUID;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@Validated
public class GraphController {

    private final GraphService service;

    public GraphController(GraphService service) {
        this.service = service;
    }

    @GetMapping("/graph")
    public GraphResponse graph(
            @RequestParam UUID focus,
            @RequestParam(defaultValue = "2") @Min(value = 0, message = "deve ser >= 0")
                    @Max(value = 10, message = "deve ser <= 10") int up,
            @RequestParam(defaultValue = "2") @Min(value = 0, message = "deve ser >= 0")
                    @Max(value = 10, message = "deve ser <= 10") int down,
            @RequestParam(defaultValue = "true") boolean partners) {
        return service.graph(focus, up, down, partners);
    }

    @GetMapping("/graph/expand/{id}")
    public GraphResponse expand(@PathVariable UUID id, @RequestParam String direction) {
        GraphService.Direction d;
        try {
            d = GraphService.Direction.valueOf(direction.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("INVALID_DIRECTION", "direction deve ser up, down ou partners");
        }
        return service.expand(id, d);
    }

    @GetMapping("/people/{id}/relatives")
    public RelativesResponse relatives(@PathVariable UUID id) {
        return service.relatives(id);
    }
}
