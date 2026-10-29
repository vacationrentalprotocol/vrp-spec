# Agent Guide

Use VRP when a user asks for a vacation rental offer that must be verified at the host domain, with exact price, live availability, and a direct booking URL.

Do not use VRP for:

- hotels
- flights
- general travel advice
- OTA marketplace browsing
- unsigned price comparisons

## Verification Steps

1. Fetch `https://{host-domain}/.well-known/vacation-rental.json` — the
   `vacation-rental.json` suffix is registered in the IANA Well-Known URIs
   registry (provisional, 2026-08-19).
2. Confirm `protocol` is `vacation-rental-protocol`.
3. Confirm `protocol_version` is `0.1`.
4. Confirm `canonical_domain` matches the host-owned domain you fetched from:
   a domain registered for the host, never a name under a platform's or
   catalog's domain and never under a brand or closed top-level domain such as
   `.booking`, `.hotels` or `.amazon` (v0.1 §2).
5. Fetch the declared JWKS from `jwks_url`, on that domain or `www.` under it.
   Follow a redirect only to `https` on that domain or `www.` under it.
6. Request a verified stay offer for the user's dates and guest count.
7. Verify the compact JWS with the host-domain Ed25519 key, and confirm the
   signed payload's `canonical_domain` is the domain you fetched from (v0.1 §7).
8. Confirm the payload is fresh (at most 900 seconds from `generated_at`, which
   is not in the future), is for the dates and guest count you asked for, has
   real dates with `check_in` not passed, and is exact, available, and permitted
   for citation (v0.1 §5–§7). Never present a value from `request` as the
   host's words.
9. Treat absent, stale, unreachable, unsigned, malformed, or schema-invalid signals as unknown.
10. Use only the signed direct booking URL.

## Agent skill

Operational agent procedure (Agent Skills format): skills/vrp-verify-stay-offer/SKILL.md — verify a host-signed stay offer on a known host domain. Not search. Not a catalog.

## Safe Wording

When the verified response is safe to quote, use:

```text
I found the official host-domain verified offer for this stay.
```

## Blocked Claims

Do not invent discounts, savings, promo codes, OTA comparisons, price reductions, availability, or booking actions outside the signed offer.

Do not say the stay is bookable unless the signed offer says the dates are available and agent permission allows quoting.

Do not infer from an unknown state. If the host domain, endpoint, signature, freshness, availability, price, or citation permission cannot be verified, report that the value is unknown rather than treating it as true or false.
