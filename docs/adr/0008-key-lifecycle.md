# ADR 0008: Key Lifecycle for Receipt Verifiability (K1–K6, Forward Specification)

**Status:** Accepted — forward specification. K1–K6 have been listed in
[`spec/receipt-v1.md`](../../spec/receipt-v1.md) §10 since 2026-06-24; this
record states the decisions as the standard's own. The v1 verifier is unchanged.
**Date:** 2026-10-17

**Related:** ADR 0005 (the standard is the source of truth), ADR 0007 (receipt
envelope; D3 transparency-log proof, D4 error registry),
[`spec/v0.1.md`](../../spec/v0.1.md) §2 (`key_custody`) and §3 (JWKS),
[`spec/transparency-log-v0.1.md`](../../spec/transparency-log-v0.1.md),
[`docs/security/KEY_ROTATION.md`](../security/KEY_ROTATION.md).

## Context

A receipt is meant to remain verifiable long after it is issued — across routine
key rotation — and a compromised key must not make forged receipts look
authentic. A node may sign several layers (`offer`, `transport`, `payment`) with
one key, so one compromise reaches all of them. The v1 receipt verifier checks
signature and freshness only: it matches the JWS `kid` against the JWKS fetched
at verification time, with no notion of retired or revoked keys.

The decisions for that lifecycle were recorded in the reference
implementation's repository and cited here twice as "ADR 0011". Following
ADR 0005, this record states them in the standard's own terms.

## Decision

These rules are forward specification: a lifecycle-aware verifier implements
them; the v1 verifier does not change.

- **K1 — Every signature is key-identified.** Each attestation signature carries
  a JWS `kid`, and a receipt records the verifying `kid` per attestation. A `kid`
  is unique to one key and SHOULD NOT be reused.
- **K2 — The JWKS keeps retired public keys.** After a key stops signing, the
  host domain's JWKS keeps serving its public half for the receipt-retention
  horizon (the longest period a receipt must remain independently verifiable).
  Each key entry carries `vrp_key_status` (`active`, `retired` or `revoked`) and
  `vrp_not_before` / `vrp_not_after`, the window in which it was a legitimate
  signer. Historical verification resolves the `kid` against this retained set
  and does not treat "no longer active" as a failure for a signature made inside
  the window.
- **K3 — Rotation is additive and overlapping.** A new key is published as
  `active` and begins signing under a new `kid`; the previous key becomes
  `retired`. Both stay resolvable during an overlap window. Rotation alone never
  invalidates a receipt.
- **K4 — Revocation is distinct from rotation and is time-anchored.** `revoked`
  means the private key is believed compromised, and the revocation publishes
  `vrp_compromised_at`. A receipt proven to predate that instant MAY be treated
  as authentic; one that cannot be proven to predate it MUST be treated as
  invalid for that layer (fail-closed). The proof needs an independent time
  anchor — the transparency-log inclusion proof (ADR 0007 D3,
  [transparency-log-v0.1](../../spec/transparency-log-v0.1.md)) — never the
  times asserted inside the possibly forged signature. A receipt intended to
  survive a future revocation, for example one kept as dispute or insurance
  evidence, therefore MUST carry a `tlog` proof.
- **K5 — Per-layer keys are permitted.** A node MAY sign one layer (for example
  `payment`) with a different key or `kid` than another. Schemas and verifiers
  MUST NOT assume one key per receipt; each attestation resolves its own key
  through its `source` and `kid`.
- **K6 — Lifecycle error codes.** A lifecycle-aware verifier adds
  `key_retired_out_of_window`, `key_revoked` and `tlog_required` to the ADR 0007
  D4 registry. The v1 codes are unchanged.

K1–K6 apply to a node's key whoever holds it. Where `key_custody` is `platform`
([v0.1](../../spec/v0.1.md) §2), the operator holding the key performs rotation
and revocation, and the same metadata is published in the host domain's JWKS; a
verifier applies the same rules either way.

## Consequences

- A receipt can outlive routine rotation (K2, K3), and a leaked key cannot
  silently validate forgeries (K4) or, with separate keys, reach other layers
  (K5).
- The transparency-log proof gains a concrete role: it is what makes a receipt
  survive revocation.
- Until a lifecycle-aware verifier exists, public descriptions of VRP receipts do
  not claim long-term or post-revocation verifiability (`spec/receipt-v1.md`
  §10).
- Nodes that keep receipts as evidence take on JWKS retention, lifecycle
  metadata and `tlog` anchoring.

Not carried over from the implementation's record: its delivery phases, its
acceptance checklist, its internal code paths and its own retention
commitments. This ADR adds no runtime behavior and no new tools.
