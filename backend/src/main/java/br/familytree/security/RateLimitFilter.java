package br.familytree.security;

import br.familytree.common.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

/** Limite por IP: restrito no login (forca bruta) e geral nas demais rotas. */
public class RateLimitFilter extends OncePerRequestFilter {

    static final String LOGIN_PATH = "/auth/login";

    private final SecurityProperties props;
    private final ObjectMapper mapper;
    private final Cache<String, Bucket> loginBuckets = newCache(Duration.ofHours(1));
    private final Cache<String, Bucket> apiBuckets = newCache(Duration.ofHours(1));

    public RateLimitFilter(SecurityProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
    }

    private static Cache<String, Bucket> newCache(Duration idle) {
        return Caffeine.newBuilder().expireAfterAccess(idle).maximumSize(100_000).build();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (HttpMethod.OPTIONS.matches(request.getMethod()) || request.getRequestURI().startsWith("/actuator/health")) {
            chain.doFilter(request, response);
            return;
        }
        String ip = request.getRemoteAddr();
        boolean login = HttpMethod.POST.matches(request.getMethod()) && LOGIN_PATH.equals(request.getRequestURI());

        ConsumptionProbe probe = bucket(apiBuckets, ip, props.apiMaxRequests(), props.apiWindow()).tryConsumeAndReturnRemaining(1);
        if (probe.isConsumed() && login) {
            probe = bucket(loginBuckets, ip, props.loginMaxAttempts(), props.loginWindow()).tryConsumeAndReturnRemaining(1);
        }
        if (probe.isConsumed()) {
            chain.doFilter(request, response);
            return;
        }
        long retryAfter = Math.max(1, Duration.ofNanos(probe.getNanosToWaitForRefill()).toSeconds());
        response.setStatus(429);
        response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(retryAfter));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(), new ErrorResponse(
                "RATE_LIMITED", "Muitas requisicoes; tente novamente em instantes", null, UUID.randomUUID().toString()));
    }

    private static Bucket bucket(Cache<String, Bucket> cache, String key, int capacity, Duration window) {
        return cache.get(key, k -> Bucket.builder()
                .addLimit(limit -> limit.capacity(capacity).refillIntervally(capacity, window))
                .build());
    }
}
