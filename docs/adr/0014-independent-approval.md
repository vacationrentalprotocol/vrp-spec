# ADR 0014: Independent Approval of Substantive Changes

**Status:** Proposed
**Date:** 2026-11-04 (proposed)

**Related:** [GOVERNANCE.md](../../GOVERNANCE.md) §4, §8, §12,
[MAINTAINERS.md](../../MAINTAINERS.md), [ADR 0002](0002-no-gatekeeper-trust-and-interop.md),
[ADR 0003](0003-github-org-segregation.md), [ADR 0015](0015-review-period.md),
[ADR 0016](0016-shared-custody.md).

This record is itself a substantive change (GOVERNANCE.md §12). It is in force
only after at least seven days of review with no maintainer objecting and
approval from two maintainers on its current head, and after it is merged
(§4). Until then GOVERNANCE.md as it reads on `main` governs, and nothing in
this record applies.

## Context

GOVERNANCE.md §4 requires, once two maintainers are active, "approval from two
maintainers" for a substantive change (read at `5db83f4`, lines 81–86). It does
not say which two. MAINTAINERS.md discloses that the lead maintainer and the
project-continuity maintainer "are not independent of each other" (lines
30–32), and that the third maintainer, an independent implementer, was added on
2026-10-23. Under the text as written, a substantive change can therefore be
approved by two maintainers who are not independent of each other, and merged
by one of them.

The rule applies to every substantive change, including one that would weaken
Core v0.1 §2 (a node is a domain registered for the host, never a name under
another party's domain). The rule as written does not protect that section, or
any other, against a change approved inside one organization.

This is the pattern the larger standards bodies avoid. RFC 6410 §2.2 (read
2026-11-04): a document advances "in an IETF-wide Last Call of at least four
weeks" confirmed by the IESG, not by its authors, and only when "there are at
least two independent interoperating implementations". The W3C Process Document
(18 August 2025, §6.3.2, read 2026-11-04) asks, before a specification advances,
"are there implementations created by people other than the authors of the
specification?". In both, someone other than the author has to say yes.

The practice has been better than the text: pull request #178 (ADR 0013) was
approved by the independent maintainer on 2026-11-01 11:26:27 UTC and by the
continuity maintainer on 2026-11-02 06:00:50 UTC (read from the pull request's
timeline). This record writes that practice into the rule, so that it holds
whoever is at the table.

## Decision

**D1. One independent approval.** Of the two approvals GOVERNANCE.md §4
requires for a substantive change, at least one MUST come from a maintainer
who is independent of the change's author. The author's own approval never
counts toward the two.

**D2. Independence.** Two maintainers are independent of each other when
neither is employed by, contracted to, an owner of, or a family member of the
other or of the other's organization. MAINTAINERS.md records, for each
maintainer, the organizations and maintainers they are not independent of, as
it does today in its "Disclosure" section. A maintainer who is unsure declares
the relationship; a declared relationship counts as non-independence.

**D3. Merge.** The maintainer who merges a substantive change MUST be one of
its approvers or the lead maintainer, and MUST NOT merge before the review
period of §4 has run from the last "ready for review" and both approvals are
on the current head. A change that is converted to draft, or whose head
changes, starts its review period again.

**D4. When no independent maintainer is available.** If no maintainer
independent of the author is active (GOVERNANCE.md §8), a substantive change
waits. It is not approved by two non-independent maintainers in the meantime.
Restoring an independent maintainer follows §8.

**D5. GOVERNANCE.md text.** On acceptance, §4's bullet "Two approvals once two
maintainers are active" gains the sentence: "At least one of the two approvals
comes from a maintainer independent of the change's author, as ADR 0014
defines independence; the author's own approval does not count." §12 is
unchanged.

## Consequences

- No substantive change, including a change to Core v0.1 §2, can be approved
  inside one organization. This holds for the reference implementer as for any
  other operator (ADR 0002): the rule names no company and favours none.
- The lead maintainer keeps the merge and the editorial role; what changes is
  who must have said yes first.
- The project depends on having at least one independent maintainer active.
  That is the state since 2026-10-23 (MAINTAINERS.md). GOVERNANCE.md §8 is the
  path to more.
- Editorial and non-breaking changes are unchanged (GOVERNANCE.md §4): one
  maintainer approves and merges, and that maintainer may be the change's
  author.
- This record, ADR 0015 and ADR 0016 are approved under the rule they describe:
  the independent maintainer's approval is one of the two for each of them.
