# ADR 0016: Shared Custody of the Standard's Handles

**Status:** Proposed
**Date:** 2026-11-04 (proposed)

**Related:** [GOVERNANCE.md](../../GOVERNANCE.md) §2, §3, §7, §12,
[MAINTAINERS.md](../../MAINTAINERS.md), [ADR 0002](0002-no-gatekeeper-trust-and-interop.md),
[ADR 0003](0003-github-org-segregation.md), [ADR 0014](0014-independent-approval.md),
[ADR 0015](0015-review-period.md).

This record is itself a substantive change (GOVERNANCE.md §12). It is in force
only after at least seven days of review with no maintainer objecting and
approval from two maintainers that counts on its current head (ADR 0014 D3),
and after it is merged. The hand steps in D1–D4 are taken after that, and each
is measured.

## Context

The standard is held by a set of handles outside this repository: the npm
package agents install to verify offers, the GitHub organization, the domain,
and the hosting project that serves the site. Measured 2026-11-04:

- `@vacationrentalprotocol/vrp-verify` on npm has one owner, the account
  `hemmabo` (`npm owner ls`, 09:13:50 UTC). Versions 0.1.1 to 0.2.0 were
  published by the repository's workflow with OIDC trusted publishing and a
  provenance attestation (`.github/workflows/npm-publish.yml` in
  `vacationrentalprotocol/vrp-verify` at `e6eceaa`); 0.1.0 was published by hand
  from that account.
- Pull requests in `vacationrentalprotocol/vrp-spec` and
  `vacationrentalprotocol/vrp-verify` are merged by the account `HemmaBo-se`
  (#180 and #22, read from the repositories).
- The site `vacationrentalprotocol.com` is built from this repository in a
  hosting project that belongs to the reference implementer's team (read from
  the hosting provider's API, 08:51:44 UTC).
- ADR 0003 says the GitHub organization "begins with two owners". The owner
  set is not readable from where this record was written and is to be
  measured by an owner before D2.

ADR 0003 moved the source out of one implementer's namespace so the standard
would not "read as one implementer's product path". The handles above still
do. Whoever holds the only npm owner account can publish a verifier that every
agent installs; whoever holds the only hosting project can change what the
site says. GOVERNANCE.md §2 commits VRP to being "not owned by, branded as, or
steered for any single operator". The commitment is in the text; the handles
are the proof.

## Decision

**D1. npm.** The package `@vacationrentalprotocol/vrp-verify` has at least two
owners who are independent of each other under ADR 0014 D2, both with
two-factor authentication. Viljem Dvojmoč (`@viljemd-hub`), the independent
maintainer in MAINTAINERS.md, is added as an owner. Publishing stays as it is: only the repository's workflow
publishes, through OIDC trusted publishing with provenance; no owner publishes
by hand. The repository setting that disallows token publishing is turned on
where npm offers it. No single organization keeps sole rights to the package.

**D2. GitHub organization.** The organization `vacationrentalprotocol` has at
least two owners who are independent of each other under ADR 0014 D2. Viljem
Dvojmoč (`@viljemd-hub`) is added as an owner. In the repositories
`vrp-spec` and `vrp-verify`, a substantive change merges only with approval
from two maintainers that counts on its current head (ADR 0014 D3), at least
one of them independent of the change's author (ADR 0014 D1), and after its
review period (ADR 0015). An editorial or non-breaking change (GOVERNANCE.md
§4) needs one maintainer, who may be its author. Every change needs passing
checks before merge. Whether an approval given on an earlier head counts is
decided by ADR 0014 D3 and by nothing else. A technical control in the two
repositories is to enforce this, so that ADR 0014 D3 and ADR 0015 D2–D3 hold
in the repository itself.

Until that control is in place, the maintainer who merges checks the
approvals, the approvers' independence and the review period by hand before
every merge, and records the comparison ADR 0014 D3 requires whenever an
approval given on an earlier head is counted. MAINTAINERS.md "Custody" (D5)
records what the two repositories enforce by themselves, as measured, and
when it was last measured.

**D3. Domain.** `vacationrentalprotocol.com` carries a registrar transfer lock
and auto-renewal, and a second named contact who is independent of the
registrant under ADR 0014 D2 is on record at the registrar. The site's hosting
project is either moved to a team named for the standard, with two owners as
in D2, or the reason it stays where it is is recorded in MAINTAINERS.md.

**D4. The verifier follows this governance.** `vacationrentalprotocol/vrp-verify`
is the verifier the organization publishes. Its maintainers are the
maintainers in MAINTAINERS.md; a change to what it accepts or rejects is
reviewed under GOVERNANCE.md §4 with ADR 0014 and the 7-day period of ADR 0015
D1; a release is tagged by a maintainer and published by the workflow (D1).
GOVERNANCE.md §1, which says governance "does not govern any implementation",
gains the sentence: "The verifier the organization publishes,
`vacationrentalprotocol/vrp-verify`, is governed by this document as ADR 0016
sets out; other implementations are not."

**D5. Record.** MAINTAINERS.md gains a section "Custody" that lists, for each
handle in D1–D3, who holds it, with which permission, and when it was last
measured, and, for D2,
whether the approvals, independence and review period are enforced by a
technical control or checked by hand. A change to the
custody of a handle is recorded there in the same pull request that makes it,
or, for a hand step outside the repository, in the next pull request.

## Consequences

- The handles depend less on one person. The npm package and the GitHub
  organization each have at least two owners who are independent of each
  other (D1, D2), the domain has a second named contact at the registrar
  (D3), and MAINTAINERS.md "Custody" records who holds which permission and
  when it was last measured (D5). That is what this record adds to
  GOVERNANCE.md §2: less dependence on one person, and permissions that are
  written down and measured.
- Shared custody is not a technical two-person control. An owner can still act
  alone within the permissions the service gives an owner; GitHub's
  documentation says organization owners "have complete administrative access
  to your organization" (read 2026-11-13). This record does not claim that a
  change to the verifier, the organization or the domain needs two people, and
  it does not promise that a handle is recovered after an owner acts alone or
  an account is lost.
- The reference implementer keeps every role it has: lead maintainer,
  specification editor, security contact, the reference implementation and
  nodes. It gives up sole custody, not a role. HemmaBo retains no sole right
  to any handle covered by this record.
- Shared custody is shared power. It is bounded by the same rules: publishing
  only through the workflow, two approvals before a substantive change
  merges (D2), and GOVERNANCE.md §3
  (the continuity role) and §8 (adding and removing maintainers).
- D1–D3 are hand steps by the account holders. Each is measured after it is
  taken (`npm owner ls`, the organization's people page, the registrar's
  record) and written into MAINTAINERS.md "Custody" (D5). This record is not
  complete until every row there is measured.
- Neutrality: the rule names no company; it applies to whoever holds a handle,
  the reference implementer included (ADR 0002).
