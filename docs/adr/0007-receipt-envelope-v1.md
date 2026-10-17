# ADR 0007: Receipt Envelope v1 — Flat `attestations[]` and Decisions D1–D8

**Status:** Accepted — the decisions below have been normative in
[`spec/receipt-v1.md`](../../spec/receipt-v1.md) since its first publication
(2026-06-24); this record states them as the standard's own.
**Date:** 2026-10-17

**Related:** ADR 0002 (no-gatekeeper trust and interop), ADR 0005 (the standard
is the source of truth), ADR 0008 (key lifecycle),
[`spec/receipt-v1.md`](../../spec/receipt-v1.md),
[`schemas/vrp-receipt.v1.schema.json`](../../schemas/vrp-receipt.v1.schema.json),
[`spec/profiles/mcp-composition-profile.md`](../../spec/profiles/mcp-composition-profile.md).

## Context

VRP's receipt envelope is a versioned, verifiable booking record: one object
that carries signed attestations from independent trust layers (`offer`,
`transport`, `payment`, …) so a verifier can check each layer on its own. The
envelope was first designed alongside the reference implementation, and the
record of its design decisions stayed in that implementation's repository. This
repository cited that record thirty times as "ADR 0010" — in the receipt
specification, the MCP profile, the receipt schema, the reference verifier and
the license footer of every specification document — so a reader following the
reasoning behind the standard left the standard to find it.

ADR 0005 decides that the artifacts in this repository are authoritative and
that no implementation is. This record states the receipt-envelope decisions in
the standard's own terms, numbered in this repository's sequence. The
implementation's record is not copied and is not authoritative for VRP.

## Decision

The decision identifiers D1–D8 keep the meaning they have had in the
specification and the schema, so every existing "D2", "D5" or "D8" citation
stays valid.

- **D1 — Flat `attestations[]` is the core.** A v1 receipt is a versioned object
  (`vrp_receipt_version`, `subject`, `issuer`, `attestations`) whose attestations
  form a flat array. A new trust layer is a new array entry; no central approval
  is needed to add one. Recursive sub-receipts and selective disclosure are
  reserved as the named, empty optional fields `sub_receipt` and `disclosure`,
  which a v1 verifier does not recurse into or interpret
  ([receipt-v1 §3](../../spec/receipt-v1.md)). Simplicity is chosen now;
  extension points are reserved, not built.
- **D2 — Freshness is per attestation.** Every attestation carries `valid_from`
  and `valid_until`, evaluated after its signature is validated, so expiry is
  expressed per layer rather than once for the whole receipt (§4).
- **D3 — The transparency-log proof is optional.** An attestation MAY carry a
  `tlog` inclusion proof. A missing proof means signature-only verification, not
  failure, and no log-anchored property may be claimed without one (§5). The
  envelope does not claim evidence it does not carry.
- **D4 — Partial verification and one error registry.** A verifier reports a
  status per attestation — `verified`, `expired`, `invalid`, `unverifiable` — and
  `unverifiable` is never presented as `verified`. Failure codes come from a
  single normative registry that reuses the existing offer-layer and
  payment-layer codes instead of inventing new ones (§6, §6.1).
- **D5 — The signature input is pinned.** Signatures are verified over the
  compact-JWS bytes as received; JSON is never re-canonicalized to re-derive the
  signing input. Where canonical JSON is required for a non-JWS correlator, JCS
  (RFC 8785) is used (§7). An ad hoc canonicalization diverges between
  implementations; the received bytes do not.
- **D6 — A composition profile signs an assertion about the interaction.** A
  transport such as MCP has no message signing, so the attestation is the node's
  signed statement about the interaction, never the unsigned transport bytes.
  The first profile is MCP `transport` (§8 and the MCP composition profile).
- **D7 — Licensing.** Specification text is dedicated to the public domain under
  CC0 1.0; reference code and conformance vectors are Apache-2.0, which includes
  a royalty-free patent grant ([README](../../README.md#license),
  [PATENTS.md](../../PATENTS.md)). The standard can then be implemented, and the
  reference code reused, without a licence or patent negotiation.
- **D8 — Neutrality in specification language.** The specification, schema and
  vectors are vendor-neutral. No implementation, the reference implementation
  included, is an approval authority; composition profiles are published, not
  granted (§13; ADR 0002).

Not carried over from the implementation's record: its delivery phases, its
implementation-status tables, its internal code paths, and its rules for its own
public communication. They describe one implementation, not the standard.

## Consequences

- The thirty "ADR 0010" citations in this repository now cite ADR 0007; the
  standard's reasoning no longer points outside the standard.
- `spec/receipt-v1.md` §2 lists D1–D8 (it said "D1–D7", although §13 of the same
  document is "Neutrality (D8)").
- Implementation roadmap wording that stood beside these citations — phase
  numbers, work-order and tracker numbers — is removed from the specification
  text. No normative requirement changes.
- No schema field, verification rule or conformance vector changes; the receipt
  schema changes only in `description` strings.

This ADR adds no runtime behavior and no new tools.
