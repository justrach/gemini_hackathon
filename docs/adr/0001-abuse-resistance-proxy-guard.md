# ADR 0001: Abuse-Resistant Access to Gemini via Middleware + Internal Proxy

- Status: Accepted
- Date: 2025-09-07

## Context

Previously, the client could call our image generation endpoint directly. This exposed us to:

- Cross-site request abuse (CSRF-style or off-origin calls).
- Accidental key exposure if client-to-server plumbing wasn’t carefully isolated.
- Lack of strict input guardrails on public-facing endpoints.

We needed a way to make browser access safer without introducing a full auth system.

## Decision

Introduce a SameSite/HttpOnly session cookie via middleware and route all browser-originated generation calls through a constrained proxy. The actual generation endpoint only accepts requests from the proxy using a server-only header.

## Changes

- `middleware.ts`
  - Sets a minimal `HttpOnly`, `SameSite=Strict` cookie (`cg_session`) for same-site, non-API requests.
  - Skips API routes and Next internal assets to avoid unnecessary work or cache fragmentation.

- `app/api/gemini/proxy/route.ts` (public entrypoint)
  - Enforces same-origin using `Origin`/`Referer` vs request URL origin.
  - Requires the `cg_session` cookie set by middleware.
  - Requires `Content-Type: application/json`.
  - Forwards to the internal `generate` endpoint with a server-only `x-internal-auth` header; disables caching.

- `app/api/gemini/generate/route.ts` (internal-only)
  - Rejects any request missing/invalid `x-internal-auth`.

## Implementation Details

- Cookie attributes:
  - `HttpOnly` prevents JS access; reduces token exfiltration risk.
  - `SameSite=Strict` limits cross-site sends; mitigates CSRF-style abuse.
  - `secure` is enabled in production; `path=/`; `maxAge=7d`.
  - Only set for non-API routes; API requests receive but do not trigger cookie issuance.

- Proxy validation flow:
  1) Compute request origin from URL; compare with `Origin` or `Referer` header.
  2) Check presence/value of `cg_session` cookie.
  3) Enforce JSON `Content-Type`.
  4) Forward to internal endpoint over same host with `x-internal-auth`.
  5) Return upstream status and JSON body.

- Internal generation handler:
  - Verifies `x-internal-auth` equals server-held secret before work begins.
  - Uses server-side Gemini client; API key stays on server.

## Consequences

- Public endpoint is significantly harder to script from other sites (SameSite=Strict + origin checks).
- The internal generation route is not callable by the browser directly.
- Slight additional hop (proxy) adds minimal latency, but improves safety.
- Frontend should call `/api/gemini/proxy` instead of `/api/gemini/generate`.

## Security Considerations

- Strengths:
  - Same-origin + SameSite cookie checks raise the bar for off-origin abuse.
  - Internal-only hop avoids trusting client-sent secrets for protected work.
  - Content-Type pinning reduces accidental surface for other encodings.

- Limitations:
  - Not a substitute for authentication/authorization.
  - No rate limiting or IP throttling yet.
  - The internal secret is currently in code; should be an env var.

## Follow-ups

- Replace hardcoded internal secret with an environment variable and rotation policy.
- Add rate limiting, body size limits, and input validation (prompt length, image count) on the proxy.
- Ensure all client code uses the proxy path consistently.

