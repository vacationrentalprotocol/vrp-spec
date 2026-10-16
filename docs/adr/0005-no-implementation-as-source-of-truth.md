# ADR 0005: The Standard Is the Source of Truth; No Implementation Is

**Status:** Proposed
**Date:** 2026-10-16

**Related:** ADR 0002 (no-gatekeeper trust and interop), ADR 0003 (GitHub org
segregation), GOVERNANCE.md §1–§2.

## Context

VRP is an open standard with a reference implementation (HemmaBo). Several
places in this repository stated the relationship backwards — the specification
text, a schema, the reference verifier and a profile named the reference
implementation's code as the thing to conform to:

- `spec/stayintent-discovery-v0.1.md` §8 called a specific implementation file
  ("`api/search-properties.ts`") "the normative conformant surface".
- `schemas/README.md` ordered the standard's receipt schema to stay "byte-equal"
  with a copy in the implementation repository, with the two copies required to
  "stay byte-identical".
- `lib/vrp-receipt.mjs` said its behaviour "MUST match" the implementation, and
  `lib/vrp-jws.mjs` was described as "Mirrored from" it.
- `spec/receipt-v1.md`, the MCP composition profile, and the receipt vector
  README described the standard's own artifacts as "mirrored from" the
  implementation.

Two profile sections also used the word "moat" for the shared signing key —
competitive framing that does not belong in a CC0 standard.

This contradicts ADR 0002 (verification resolves to the host domain and the
relevant public specifications, never to HemmaBo as an authority) and
GOVERNANCE.md §1–§2 (no implementation gains authority over the standard by
existing). Naming an implementation file "the normative conformant surface" is
the same error as a gatekeeper, in another layer.

## Decision

The authoritative artifacts are the ones in this repository: the specification
text, the JSON Schemas, the conformance vectors, the JSON-LD context and terms,
and the reference verifier under `lib/`. Conformance is established against
these and against the signed conformance vectors — never against any
implementation's code, node, or repository.

Where this repository and an implementation (the HemmaBo reference
implementation included) disagree, this repository governs and the
implementation is corrected. Documentation MAY note that an artifact was first
authored alongside the reference implementation, but MUST NOT state that the
standard's artifact mirrors, or must match, an implementation's.

Competitive framing ("moat") is not used in the specification text.

## Consequences

- The wording in nine places is corrected (see the Class A line list on the pull
  request). Seven reverse the direction — the standard, not an implementation,
  is the source of truth; two drop the word "moat".
- Eight of the nine change only which side is the source of truth, or a single
  word; no schema field, signing rule, or verification rule changes in meaning.
  One does change meaning: `stayintent-discovery` §8 moves the normative
  conformant surface from a named implementation file to any deterministic
  filter that satisfies the conformance vectors.
- For that one change, a new `examples/conformance/stayintent/README.md` records
  that the vectors, not an implementation, define the conformant surface,
  satisfying the conformance-gate (GOVERNANCE.md §4, "Conformance-gated").
- This is a substantive change, recorded as this ADR under GOVERNANCE.md §4:
  at least seven days for review with no maintainer objecting, and — while two
  maintainers are active — approval from two (one maintainer approves while only
  one is active).
- `ADR 0010`/`0011`, currently cited from the implementation repository, are
  brought into this repository as the standard's own ADRs in a follow-up; that
  work is out of scope here.

This ADR adds no runtime behavior and no new tools.
