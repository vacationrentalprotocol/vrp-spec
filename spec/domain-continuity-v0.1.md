# VRP Domain Continuity — Specification v0.1

**Status:** Public draft — **proposal for discussion** (tracks
[issue #59](https://github.com/vacationrentalprotocol/vrp-spec/issues/59)). Forward spec
in the [Receipt v1 §10](./receipt-v1.md) sense: nothing here changes what a
v0.1 or receipt-v1 verifier MUST do today, and legacy nodes that publish
none of the signals below keep exactly today's behavior.

**Published:** 2026-08-01

**Repository:** https://github.com/vacationrentalprotocol/vrp-spec

**Builds on:** [Core VRP v0.1](./v0.1.md) (§3 JWKS, §3.1 key rotation and
revocation, §9 three-state verification),
[Receipt Envelope v1](./receipt-v1.md) (§10 key lifecycle K1–K6, D3
transparency-log field), [Transparency Log v0.1](./transparency-log-v0.1.md).

## 1. Scope and threat model

VRP roots node identity in the host's own domain: `did:web`, JWKS at a
well-known path. Core v0.1 §3.1 covers **key** events (rotation,
revocation). It is silent on **domain** events:

- **Expiry / non-renewal.** An expired domain is not just a dead link. The
  next registrant inherits the `did:web` identifier and can publish their
  own JWKS at the same well-known path — the identifier stays valid while
  the identity behind it silently changes hands.
- **Voluntary transfer or sale** of the domain to a new operator.
- **Registrar-level compromise** (hijack). This document detects epoch
  breaks; it does not prevent registrar attacks.

Consequence for history: once the original JWKS is gone, historical signed
offers lose **live** verifiability. Detection via the transparency log
survives — the log is tamper-evident, not immutable, and that distinction
is load-bearing here.

## 2. Continuity statement (registration epoch)

A node SHOULD publish a **continuity statement** alongside its discovery
document:

| Field | Requirement | Description |
| --- | --- | --- |
| `domain_registered` | SHOULD | Registration (creation) date of the domain as attested by RDAP/registrar data |
| `epoch_started` | MUST | Date this **key lineage** began operating the domain |
| `genesis_kid` | MUST | `kid` of the first key in this lineage (retired keys stay resolvable per K2/K3) |
| `statement_jws` | MUST | Compact JWS over the fields above, signed by a key in the current JWKS |

The property that makes this useful: a **new registrant cannot truthfully
extend the previous epoch**, because they cannot sign with the prior
lineage's keys. An epoch break is therefore detectable by construction —
no central authority, no registry, no permission.

## 3. Verifier guidance (forward spec)

- **V1 — registration post-dates the artifact.** If the domain's current
  registration date (RDAP) is later than the timestamp of the artifact
  being verified, a verifier SHOULD treat live-JWKS verification of that
  artifact as non-authoritative and fall back to transparency-log inclusion
  (D3, K4). In v0.1 §9 terms the honest outcome is the middle state —
  unverifiable live, log-consistent — never a silent pass.
- **V2 — epoch mismatch.** If the artifact predates `epoch_started` of the
  current continuity statement, same downgrade as V1.
- **V3 — no signals published.** Verifier behavior is exactly today's.
  This document adds no new failure modes for legacy nodes.

## 4. Host guidance

Treat the domain as key material:

- Multi-year registration and auto-renew; monitor expiry independently of
  the registrar's own reminders.
- Registrar transfer lock.
- Anchor receipts in the transparency log (K4) so the history of what the
  node signed outlives the domain itself.
- On a planned transfer that is meant to *preserve* identity (same
  operator, new registrar), keep the JWKS and continuity statement intact
  across the move; the epoch does not break because the lineage keeps
  signing.

## 5. What this does not do

- No central continuity authority and no domain revocation list —
  consistent with receipt-v1 neutrality (D8).
- No protection against a registrar-level attacker who also steals the
  node's signing keys; this is detection of identity discontinuity, not
  prevention of infrastructure compromise.
- No claim of immutability anywhere: the transparency log is
  tamper-evident, and public copy about this mechanism MUST keep that word.

## 6. Open questions (for discussion in #59)

1. Should the continuity statement live inside the discovery document or as
   its own well-known artifact?
2. What SHOULD a verifier assume when RDAP data is unavailable or the
   registrar does not expose a creation date?
3. Minimum guidance for hosts on renewal/expiry as an identity-safety
   concern — how prescriptive should the spec be, given large-scale
   link-rot and domain-death data?

## 7. Neutrality

The spec is vendor-neutral. HemmaBo is a reference implementer, not an
approval authority. Any node, on any stack, can publish a continuity
statement and any party can evaluate one without permission from anyone.

## 8. License

Specification text: dedicated to the public domain under [CC0 1.0](../LICENSE).
