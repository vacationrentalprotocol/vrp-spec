# ADR 0015: Review Period for Substantive Changes

**Status:** Proposed
**Date:** 2026-11-04 (proposed)

**Related:** [GOVERNANCE.md](../../GOVERNANCE.md) §4, §5, §12,
[ADR 0014](0014-independent-approval.md), [ADR 0016](0016-shared-custody.md).

This record is itself a substantive change (GOVERNANCE.md §12). It is in force
only after at least seven days of review with no maintainer objecting and
approval from two maintainers on its current head, and after it is merged. The
28-day period below is a proposal until then; the period in force today is
seven days (§4).

## Context

GOVERNANCE.md §4 sets "a review period of at least seven days" for every
substantive change (read at `5db83f4`, line 77). The same period applies to a
clarification of one schema field and to the record that would declare 1.0.

The standards bodies VRP measures itself against use longer periods for text
that others implement. The W3C Process Document (18 August 2025, §6.3.7, read
2026-11-04) requires "the Candidate Recommendation review period, which must be
at least 28 days after publication, and should be longer for complex documents",
and lets a group "identify features in the document as at risk" that "may be
removed before advancement to Recommendation". RFC 6410 §2.2 (read 2026-11-04)
sets "an IETF-wide Last Call of at least four weeks" for advancement to
Internet Standard. Seven days is enough for the maintainers to read a change; it
is not enough for an implementer who reads the repository once a month.

Pull request #178 (ADR 0013, the 1.0 record) was marked ready for review on
2026-11-01 10:25:43 UTC and converted back to draft on 2026-11-02 14:44:23 UTC
(read from its timeline). Nothing in the rule would have stopped it from being
merged on 2026-11-08 with both approvals from inside one organization (ADR 0014)
and before any outside implementer had seen it.

## Decision

**D1. Two periods.** The review period of GOVERNANCE.md §4 is:

- **28 days** for a substantive change to the specification text, a schema,
  the JSON-LD context or terms, or the conformance vectors (the artifacts
  §1 names), and for a change to GOVERNANCE.md itself (§12);
- **7 days**, as today, for every other substantive change: an ADR that
  records a decision without changing those artifacts, a security correction
  under §5 "Before 1.0", and a change to the verifier the organization
  publishes (ADR 0016).

**D2. Start and restart.** The period runs from the moment the change is
marked ready for review. It starts again when the change is converted to draft
and back, or when its head changes other than by merging `main` into it.

**D3. At risk.** A substantive change to the specification MAY mark a part of
the text "at risk". A part marked at risk MAY be removed before merge without
restarting the period; any other change restarts it (D2).

**D4. Security corrections.** A correction that closes a security gap under
§5 "Before 1.0" keeps the 7-day period and, where the gap is being exploited,
MAY be merged earlier by two approvals under ADR 0014 with the reason recorded
in its ADR. The seven days then run after merge, and an objection in that time
reverts the change.

**D5. GOVERNANCE.md text.** On acceptance, §4's bullet "Substantive changes"
replaces "a review period of at least seven days" with "the review period ADR
0015 sets: 28 days for the specification, schemas, context, vectors and this
document, seven days for every other substantive change".

## Consequences

- The record that declares 1.0 (ADR 0013, draft) is a change to the
  specification text and its schemas, so it is reviewed for 28 days once this
  record is in force, counted from its next "ready for review".
- An implementer who reads the repository monthly sees every change to the
  wire format before it is merged.
- A security correction is not slowed: D4 keeps seven days and allows an
  earlier merge when a gap is being exploited.
- The maintainers' own records (an ADR that changes no artifact) keep seven
  days, so the project's bookkeeping does not wait a month.
- Neutrality: the periods apply to every author equally, the reference
  implementer included (ADR 0002).
