# ADR 0017: Signature Algorithm Names — `Ed25519` and `EdDSA`

**Status:** Proposed · ships with 1.0 and becomes Accepted with [ADR 0013](0013-vrp-1-0.md) (the maintainers read GOVERNANCE §5 as reserving the change for a MAJOR version, D7)
**Date:** 2026-11-04 (proposed) · 2026-11-05 (folded into the 1.0 record) · 2026-11-13 (the files it changes are the 1.0 candidate's, not v0.1's; evidence stated as measured)

**Related:** [spec/v1.0.md](../../spec/v1.0.md) §3, §5, §9 (the candidate
text this record changes); [spec/v0.1.md](../../spec/v0.1.md) §3, §5 (unchanged,
names `EdDSA` only);
[schemas/jwks-v1.0.schema.json](../../schemas/jwks-v1.0.schema.json);
[schemas/verified-stay-offer-v1.0.schema.json](../../schemas/verified-stay-offer-v1.0.schema.json);
[schemas/verified-stay-offer-verification-result-v1.0.schema.json](../../schemas/verified-stay-offer-verification-result-v1.0.schema.json);
[examples/conformance/offer/](../../examples/conformance/offer/);
[docs/implementation-report-1.0.md](../implementation-report-1.0.md);
[GOVERNANCE.md](../../GOVERNANCE.md) §4, §5; [ADR 0002](0002-no-gatekeeper-trust-and-interop.md);
[ADR 0013](0013-vrp-1-0.md).

This record is substantive (GOVERNANCE.md §4): it changes what a verifier
accepts. It is not reviewed or merged on its own: it is part of the 1.0
record's pull request and comes into force with [ADR 0013](0013-vrp-1-0.md),
under that record's review period and approvals. The conformance vectors it
requires land in the same pull request (§4, conformance-gated).

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

So the operation is unchanged; its registered name is. VRP v0.1 pins the old
name in five places: `spec/v0.1.md` §3 (`alg`: `EdDSA`) and §5 ("compact JWS
using EdDSA"), the JWKS schema (`"const": "EdDSA"`), the offer schema
(`signature.alg`, `"const": "EdDSA"`) and the verification-result schema
(`signature.alg`). Every shipped verifier checks the string, read and run on
2026-11-13: `@vacationrentalprotocol/vrp-verify` 0.3.0 (`src/jws.js:50` at
`db7b905`), the reference verifier in `hemmabo-mcp-server` 7.1.0
(`lib/vrp.ts:17` and `:333` at `7199356`), and the independent verifier
(`src/verifier.mjs:23–24` at `bc959ba`). Every node signs with it: all three
nodes send the header `alg: EdDSA` and publish a key with `alg: EdDSA`
(measured 2026-11-13 10:26 UTC, implementation report). A node that moved to
the new name today would fail every shipped verifier; a standard that kept
only the old name would carry a name its registry marks Deprecated into 1.0.

## Decision

**D1. Two names, one operation.** In the 1.0 text, `spec/v1.0.md` §3 and §5,
`alg` is `Ed25519` or `EdDSA`. A verifier MUST accept either when the key is
`kty: OKP`, `crv: Ed25519`; the key's `crv` decides the operation, never the
name alone. The names are compared as written (RFC 7515 §4.1.1: `alg` is
case-sensitive). A JWS with any other `alg` is unverifiable (§9). The name in
the JWS header and the name on the key need not be the same one of the two.
`spec/v0.1.md` is not changed: it names `EdDSA` only, as before.

**D2. Nodes.** A node MAY sign with either name. Nothing changes for a node
that signs `EdDSA` today; no key is rotated, no offer is re-signed. A node
SHOULD move to `Ed25519` once the verifiers it relies on accept it (D5); the
standard sets no date.

**D3. Schemas.** The 1.0 editions `jwks-v1.0.schema.json`,
`verified-stay-offer-v1.0.schema.json` and
`verified-stay-offer-verification-result-v1.0.schema.json` have
`"enum": ["Ed25519", "EdDSA"]` where the v0.1 editions have
`"const": "EdDSA"`. The v0.1 schemas are not changed.

**D4. Vectors.** Seven signed-offer vectors about the algorithm name land
with the 1.0 record: `06-alg-ed25519-valid-fresh` and
`10-alg-ed25519-protocol-version-0-1-valid-fresh` (a header that says
`Ed25519` verifies, under either version string),
`11-alg-ed25519-jwk-alg-ed25519-valid-fresh` and
`12-alg-eddsa-jwk-alg-ed25519-valid-fresh` (a key that names its `alg`
`Ed25519` verifies a header with either name), and three that a verifier MUST
refuse as `unexpected_alg` before any cryptographic check:
`07-alg-unexpected` (`ES256`), `13-alg-none` (`none`, empty signature) and
`14-alg-wrong-case` (`ed25519`). Vectors 01–05, the v0.1 corpus, are
byte-identical, keep `EdDSA` and still verify. The repository's own verifier
(`scripts/conformance.mjs`) and the site verifier (`verify.html`) accept both
names in the same pull request, so the vectors pass where they are published.
`npm test` fails if the corpus loses its accepting vector for any of the four
combinations of version string and algorithm name.

**D5. The verifiers follow in their own repositories, verifiers before
nodes.** `@vacationrentalprotocol/vrp-verify` accepts both names in a MINOR
release; the reference verifier does the same; only then do the reference
nodes change the name they sign with, measured before and after; the
independent node moves at its operator's pace, or not at all.

**D6. Scope.** This record changes the 1.0 candidate only: `spec/v1.0.md`
and the three 1.0 schemas in D3. Core v0.1 (`spec/v0.1.md` and every
`*-v0.1.schema.json`) is unchanged. Receipt v1, Portable Attestations v0.1,
the Transparency Log v0.1 and the Node Tool Binding proposal name `EdDSA` in
their own text and keep it until each is changed by its own record. No registration changes: `Ed25519` is already in the IANA
JOSE registry by RFC 9864, and VRP's own IANA entry (`vacation-rental.json`)
does not mention the algorithm.

**D7. Version class.** The cryptographic suite is unchanged (Ed25519); the
acceptance rule gains a second name for the same suite, and nothing a
verifier accepted before is refused after. When this record was proposed
(2026-11-04) it classified the change as a backward-compatible addition
(GOVERNANCE.md §5, MINOR class) inside the v0.1 public draft, and left the
other reading open: GOVERNANCE.md §5 reserves changes to "the rules a verifier
uses to accept an offer" for a MAJOR version. The maintainers took that
reading (ADR 0013 D4). The change therefore ships with the 1.0 text and
leaves v0.1 as it is; D1, D3 and D6 name the 1.0 files for that reason.

**D8. Evidence, as measured on 2026-11-13.** The rule "a verifier MUST accept
`Ed25519`" has no shipped implementation yet. The three shipped verifiers
refuse vector 06: `hemmabo-mcp-server` 7.1.0 ("Unsupported JWS alg: Ed25519"),
`@vacationrentalprotocol/vrp-verify` 0.3.0 (`unexpected_alg`) and the
independent verifier (`wrong_key`). The two that accept it are this
repository's own (`scripts/conformance.mjs`, `verify.html`). No node signs
with `Ed25519`. That is the order D5 sets, verifiers before nodes; it is not
evidence of two independent implementations, and this record does not claim
any. The implementation report lists the rule as *evidence outstanding*, and
ADR 0013 D9 names what must be measured before 1.0 is live.

## Consequences

- No node breaks: `EdDSA` stays valid everywhere. No key, offer, JWKS or
  endpoint changes on any node because of this record.
- 1.0 is not locked to a name the IANA registry marks Deprecated.
- A verifier that follows the standard needs one more string comparison and
  nothing else; the key selection by `kid` and the Ed25519 check are
  unchanged.
- Until D5 has run, a node that signs `Ed25519` fails the published verifiers
  that still pin `EdDSA`. That is why D2 says MAY and D5 puts verifiers first.
- The 1.0 JWKS schema accepts a key whose `alg` is `Ed25519`; a JWKS mixing
  both names across keys is valid. The v0.1 JWKS schema still refuses it.
- Neutrality: the rule applies to every operator equally (ADR 0002); it names
  no implementation, and the reference nodes change last, not first.
