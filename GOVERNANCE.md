# Governance

**Status:** In force since 2026-08-18 · pre-1.0. This document is active and
evolves with the standard under §12.

This document defines how the Vacation Rental Protocol (VRP) specification is
governed: who may change it, how decisions are made, and the commitments that
keep the standard neutral, stable, and independent of any single operator.

It complements two decisions that already bind the project: the no-gatekeeper
trust model in [docs/adr/0002-no-gatekeeper-trust-and-interop.md](docs/adr/0002-no-gatekeeper-trust-and-interop.md),
and the separation of the standard from any implementation, maintained as a
neutral GitHub organization. Where this document and an accepted ADR disagree,
the ADR governs and this document is corrected.

## 1. Scope

Governance covers the artifacts in this repository that constitute the standard:
the specification text, the JSON Schemas, the conformance vectors, the JSON-LD
context and terms, and the supporting documentation and ADRs.

It does **not** govern any implementation. Implementations — including the
HemmaBo reference implementation and the reference node `villaakerlyckan.se` —
are independent projects. Per ADR 0002, VRP verification never requires them,
and no implementation gains authority over the standard by existing.

## 2. Guiding principles

These principles are load-bearing. They may be refined but not reversed without
a MAJOR version and maintainer consensus (§4, §5):

- **Host-owned domains are the source of truth.** Verification resolves to the
  host domain's published artifacts and keys, never to a marketplace mirror.
- **No gatekeeper.** VRP must not require a central issuer, trusted-issuer
  registry, accreditation program, certification company, or central discovery
  index as a precondition for verification. Relying parties choose their own
  trust policy (ADR 0002).
- **Neutrality.** The standard is not owned by, branded as, or steered for any
  single operator. Contributions are judged on technical merit and fidelity to
  these principles.
- **Agents fail closed.** Offers are quotable only when signed, fresh, exact,
  and permitted; anything else is treated as unverifiable.

## 3. Roles

- **Maintainers** steward the specification. They review and merge changes, cut
  releases, safeguard neutrality and security, and represent the project in
  external standards work. The current maintainers, and their areas, are listed
  in [MAINTAINERS.md](MAINTAINERS.md).
- **Contributors** are anyone who proposes a change through an issue or pull
  request. No affiliation, employer, or credential is required to contribute.

**Continuity.** One maintainer holds the *project-continuity* role
([MAINTAINERS.md](MAINTAINERS.md)): keeping the standard maintained — releases,
security response, and control of the project's domains, repositories, and
release process — if the lead maintainer becomes unavailable. The continuity
maintainer may add maintainers under §8 to restore active stewardship. (VRP has
no central signing keys; each node holds its own — see §2.)

## 4. Decision-making

The project runs on **lazy consensus**: silence is assent, and objections are
resolved by discussion rather than by vote.

- **Editorial and non-breaking changes** (typo fixes, clarifications, additive
  examples, backward-compatible additions) may be approved and merged by a
  single maintainer.
- **Substantive changes** — anything that alters a normative requirement, the
  signing or verification semantics, a schema, the trust model, or these
  guiding principles — must be recorded as an Architecture Decision Record in
  [docs/adr/](docs/adr/) and require **consensus of the maintainers**, meaning
  no maintainer objects after a review period of at least seven days.
- **No consensus means no change.** If maintainers do not converge, the status
  quo stands. This deliberately biases the standard toward stability and against
  capture.
- **Two approvals once two maintainers are active.** While the project has a
  single active maintainer, that maintainer approves. As soon as a second
  maintainer is active, a substantive change needs approval from two
  maintainers. (An independent implementation on the path to 1.0 (§5) is a
  likely occasion for a second maintainer to join, but this rule applies
  whenever two maintainers are active, regardless of implementation count.)
- **Conformance-gated.** A change to a normative requirement or to signing or
  verification semantics is not accepted until it is covered by the conformance
  vectors in this repository (§6).
- **Out of bounds.** A change that would make VRP depend on a central issuer,
  registry, or gatekeeper contradicts ADR 0002 and will not be accepted, regard-
  less of consensus.

Decisions and their rationale live in the ADR log so the reasoning is auditable
long after the discussion has closed.

## 5. Versioning and stability

VRP follows [semantic versioning](https://semver.org):

- **PATCH** — editorial corrections with no normative effect.
- **MINOR** — backward-compatible additions.
- **MAJOR** — a breaking change to a normative requirement or to signing/
  verification semantics. Such changes are never made silently inside a released
  version, and ship with a documented migration path.

**Cryptographic stability.** The signature suite and the rules a verifier uses
to accept an offer or attestation are the most sensitive surface in VRP. They do
not change except through a MAJOR version with an explicit ADR and migration
guidance.

**Path to 1.0.** VRP reaches 1.0 only after at least one independent
implementation exists beyond the reference node — a second signing node proves
VRP is a standard and not a single project's file format. This is a public
commitment, not a target date.

## 6. Conformance

Conformance is demonstrated against the **signed conformance vectors published
in this repository** — positive and negative cases anyone can run offline. It is
not conferred by a VRP-issued mark, a certification body, or maintainer approval.

Any implementer may run the vectors and self-declare conformance. This is the
no-gatekeeper principle applied to testing: the vectors, not a person, are the
authority (ADR 0002).

## 7. Standards track and external registries

VRP is pursued as an open standard and may be advanced through recognized
standards bodies (for example, as an IETF Internet-Draft). When such a process
drives a normative change, the change is mirrored here through the ADR process
in §4; the specification in this repository and the standards-body document are
kept consistent.

Artifacts that are registered externally — media types, `.well-known` URI
suffixes, and similar — follow the registering authority's own process (for
example, IANA). For any such value, the external registry is authoritative;
this repository documents the registration but does not override it.

Participation in adjacent standards efforts is conducted under the neutrality
principle in §2: VRP composes with other protocols (see ADR 0002) without
subordinating the standard to any of them.

## 8. Adding and removing maintainers

The maintainer set is expected to grow. Membership tracks sustained,
good-faith contribution and alignment with the project's neutrality — not
seniority or affiliation.

- **Adding.** An existing maintainer proposes a candidate; the candidate is
  added by consensus of the current maintainers.
- **Stepping down.** A maintainer may resign at any time.
- **Inactivity.** A long-inactive maintainer may be moved to emeritus by
  consensus, preserving credit without implying active stewardship.
- **Succession.** If no maintainer has been active for 90 days, the
  project-continuity maintainer (§3) — or, failing that, any contributor via a
  public issue — may initiate restoration of active maintainership under this
  section, so the standard is never orphaned.

Every change to the maintainer set is reflected in [MAINTAINERS.md](MAINTAINERS.md).

## 9. Code of conduct

Everyone participating in the project — issues, pull requests, reviews, and
external representation — is expected to follow
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## 10. Licensing and intellectual property

The specification text is dedicated to the public domain under **CC0-1.0**
([LICENSE](LICENSE)). The reference code is licensed under **Apache-2.0**
([LICENSE-CODE](LICENSE-CODE)) with a royalty-free patent non-assertion
([PATENTS.md](PATENTS.md)).

Contributions are accepted under these same terms — inbound equals outbound. By
contributing, you affirm you have the right to do so under the applicable
license. See [CONTRIBUTING.md](CONTRIBUTING.md).

## 11. Security

Security process and private vulnerability reporting are described in
[SECURITY.md](SECURITY.md). Do not open a public issue for a suspected
vulnerability.

## 12. Amending this document

Changes to this GOVERNANCE.md are themselves substantive: they follow the ADR
and consensus process in §4. The version of this document in `main` is the one
in force.
