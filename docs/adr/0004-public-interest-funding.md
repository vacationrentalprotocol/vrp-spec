# ADR 0004: Public-Interest Funding for VRP Maintenance

**Status:** Proposed
**Date:** 2026-08-17

## Context

VRP is a young open standard. The specification text is CC0-1.0 (public
domain), the reference code is Apache-2.0 with a royalty-free patent
non-assertion, and the trust model has no central issuer, registry, or
accreditation gatekeeper (ADR 0002). Sustained maintenance — security review,
threat modeling, key-rotation and incident-response documentation, conformance
vectors, and editorial work toward a 1.0 draft — has so far been done without
external funding.

Several public-interest programs fund exactly this kind of open-source
security and open-standards work. Their published criteria differ materially
in stage tolerance: some fund early-stage protocols on merit, others require
demonstrated mass adoption. VRP today has one live reference node, so
stage fit matters as much as thematic fit.

The program facts below were verified against each program's own published
pages on 2026-08-17. Deadlines and windows change; re-verify before acting on
this ADR at a later date.

## Decision

1. **VRP seeks public-interest funding as the neutral VRP project.**
   Applications are made for maintenance of the standard itself —
   specification text, security documentation, conformance tooling, and
   editorial work. No implementation, including the HemmaBo reference
   implementation, is the subject of these applications.

2. **Programs pursued** (facts as verified 2026-08-17):

   - **GitHub Secure Open Source Fund** — rolling applications; a single
     submission is considered for all future program sessions and cannot be
     amended or resubmitted, so it is filed once, deliberately. Funding is
     person-scoped: paid to individual maintainers via GitHub Sponsors. The
     program requires a clear governance structure prior to kick-off.
   - **NLnet Foundation / NGI programmes** — thematic fit is strong: open
     standards are a transversal requirement across NLnet calls, and NLnet
     has previously funded early-stage federated protocols. New calls open
     2026-09-03 and close 2026-11-03.
   - **Alpha-Omega (OpenSSF)** — quarterly open intake; the next submission
     window is 2026-10-01 through 2026-10-31. Alpha-Omega requires an
     OSI-approved open source license: VRP's reference code is Apache-2.0
     (OSI-approved), while the specification text is CC0-1.0 (a public-domain
     dedication rather than an OSI-listed license); eligibility will be
     confirmed with the program before submission.

3. **Programs not pursued:**

   - **Sovereign Tech Fund — deferred, not rejected.** Its published criteria
     exclude VRP at the current stage: it does not finance prototypes, its
     prevalence criterion requires wide use within other technologies, and
     the minimum project cost is EUR 50,000. This decision is revisited when
     the protocol has multiple independent nodes and measurable adoption.
   - **OTF FOSS Sustainability Fund — out of scope.** Its mandate is the
     internet-freedom technology ecosystem (circumvention, anti-censorship,
     secure messaging and their foundational infrastructure). VRP has no
     honest claim to that mandate, independent of whether the fund is open.

4. **Constraints on any funding accepted.** Funding never changes the trust
   model or the governance of the specification:

   - No funder becomes an issuer, registry, scorer, certifier, or any other
     gatekeeper in the sense of ADR 0002, and no funder gains editorial
     control over the specification.
   - Licensing is unchanged: the specification stays CC0-1.0 and the
     reference code stays Apache-2.0.
   - No exclusivity: accepting one program's funding does not preclude
     another's.
   - Accepted funding is disclosed publicly in this repository.

5. **Person-scoped program mechanics do not confer authority.** Where a
   program pays individual maintainers (e.g. via GitHub Sponsors), the
   recipient acts as a maintainer of the project, not as an owner of the
   standard. The no-gatekeeper model of ADR 0002 applies to maintainers and
   funders alike.

6. **No claim of acceptance.** Listing a program here records intent to
   apply. It is not a claim that VRP has been selected, endorsed, or funded
   by any program, and no such claim will be made unless and until it is
   true.

## Consequences

The security documentation set (SECURITY.md, threat model, key rotation,
incident response) and the repository's private vulnerability reporting
channel directly support these applications and are worth maintaining on
their own merits regardless of any funding outcome.

Governance artifacts (governance structure, maintainers file, code of
conduct, code ownership) are a stated precondition for at least one pursued
program and are required repository work before any program kick-off.

Application timing is a maintainer decision per program. In particular, the
GitHub Secure Open Source Fund's single-submission mechanics mean that
application is filed when the project's adoption story is strongest or a
program referral exists, rather than reflexively at the earliest window.

Deferral of the Sovereign Tech Fund creates a concrete external milestone
that aligns with the protocol's own roadmap: multiple independent nodes and
measurable adoption unlock both a stronger standard and a wider funding
surface.

This ADR adds no runtime behavior, no tools, and no changes to any
specification document.
