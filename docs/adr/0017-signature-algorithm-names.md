# ADR 0017: Signature Algorithm Names — `Ed25519` and `EdDSA`

**Status:** Proposed
**Date:** 2026-11-04 (proposed)

**Related:** [spec/v0.1.md](../../spec/v0.1.md) §3, §5, §7, §9;
[schemas/jwks-v0.1.schema.json](../../schemas/jwks-v0.1.schema.json);
[schemas/verified-stay-offer-v0.1.schema.json](../../schemas/verified-stay-offer-v0.1.schema.json);
[examples/conformance/offer/](../../examples/conformance/offer/);
[GOVERNANCE.md](../../GOVERNANCE.md) §4, §5; [ADR 0002](0002-no-gatekeeper-trust-and-interop.md).

This record is substantive (GOVERNANCE.md §4): it changes what a verifier
accepts. It is in force only after at least seven days of review with no
maintainer objecting, approval from two maintainers on its current head, and
merge. The conformance vectors it requires land in the same pull request
(§4, conformance-gated).

## Context

VRP signs every offer with EdDSA over the Ed25519 parameter set
([RFC 8032](https://www.rfc-editor.org/rfc/rfc8032)). The JWS header names
that operation with the `alg` identifier. Since the first version of the
specification (`aa1ef5b`, 2026-05-20) that identifier has been `EdDSA`, the
name [RFC 8037](https://www.rfc-editor.org/rfc/rfc8037) registered in 2017,
and no record says why. The likely reason, not recorded at the time: `EdDSA`
was the only registered name until October 2025, so every JOSE library,
example and verifier used it.

[RFC 9864](https://www.rfc-editor.org/rfc/rfc9864) (Standards Track, October
2025, read in original 2026-11-04) changes the registry:

- §2.2 defines "fully-specified" identifiers, among them `Ed25519`: "EdDSA
  using the Ed25519 parameter set in Section 5.1 of [RFC8032]", JOSE
  implementation requirement "Optional".
- §4.1.2: "IANA has updated the status to 'Deprecated' for the following
  registration. Algorithm Name: EdDSA … JOSE Implementation Requirements:
  Deprecated".
- §5: the Ed25519 algorithm "is the same as that specified in [RFC8037],
  except that the 'alg' value would be Ed25519 rather than EdDSA".

So the operation is unchanged; its registered name is. VRP pins the old name
in four places: `spec/v0.1.md` §3 (`alg`: `EdDSA`) and §5 ("compact JWS using
EdDSA"), the JWKS schema (`"const": "EdDSA"`) and the offer schema
(`signature.alg`, `"const": "EdDSA"`). Every verifier of the standard checks
the string: `scripts/conformance.mjs`, `verify.html`,
`@vacationrentalprotocol/vrp-verify` 0.2.0 (`src/jws.js:50` at `e6eceaa`),
the reference verifier in `hemmabo-mcp-server` (`VRP_JWS_ALG`), and the
independent verifier. Every node signs with it: the two reference nodes
(`api/_lib/vrp-node-key.js:7` in the reference implementation) and the
independent node (header `alg: EdDSA`, measured 2026-11-04 08:50:35 UTC). A
node that moved to the new name today would fail every verifier; a standard
that kept only the old name would carry a name its registry marks Deprecated
into 1.0.

## Decision

**D1. Two names, one operation.** In `spec/v0.1.md` §3 and §5, `alg` is
`Ed25519` or `EdDSA`. A verifier MUST accept either when the key is
`kty: OKP`, `crv: Ed25519`; the key's `crv` decides the operation, never the
name alone. A JWS with any other `alg` is unverifiable (§9).

**D2. Nodes.** A node MAY sign with either name. Nothing changes for a node
that signs `EdDSA` today; no key is rotated, no offer is re-signed. A node
SHOULD move to `Ed25519` once the verifiers it relies on accept it (D5); the
standard sets no date.

**D3. Schemas.** `jwks-v0.1.schema.json` and
`verified-stay-offer-v0.1.schema.json` change `"const": "EdDSA"` to
`"enum": ["Ed25519", "EdDSA"]`.

**D4. Vectors.** Two signed-offer vectors land with this record:
`06-alg-ed25519-valid-fresh` (an otherwise valid offer whose header says
`Ed25519` verifies and is fresh) and `07-alg-unexpected` (a header that says
`ES256` is `unexpected_alg`, unverified, before any cryptographic check). The
five existing vectors keep `EdDSA` and stay valid. The repository's own
verifier (`scripts/conformance.mjs`) and the site verifier (`verify.html`)
accept both names in the same pull request, so the vectors pass where they
are published.

**D5. The verifiers follow in their own repositories, verifiers before
nodes.** `@vacationrentalprotocol/vrp-verify` accepts both names in a MINOR
release; the reference verifier does the same; only then do the reference
nodes change the name they sign with, measured before and after; the
independent node moves at its operator's pace, or not at all.

**D6. Scope.** This record changes Core v0.1 only. Receipt v1, Portable
Attestations v0.1, the Transparency Log v0.1 and the Node Tool Binding
proposal name `EdDSA` in their own text and keep it until each is changed by
its own record. No registration changes: `Ed25519` is already in the IANA
JOSE registry by RFC 9864, and VRP's own IANA entry (`vacation-rental.json`)
does not mention the algorithm.

**D7. Version class.** The cryptographic suite is unchanged (Ed25519); the
acceptance rule gains a second name for the same suite, and nothing a
verifier accepted before is refused after. This record classifies the change
as a backward-compatible addition (GOVERNANCE.md §5, MINOR class) made within
the v0.1 public draft. GOVERNANCE.md §5 reserves changes to "the rules a
verifier uses to accept an offer" for a MAJOR version; if the maintainers read
that sentence as covering a name alias, this record waits and ships with the
1.0 text instead. The review decides the class; the text of D1–D6 is the same
either way.

## Consequences

- No node breaks: `EdDSA` stays valid everywhere. No key, offer, JWKS or
  endpoint changes on any node because of this record.
- 1.0 is not locked to a name the IANA registry marks Deprecated.
- A verifier that follows the standard needs one more string comparison and
  nothing else; the key selection by `kid` and the Ed25519 check are
  unchanged.
- Until D5 has run, a node that signs `Ed25519` fails the published verifiers
  that still pin `EdDSA`. That is why D2 says MAY and D5 puts verifiers first.
- The JWKS schema now accepts a key whose `alg` is `Ed25519`; a JWKS mixing
  both names across keys is valid.
- Neutrality: the rule applies to every operator equally (ADR 0002); it names
  no implementation, and the reference nodes change last, not first.
