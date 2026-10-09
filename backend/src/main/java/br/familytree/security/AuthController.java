package br.familytree.security;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    public record LoginRequest(@NotBlank @Size(max = 200) String username, @NotBlank @Size(max = 200) String password) {}

    public record TokenResponse(String accessToken, String tokenType, long expiresIn) {}

    public record MeResponse(String username, List<String> roles) {}

    private final AuthenticationManager authenticationManager;
    private final JwtEncoder jwtEncoder;
    private final SecurityProperties props;

    public AuthController(AuthenticationManager authenticationManager, JwtEncoder jwtEncoder, SecurityProperties props) {
        this.authenticationManager = authenticationManager;
        this.jwtEncoder = jwtEncoder;
        this.props = props;
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(request.username(), request.password()));
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(auth.getName())
                .issuedAt(now)
                .expiresAt(now.plus(props.jwtTtl()))
                .claim(SecurityConfig.ROLE_CLAIM, auth.getAuthorities().stream().map(GrantedAuthority::getAuthority).toList())
                .build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
        return new TokenResponse(token, "Bearer", props.jwtTtl().toSeconds());
    }

    /** Stateless: o cliente descarta o token; o JWT curto expira sozinho. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public MeResponse me(Authentication auth) {
        return new MeResponse(auth.getName(),
                auth.getAuthorities().stream().map(GrantedAuthority::getAuthority).toList());
    }
}
