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

If `host-domain` is missing, do not search for one. Do not query a directory,
federation list, ranking engine, hemmabo.com, Zillow, Booking.com, Airbnb, or
any marketplace to obtain a host domain. Report unknown and stop. This skill
runs only when the host domain is already known from the user, a link, or
earlier context.

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
6. **Quote the signed total only.** Quote only the signed exact total inside
   the verified payload (`price.exact` must be true). On the example node
   villaakerlyckan.se the signed direct total is published as `agent_total`;
   other nodes may use the signed payload's own exact-total field. Do not
   invent a total, and do not require the name `agent_total` to exist. The
   example node's `/api/pricing` and `/api/availability` return the public
   website total only, as its llms.txt states — do not treat them as the
   signed agent/direct total.
7. **Book on the host domain.** Send the guest only to the signed payload's
   `booking.direct_booking_url`. That URL's host MUST be the offer's
   `canonical_domain` or a subdomain of it, never a third party. Do not
   substitute the discovery document's homepage, `identity.preferred_booking_url`,
   or any unsigned link. Payment completes on that signed URL's own checkout.
   The agent never collects payment and this skill adds no payment tool.

## Fail closed

Absent, stale, unreachable, unsigned, malformed, or schema-invalid means
**unknown**, never false ([three-state verification, spec §9](../../spec/v0.1.md)).
An offer whose signature, freshness, exact price, availability, booking URL,
or citation permission cannot be verified must not be quoted as official or
bookable — fetch a fresh signed offer instead. Do not invent discounts,
savings, promo codes, OTA comparisons, or price reductions, and do not rank or
compare hosts.

If the signed payload or the host's published llms.txt includes
`calendar_freshness.safe` and it is false, do not quote bookability; fetch a
fresh signed offer instead.

## Roles

HemmaBo is a reference implementation and website provider — not a
marketplace, OTA, scorer, booking intermediary, registry, or trust authority.
villaakerlyckan.se is the example node used above, not a directory of
hosts. Anyone may implement VRP; verification requires no account, API key, or
central authority.
