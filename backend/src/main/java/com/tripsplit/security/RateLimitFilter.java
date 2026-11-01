package com.tripsplit.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/** Very small in-memory limiter for /auth endpoints: 30 requests per minute per IP. */
public class RateLimitFilter extends OncePerRequestFilter {
    private static final int LIMIT = 30;
    private static final long WINDOW_MS = 60_000;
    private final ConcurrentHashMap<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/v1/auth/") || "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        long now = System.currentTimeMillis();
        Deque<Long> q = hits.computeIfAbsent(req.getRemoteAddr(), k -> new ArrayDeque<>());
        boolean blocked;
        synchronized (q) {
            while (!q.isEmpty() && now - q.peekFirst() > WINDOW_MS) q.pollFirst();
            blocked = q.size() >= LIMIT;
            if (!blocked) q.addLast(now);
        }
        if (blocked) {
            res.setStatus(429);
            res.setContentType("application/json");
            res.getWriter().write("{\"code\":\"TOO_MANY_REQUESTS\",\"message\":\"Too many requests. Try again in a minute.\"}");
            return;
        }
        chain.doFilter(req, res);
    }
}
