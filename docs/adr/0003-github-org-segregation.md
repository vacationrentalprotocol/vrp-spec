# ADR 0003: GitHub Organization Segregation and Standard-vs-Implementation Separation

**Status:** Accepted
**Date:** 2026-08-16 (proposed) · 2026-08-17 (accepted)

## Context

VRP's specification text, conformance vectors, and JSON Schemas are the standard. HemmaBo is a reference implementation and a standards contributor, not the owner of truth (ADR 0001, ADR 0002).

Until 2026-08-16, the specification repository lived under an individual GitHub account that also holds HemmaBo product repositories. That namespace made the standard read as a product artifact of one operator, which is in tension with the neutrality the protocol asserts: the host-owned domain is the source of truth, verification is decentralized, and no operator is a central issuer, registry, or trust authority.

Comparable open standards keep their source in a neutral organization namespace rather than an individual or product account — for example WHATWG, W3C, the JSON Schema organization, and the OpenAPI Initiative. A standard becomes credible as a standard, in part, by not being owned by the namespace of one of its implementers.

The canonical standards home is the domain `vacationrentalprotocol.com`. That does not change. This decision concerns only the source namespace and the governance around it.

## Decision

VRP source will live in a neutral GitHub organization, `vacationrentalprotocol`, whose name mirrors the canonical domain. The organization is separate from any single implementer's product account.

**Namespace, not a change of people.** Neutrality is achieved through the repository namespace (`github.com/vacationrentalprotocol/...`), not by changing who maintains the work. Organization ownership is transferable to a further-neutral account later through organization settings alone, without a repository migration. This is not a one-way door.

**Two-owner governance from the start.** The organization begins with two owners so that maintenance does not depend on a single person. Maintainers are recorded in `MAINTAINERS.md`. This meets the widely recommended practice of at least two owners for a standards organization. Adding or changing owners is an organization-settings operation and does not affect the specification.

**Neutrality is conformance-via-vectors.** Conformance to VRP is established against the published specification and the signed, runnable conformance vectors — never against the HemmaBo reference node. The editor and maintainers are bound by the no-gatekeeper rules of ADR 0002: VRP MUST NOT require HemmaBo, or any operator, as issuer, verifier, registry, scorer, booking intermediary, or trust authority. A reference implementation demonstrates the standard; it does not define it.

**Canonicalization of repository references.** Repository references throughout the corpus — README, source pack, IETF draft, sitemap, generator constants, and related documents — are updated to `vacationrentalprotocol/vrp-spec`. The canonical domain remains `vacationrentalprotocol.com`; defensive domains such as `.net` and `.org` 301-redirect to `.com` and are never canonical.

**Operational continuity.** The public site at `vacationrentalprotocol.com` is built from this repository by a hosting provider on push. The hosting project and its Git integration are re-pointed to the new organization so that deployments continue after the transfer.

**Versioning as a governance commitment.** VRP 1.0 is earned, not declared. 1.0 is locked only when the wire format is frozen and at least one independent implementation interoperates. Within a MAJOR version, signature semantics and verification rules MUST NOT change in breaking ways. This commitment is recorded in `GOVERNANCE.md`.

The migration proceeds as an ordered sequence: (S1) create the organization; (S2) establish two owners; (S3) install the hosting Git app on the organization before transfer; (S4) transfer the repository; (S5) verify the transfer and that the old paths redirect; (S6) land the governance documents and commit this ADR.

## Consequences

The standard's source namespace no longer reads as one implementer's product path, reinforcing the neutrality asserted by ADR 0001 and ADR 0002. The change is structural and reversible only in the direction of more neutrality: ownership can move to a further-neutral account without touching the repository.

GitHub sets automatic redirects on transfer, so existing links to the old namespace continue to resolve; canonicalizing the references removes the residual product-branded path from published text.

The transfer resets some repository and integration state that must be re-established explicitly — notably the hosting provider's deploy trigger. This is a one-time operational cost rather than an ongoing one.

Separation is the first of three steps toward 1.0. The remaining steps are independent of the namespace: a second, independent node — an implementation that is not the reference runtime — and a frozen wire format. Only then is 1.0 a stability promise the project can honestly make.

## Addendum (2026-08-17, at acceptance)

The migration described above was executed on 2026-08-16 and 2026-08-17:

- The repository is now `vacationrentalprotocol/vrp-spec`, owned by the
  organization; the previous path 301-redirects to it.
- Repository references were canonicalized to the new path across the corpus.
- The hosting project was re-pointed to the new organization, and its deploy
  trigger — which the transfer had reset — was reconnected.

This addendum introduces no normative changes.
