# ADR 0019: StayIntent: the Endpoint in a Node's Discovery Document, an HTTP Binding, and Pages

**Status:** Proposed
**Date:** 2026-11-07 (proposed)

**Related:** [spec/stayintent-discovery-v0.1.md](../../spec/stayintent-discovery-v0.1.md)
§3.1, §4.4, §10, [ADR 0002](0002-no-gatekeeper-trust-and-interop.md),
[GOVERNANCE.md](../../GOVERNANCE.md) §2, §4, §5. Independent of ADR 0018
(`peers`, pull request #190): neither record needs the other.

## Context

StayIntent Discovery v0.1 defines what an agent asks an index (§3) and what the
index answers (§4): deterministic matching, pointers only, no price, no ranking,
"No index is privileged" (§2). It does not define three things an agent needs
to use it:

1. **Where an index is.** Nothing in the document, in Core v0.1 or in a node's
   discovery document says where a StayIntent query can be sent. An agent that
   knows a node cannot find an index that covers it; it has to know the index
   in advance, which is the catalog the document set out to avoid.
2. **How to send the query.** The document defines the JSON of the query and
   the response and no transport: no method, no media type, no error answers.
3. **A result that does not fit in one answer.** The document sets no cap on
   `nodes[]` and says nothing about pages. An index with five hundred matches
   either answers with all of them or chooses which to answer with, and a
   choice of twenty out of five hundred is a ranking whatever the index calls
   it. The rule that order carries no meaning (§4.2) does not help a client
   that only ever sees the first twenty.

Measured 2026-11-07, GET `/.well-known/vacation-rental.json`: `villaakerlyckan.se`
(16:03:54 UTC) and `lakeviewhome.se` (16:08:59 UTC) serve an `endpoints` object
with eighteen members and none named `stayintent`; `apartmamatevz.si`
(16:08:57 UTC) serves no `endpoints` member. No known node names an index.

Two rules already in force carry the change without touching Core: Well-Known
URI v0.1 §3 ("Clients **MUST** ignore unknown fields"), and the Core discovery
schema, whose `endpoints` is an open object (`schemas/discovery-v0.1.schema.json`).
The StayIntent schemas are not read by any Core verifier.

## Decision

**D1. `endpoints.stayintent` (§10).** A node MAY name a StayIntent index in its
discovery document under `endpoints.stayintent`: an absolute `https` URL without
userinfo, on any domain. It names *an* index that answers for the node, not
*the* index; any number of indexes may cover the same node, a client may use
any, and the named index's answer has no more authority than another's. A node
MUST NOT name an index that does not answer for it, which is testable. The
Core discovery schema does not change.

**D2. Open to any client (§10).** An index named in a discovery document MUST
answer without authentication or registration; it MAY rate-limit. A public
pointer to a gated index would make the gate the catalog.

**D3. HTTP binding (§10.1).** `POST` with `Content-Type: application/json`,
the query as the body; `200` with the response as the body; `400` for a body
that is not a query or a cursor the index does not recognise; `429` or `503`
with `Retry-After`, which the client MUST honour. The query carries no personal
data; an index MUST NOT require any, and MUST NOT keep queries against an
identity beyond what rate limiting needs. No other method in this version.

**D4. Pages (§3.1, §4.4).** A response MAY carry `next_cursor` (opaque, 1 to
1024 characters); the client repeats the identical query with `cursor` set to
it. A chain (a first page and every page its cursors reach) holds every match
as of its first page, each node at most once, in ascending code-point order of
`canonical_domain`. No empty page carries a cursor; the last page may be empty.
`match` describes the chain. A response MAY carry `match_count`, the number of
nodes in the chain, the same on every page that carries it.

**D5. The client's duty (§4.4).** A client MUST NOT present what it has read as
all the matches while the last page carried `next_cursor`. A client that reads
one page has read the alphabetically first matches, not the best, and says so.

**D6. Why ascending domain.** Paging needs an order, and any order an index
chooses is the index's choice. Ascending `canonical_domain` is the one order a
client can recompute, no index can sell, and §4.2 already names as the internal
order implementations use. It carries no meaning, within a page or across a
chain, exactly as before.

**D7. Schemas and vectors.** `stayintent-query-v0.1.schema.json` gains the
optional `cursor`; `stayintent-response-v0.1.schema.json` gains the optional
`next_cursor` and `match_count`. Both schemas keep `additionalProperties: false`,
so a response that carries anything else is still invalid.
`examples/conformance/stayintent/pages.v0.1.json` (18 chains, 4 of them
controls, and 7 endpoint values) is checked offline by
`scripts/verify-stayintent-pages.mjs` in `npm test`.
`scripts/validate-artifacts.mjs` now checks every StayIntent vector against the
StayIntent schemas, which it did not before, and applies an
`additionalProperties` schema to the members it governs (the response schema's
`trust_summary` had one that was never enforced).

**D8. At risk.** Three parts may change or go on implementation evidence
without this record being withdrawn: ascending domain as the chain order (the
requirement that the order is one anyone can recompute stays), `match_count`,
and the no-authentication rule of D2. Any other change to the normative text is
a new proposal under GOVERNANCE.md §4 (and restarts the period under ADR 0015
D2–D3, once accepted).

## Alternatives considered

- **Put the endpoint in Core §2.** Rejected: Core is the 1.0 candidate's scope
  (ADR 0013 D1, #187), and the endpoint belongs to the document that defines
  the query. `endpoints` is already open; no Core text or schema needs to
  change.
- **Require the index on the node's own domain.** Rejected: an index covers
  many nodes, and the software that runs a node often runs the index. A
  per-node index on the node's domain is allowed, not required.
- **A list of indexes instead of one URL.** Open (see below). One URL is the
  minimum that makes a node reachable through an index; the text already says
  any number of indexes may cover a node.
- **`GET` with the query in the URL.** Not in this version: the query is nested
  JSON, and one method is enough to interoperate. A later version may add it.
- **Offset paging (`page=3`).** Rejected: offsets shift when matches change
  between requests, and "page 1" invites the reading that it is the best page.
  A cursor with a fixed, recomputable order does neither.
- **Let the index choose the order of pages.** Rejected: that is the ranking
  the document forbids, moved one level up.
- **No paging; require every match in one response.** Rejected: an index with
  thousands of matches would answer with thousands of nodes or silently cap
  them; the cap is the problem this record removes.

## Consequences

- **Version class.** Additive within the StayIntent draft: a query without
  `cursor` and a response without `next_cursor` mean what they meant before,
  and an index that does not page is unchanged (a single page is a chain of
  one). Known nodes affected: none (none names an index, measured above).
  Core v0.1, the Well-Known URI document and every schema a Core verifier reads
  are unchanged; nothing a verifier accepts changes.
- **Not part of 1.0.** StayIntent stays a 0.x draft outside the proposed 1.0
  scope (ADR 0013 D1); this record neither waits for nor delays that one.
- **Substantive** under GOVERNANCE.md §4: normative text and two schemas. At
  least seven days of review with no maintainer objecting and two approvals,
  as §4 requires since 2026-10-23 ([MAINTAINERS.md](../../MAINTAINERS.md)). If
  ADR 0014 and ADR 0015 (#182) are accepted first, one approval comes from a
  maintainer independent of the author and the period is 28 days.
- **Neutrality** (GOVERNANCE.md §2, ADR 0002): no index is required or
  privileged, the index a node names has no more standing than another, the
  order of pages is nobody's choice, and the rules bind every index alike, the
  reference implementation's included. The normative text names no
  implementation.
- **Implementations follow in their own repositories,** after acceptance: a
  node that names its index, an index that pages, a client that reads chains.
  An index that lets a client read every match without an account, and a node
  that names it, are what §10's test needs.

## Open questions for review

1. Whether a node may name more than one index (an array), or one is enough
   when any index may cover any node.
2. Whether `match_count` earns its place (at risk, D8).
3. Whether a `GET` binding is wanted for cacheability.
4. The no-authentication rule (D2, at risk): whether rate limiting alone is
   enough protection for an index operator.
5. Whether a page-size hint from the client is useful, or the index's choice
   suffices.
