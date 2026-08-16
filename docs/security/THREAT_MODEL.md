# VRP Threat Model (v0.1)

A short, STRIDE-oriented threat model for the core Vacation Rental Protocol. It
covers the four things that decide whether an AI agent can trust a stay offer:

1. **Ed25519 signing** of verified stay offers,
2. the **JWKS** that publishes the verification keys,
3. **host-domain control as the source of truth**, and
4. what happens when a **host signing key is compromised**.

It does **not** model OTA, marketplace, ranking, or payment-processor scenarios —
VRP has none of those (see [ADR 0002](../adr/0002-no-gatekeeper-trust-and-interop.md)).
The normative rules referenced here live in [spec §3–§9](../../spec/v0.1.md); this
document only makes the trust boundaries and attacker goals explicit.

## Trust root

The root of trust is **domain control** (`did:web`): a VRP node's signing keys are
whatever the host-owned domain serves at its JWKS. There is no central issuer,
registry, or accreditation authority to appeal to. Consequently:

- A valid signature proves the offer came from whoever controls the host domain.
- If the domain itself is taken over (DNS, TLS, or hosting compromise), the
  attacker *is* the source of truth as far as the protocol can tell. **Domain-level
  security is out of scope for VRP** and is the operator's responsibility
  ([spec §3.1](../../spec/v0.1.md)).

## Assets

| Asset | Why it matters |
| --- | --- |
| Host **private signing key** | Whoever holds it can mint offers that verify as official. |
| **JWKS** (`/.well-known/jwks.json`) | The *only* revocation authority — a key is valid exactly while it is present here. |
| **Discovery document** (`/.well-known/vacation-rental.json`) | Points agents at the JWKS and the offer endpoint. |
| **Signed stay offer** | Carries the quoteable facts (price, availability, `valid_until`, booking URL). |

## Actors

- **Host / operator** — controls the domain and the signing key; the legitimate signer.
- **Verifying agent** — an AI agent or client that fetches, verifies, and quotes offers. Must **fail closed** ([spec §8](../../spec/v0.1.md)).
- **Network attacker** — can intercept or modify traffic that is not integrity-protected.
- **Key thief** — has obtained the host's private signing key but does *not* control the domain.
- **Domain attacker** — controls what the host domain serves (out of scope, listed for completeness).

## STRIDE

### Spoofing — "pretend to be the host"

- *Threat:* an attacker serves a forged offer or an unsigned "offer" and hopes the
  agent quotes it as official.
- *Mitigation:* every quoteable fact is inside a compact Ed25519 JWS whose key must
  be present in the host domain's JWKS. An agent MUST verify the signature against
  the JWKS and MUST NOT quote anything unsigned or unverifiable
  ([spec §5, §7, §8](../../spec/v0.1.md)). Fetching the discovery document and JWKS
  over HTTPS from the host domain binds identity to domain control.
- *Residual risk:* a **domain attacker** can publish their own keys and sign freely
  — no key-level control detects this. Out of scope (domain security is the
  operator's).

### Tampering — "change price, dates, or the booking URL"

- *Threat:* alter the offer in transit — bump the price, extend `valid_until`, or
  swap the `direct_booking_url` for an attacker-controlled destination.
- *Mitigation:* integrity comes solely from the JWS over the payload; any change
  invalidates the signature. The `direct_booking_url` is a signed field, and an
  agent MUST reject a booking URL whose host is not the offer's `canonical_domain`
  ([spec §5.1](../../spec/v0.1.md)). There is no separate, spoofable side-channel
  for these facts.

### Repudiation — "deny having offered these terms"

- *Threat:* a host later disputes which price or refund terms were in force at quote
  time.
- *Mitigation:* the signed payload binds the terms (including
  `rules.refund_schedule`) to a specific key and moment; a verifier can prove after
  the fact exactly what was signed. A node MAY additionally record key events in an
  append-only [transparency log](../../spec/transparency-log-v0.1.md) for a
  tamper-evident history of which key was valid when.

### Information disclosure — "leak the key or private data"

- *Threat:* exposure of the **private signing key** is the critical loss (see
  *Compromised host key* below). VRP offers themselves carry public offer facts,
  not secrets.
- *Mitigation:* only public keys are ever published (in the JWKS). Key custody is
  declared via `operator.key_custody` (`self` or `platform`) so an agent knows what
  a valid signature guarantees ([spec §2](../../spec/v0.1.md)). Protecting the
  private key at rest is the operator's responsibility.

### Denial of service — "make verification fail or flood the node"

- *Threat:* make the JWKS or offer endpoint unreachable, or drive verifiers into
  excessive JWKS fetches using offers with unknown `kid`s.
- *Mitigation:* unreachable is treated as **Unknown**, never as a valid offer — the
  agent fails closed rather than quoting stale data ([spec §8, §9](../../spec/v0.1.md)).
  Verifiers SHOULD rate-limit or coalesce refresh-on-miss per domain to avoid
  amplification ([spec §3.1](../../spec/v0.1.md)). The JWKS is a small, CDN-cacheable
  document. Availability of a given node's infrastructure is out of scope for the
  protocol.

### Elevation of privilege — "get a bad offer treated as official"

- *Threat:* make a stale, unavailable, or unsigned value cross the line into
  "official host-domain verified offer."
- *Mitigation:* the Safe-to-Quote gate ([spec §7](../../spec/v0.1.md)) requires
  *all* of: signature verifies, `valid_until` fresh, `availability.available` true,
  `price.exact` true, direct booking URL present, and explicit agent permission.
  Three-state verification ([spec §9](../../spec/v0.1.md)) forbids inferring Affirmed
  from Unknown. A lower verifiability class must never be presented as a higher one
  ([spec §5.4](../../spec/v0.1.md)).

## Central scenario: compromised host key

An attacker who steals the **private signing key** (but does not control the domain)
can mint fresh, well-formed offers with a future `valid_until` — so **freshness
alone does not stop them**. The only thing that de-trusts them is the key being
absent from the JWKS the verifier holds. This drives two protocol controls:

- The compromised key MUST be **removed from the JWKS immediately**. Its presence
  is the entire trust signal; removing it makes every offer signed with it
  unverifiable, including the operator's own legitimate ones — this is intentional,
  because a verifier cannot tell the attacker's signatures from the host's.
- A conforming verifier MUST NOT cache a JWKS for longer than **5 minutes**, so a
  removed key is fully de-trusted within that window. This bound is a conformance
  requirement, not something VRP can force on a non-conforming verifier
  ([spec §3.1](../../spec/v0.1.md)).

Handling is detailed in [KEY_ROTATION.md](./KEY_ROTATION.md) and
[INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md).

## Explicitly out of scope

- **Domain compromise** (DNS / TLS / hosting takeover) — the attacker becomes the
  source of truth; no key-level mechanism can detect it.
- **OTA / marketplace / ranking / payment-processor** attack scenarios — VRP is
  none of these.
- **The HemmaBo product** and any specific host's server-side application.
