# VRP Transparency Log v0.1 conformance vectors

Apache-2.0 — see [`LICENSE-CODE`](../../../LICENSE-CODE).

Real, verifiable vectors for [`spec/transparency-log-v0.1.md`](../../../spec/transparency-log-v0.1.md)
§11: a documented test log key, a signed tree head (STH), inclusion proofs for a
known leaf, and consistency proofs between two tree sizes. An independent
implementation can consume every file as pure data: each vector embeds the log
operator's DID document, the artifact, the proof as a log serves it, and the
expected outcome.

Reference verifier: [`lib/vrp-tlog.mjs`](../../../lib/vrp-tlog.mjs), run by
`npm test` (`verify-tlog-vectors`).

## Files

| File | What it is |
| --- | --- |
| [`did-web-document.v0.1.json`](./did-web-document.v0.1.json) | The test log operator's `did:web:example-log.invalid` document with its Ed25519 verification key — the only trust anchor for tree heads (§5.1). |
| [`sth.signed.v0.1.json`](./sth.signed.v0.1.json) | The signed tree head at `tree_size` 4, in the shape a log serves it: `{ signed_tree_head, signature: { jws } }`. |
| [`inclusion/`](./inclusion/) | Ten anchoring vectors: `{ name, description, log_operator_did_document, issuer_domain, artifact_jws, proof, expected }`. |
| [`consistency/`](./consistency/) | Three append-only vectors: `{ name, description, log_operator_did_document, first, second, consistency, expected }`. |

## The test log

Four leaves. Leaf 0 is the committed signed offer vector
([`../verified-stay-offer.signed.v0.1.json`](../verified-stay-offer.signed.v0.1.json)),
hashed over its exact compact-JWS bytes (§4.1), so the log vectors tie to an
artifact an implementation already verifies. Leaves 1–3 stand in for other
artifacts: `artifact_hash` is `sha256:` over the ASCII string
`VRP transparency-log conformance placeholder leaf N` (N = 1, 2, 3). The Merkle
tree only ever sees the hash strings.

Merkle semantics are RFC 6962: leaf hash `SHA-256(0x00 || entry)`, inner node
`SHA-256(0x01 || left || right)`, inclusion per §2.1.1, consistency per §2.1.2.
The **entry** for a leaf is the UTF-8 bytes of its `artifact_hash` string
(`sha256:{hex}`). The specification defines `artifact_hash` (§4.1) but does not
yet state the Merkle entry encoding in normative text; these vectors pin the
encoding the reference log uses until the specification does.

## Expected outcomes

| Vector | Rule | `expected` |
| --- | --- | --- |
| `inclusion/01-anchored` | correct path, tree head signed by the published key | `anchored: true`, `anchored` |
| `inclusion/02-sth-unsigned` | §5: an STH MUST be signed | `sth_unsigned` |
| `inclusion/03-sth-key-not-published` | §5.1: key must be published on the operator's domain | `sth_key_not_published` |
| `inclusion/04-sth-wrong-key` | §5.1 | `sth_signature_invalid` |
| `inclusion/05-inclusion-path-tampered` | §8 step 3 | `inclusion_proof_invalid` |
| `inclusion/06-sth-payload-mismatch` | §5, §8 step 2 | `sth_payload_mismatch` |
| `inclusion/07-artifact-bytes-mutated` | §4.1: one hashable form | `inclusion_proof_invalid` |
| `inclusion/08-log-operated-by-issuer` | §5.1: never a key published by a host node | `log_operated_by_issuer` |
| `inclusion/09-no-inclusion-proof` | §3 principle 1: inclusion is not a precondition | `no_inclusion_proof` (not a failure) |
| `inclusion/10-log-id-not-did-web` | §5: operator key discoverable on an operator domain | `log_id_not_did_web` |
| `consistency/01-consistent` | §8, RFC 6962 §2.1.2 | `consistent: true` |
| `consistency/02-rewritten-history` | §8.1: a rewrite is detected | `consistency_proof_invalid` |
| `consistency/03-second-sth-unsigned` | §5 | `second_sth_unsigned` |

"Anchored" requires all of: an inclusion proof that recomputes to the tree
head, a tree head signed by the operator named in its own `log_id` with the key
that operator publishes, and that operator not being the issuing node itself.

## ⚠️ The keys are throwaway test keys — DO NOT USE

```text
seed = SHA-256("VRP transparency-log v0.1 conformance test log key - DO NOT USE")
key  = Ed25519 private key with that 32-byte seed
kid  = did:web:example-log.invalid#log-ed25519-2026-10
```

A second derived key, label
`VRP transparency-log v0.1 conformance UNPUBLISHED key - DO NOT USE`, signs the
negative vectors 03 and 04 and is deliberately absent from the DID document.
Vector 08 is signed with the host's attestation test key from
[`../attestations/did-web-document.v0.1.json`](../attestations/did-web-document.v0.1.json).

Timestamps are fixed, so the vectors are fully reproducible:

```bash
npm run generate-vectors
```

A clean checkout produces an empty `git diff`.
