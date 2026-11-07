# ADR 0018: Peers, an Experimental Way for Nodes to Name Other Nodes

**Status:** Proposed
**Date:** 2026-11-07 (proposed)

**Related:** [spec/peers-v0.1.md](../../spec/peers-v0.1.md),
[ADR 0002](0002-no-gatekeeper-trust-and-interop.md),
[GOVERNANCE.md](../../GOVERNANCE.md) §2, §4, §5,
[StayIntent Discovery v0.1](../../spec/stayintent-discovery-v0.1.md).

## Context

Core v0.1 says how an agent verifies a node whose domain it already knows, and
forbids making that depend on a central list: "Verification MUST NOT require
HemmaBo, a VRP-operated trusted issuer registry, a host accreditation program,
a certification company, or a central discovery index" (`spec/v0.1.md` §1). It
does not say how an agent that knows one node can find another. StayIntent
Discovery v0.1 answers a stay request with pointers and lets anyone run an
index ("No index is privileged", §2), but an index, too, has to learn which
nodes exist.

So today every way from one node to the next is a list someone keeps. Whoever
keeps the only list everyone starts from stands in the middle, whatever the
specification says. GOVERNANCE.md §2 lists a "central discovery index" among
the things VRP must not require as a precondition for verification.

Measured 2026-11-07, GET `/.well-known/vacation-rental.json` on the three VRP
nodes known to the maintainers: `villaakerlyckan.se` (16:03:54 UTC, 44
top-level members), `apartmamatevz.si` (16:08:57 UTC, 8) and `lakeviewhome.se`
(16:08:59 UTC, 42). None has a member named `peers`, and none names either of
the other two. The two nodes in [IMPLEMENTATIONS.md](../../IMPLEMENTATIONS.md) are two of
the three.

Two rules already in force let a node add a member without touching Core.
Well-Known URI v0.1 §3: "Clients **MUST** ignore unknown fields and **MUST**
treat the document as advisory metadata only". The Core discovery schema
(`schemas/discovery-v0.1.schema.json`) has no `additionalProperties`, so an
extra member is valid against it.

## Decision

**D1. A separate, experimental document.** `spec/peers-v0.1.md`, status
Experimental, defines one optional member of the discovery document, `peers`,
with its own schema `schemas/peers-v0.1.schema.json`. Core v0.1, the
Well-Known URI document, the Core discovery schema and every rule a verifier
uses to accept an offer stay as they are. Nothing in the document is part of
Core conformance.

**D2. Domains only.** `peers` has three members: `spec` (the identifier of this
version), `nodes` (zero to 100 domains) and an optional `updated_at`. An entry
is a domain written as Core §2 writes `canonical_domain`, meets Core §2's
host-owned domain rule, and is not the listing node's own domain. Nothing else
about a node may appear: no name, URL, price, distance, score or category.

**D3. No order.** Entries appear once each, in ascending code-point order, and a
client treats them as a set. An order anyone can recompute leaves no first
place to sell or to read as a recommendation.

**D4. No trust.** An entry is not a trust relation, endorsement, partnership or
rating, and is not reciprocal. A client reaches a listed domain by building
`https://{domain}/.well-known/vacation-rental.json` itself and checking the
document under Core §2 for that domain; until then the domain is not a node.
Quoting anything still requires Core §3–§9.

**D5. Bounded walks.** A client that follows peers bounds depth, fetches and
time (RECOMMENDED 3, 100, 10 seconds per fetch), fetches each domain once,
follows only nodes it has reached, connects to no non-public address, honours
`Retry-After`, never presents a walk stopped by a limit as complete, and never
ranks the result.

**D6. No seed, no registry.** The document names no starting node or list, and
no starting point is privileged. A node that lists no one, and that no one
lists, is still a node.

**D7. No signature on the list in v0.1.** A list can only point at domains that
must then prove themselves (D4). A signature would not change what a client may
conclude, and would add key handling.

**D8. Conformance.** `examples/conformance/peers/negative.v0.1.json` (29 cases:
members a client ignores in full and entries it skips, each with its name, and
three valid controls) and `positive.v0.1.json` (a five-domain network, six
walks, each run twice with the entries in reverse order to show the result does
not depend on it), checked offline by `scripts/verify-peers.mjs` in `npm test`.
`scripts/validate-artifacts.mjs` checks every member in the vectors against the
peers schema and every document in the network against the unchanged Core
discovery schema; its schema checker gains `maxItems` and `uniqueItems`.

**D9. Leaving Experimental.** The document becomes a public draft by a later
ADR, when two independent implementations publish `peers` and a walk that
starts at a node of one reaches a node of the other and back, with no code or
data of either in the other's path.

## Consequences

- **Version class.** Additive. No Core requirement changes, no schema a Core
  verifier reads changes, and nothing a verifier accepts or rejects changes. A
  v0.1 client ignores `peers` (Well-Known URI §3). Known nodes affected: none
  (none publishes a member named `peers`, measured above).
- **Not part of 1.0.** The document is outside Core and outside the Well-Known
  URI document, the two documents the proposed 1.0 record names as its scope
  (ADR 0013 D1, pull request #187, not accepted). Accepting this record neither
  waits for nor delays that one.
- **Substantive** under GOVERNANCE.md §4: it adds normative text and a schema.
  This record, at least seven days of review with no maintainer objecting, and
  two approvals, since two maintainers are active. If ADR 0014 and ADR 0015
  (pull request #182) are accepted first, one approval comes from a maintainer
  independent of the author, and the period for specification text, schemas
  and vectors is 28 days.
- **Neutrality** (GOVERNANCE.md §2, ADR 0002): no list is required, no list is
  privileged, every listed node proves itself on its own domain, and the rules
  bind every publisher and client alike, the reference implementation
  included. The document names no implementation.
- **Implementations follow in their own repositories,** after acceptance. This
  repository holds the text, the schema and the vectors; a live walk across
  independent nodes is the evidence D9 asks for.

## Open questions for review

1. The default depth: 3 here; the CM AI Docking Port's `limits_default` uses
   `max_depth` 2 ([interop note](../interop/cm-ai-docking-port.md)).
2. The cap of 100 entries per node.
3. Whether ascending order (D3) should stay a requirement or become a
   recommendation.
4. Whether `updated_at` earns its place, or HTTP caching suffices.
5. Whether a later version signs the list (D7).
