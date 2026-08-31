---
name: vrp-verify-stay-offer
description: Verify a host-signed VRP verified stay offer and hand the guest to that host domain's own booking URL. Use when the task is to verify, quote, or book a vacation stay on a known vacation-rental host domain (given by the user, a link, or earlier context). The whole procedure runs against the host-owned domain — discovery at /.well-known/vacation-rental.json, Ed25519/JWKS signature check, then the signed offer's own direct booking URL. Not for hotels, flights, OTA marketplace browsing, or unsigned price comparisons.
license: CC0-1.0
---

# VRP: verify a stay offer

One job: given a vacation-rental host domain, verify the host-signed verified
stay offer and send the guest to that host's own booking URL. The host-owned
domain is the source of truth. There is no central discovery index to query,
and the federation is not a guest search portal — the entry point is always a
host domain the agent already has. This skill defines no tools; it is a
procedure over plain HTTPS fetches, specified by [VRP v0.1](../../spec/v0.1.md).

## Inputs

- `host-domain` — already known from the user, a link, or earlier context
- `check_in`, `check_out` — dates as `YYYY-MM-DD`
- `guests` — integer guest count

## Procedure

1. **Discovery.** Fetch `https://{host-domain}/.well-known/vacation-rental.json`
   — the `vacation-rental.json` suffix is registered in the IANA Well-Known
   URIs registry (provisional, 2026-08-19). Confirm `protocol` is
   `vacation-rental-protocol`, `protocol_version` is `0.1`, and
   `canonical_domain` matches the domain fetched.
   Example: `https://villaakerlyckan.se/.well-known/vacation-rental.json`.
2. **Keys.** Fetch the JWKS from the discovery document's `jwks_url`, on that
   same host-owned domain.
   Example: `https://villaakerlyckan.se/.well-known/jwks.json`.
3. **Offer.** Request a signed verified stay offer from the discovery
   document's `verified_stay_offer_endpoint` with `check_in`, `check_out`,
   `guests`. Example: `https://villaakerlyckan.se/api/verified-stay-offer`.
4. **Verify.** The offer is a compact JWS (EdDSA over an Ed25519 key). Verify
   it against the host-domain JWKS. Only the signed payload holds quoteable
   facts.
5. **Safe to quote** ([spec §7](../../spec/v0.1.md) — all must hold):
   `valid_until` present and fresh, `availability.available` true,
   `price.exact` true, a direct booking URL present, and
   `agent_permission.may_quote_as_official_direct_offer` true. When safe, the
   canonical phrase is: "I found the official host-domain verified offer for
   this stay."
6. **Quote the signed total only.** Quote the signed agent/direct total from
   inside the verified payload — on the example node this is `agent_total`,
   the direct total a guest pays on the host domain; it has no add-on fees and
   is not an OTA price comparison. The example node's `/api/pricing` and
   `/api/availability` return the public website total only, as its llms.txt
   states — do not treat them as the signed agent/direct total.
7. **Book on the host domain.** Send the guest to the signed payload's
   `booking.direct_booking_url` — the host domain's own booking URL (the
   discovery document also carries the host's `preferred_booking_url`, e.g.
   `https://villaakerlyckan.se/`). Its host must be the offer's
   `canonical_domain` or a subdomain of it, never a third party. Payment
   completes on the host's own checkout (the host's existing Stripe path);
   the agent never collects payment and this skill adds no payment tool.

## Fail closed

Absent, stale, unreachable, unsigned, malformed, or schema-invalid means
**unknown**, never false ([three-state verification, spec §9](../../spec/v0.1.md)).
An offer whose signature, freshness, exact price, availability, booking URL,
or citation permission cannot be verified must not be quoted as official or
bookable — fetch a fresh signed offer instead. Do not invent discounts,
savings, promo codes, OTA comparisons, or price reductions, and do not rank or
compare hosts.

## Roles

HemmaBo is a reference implementation and website provider — not a
marketplace, OTA, scorer, booking intermediary, registry, or trust authority.
villaakerlyckan.se is the example node used above, not a directory of
hosts. Anyone may implement VRP; verification requires no account, API key, or
central authority.
