# VRP Peers — Specification v0.1

**Status:** Experimental — an optional extension outside VRP Core
([ADR 0018](../docs/adr/0018-peers-experimental.md), proposed). Nothing in this
document is part of Core conformance: a node that publishes no `peers` member,
and a client that ignores one, conform to Core v0.1 exactly as before. The
requirements below bind only an implementation that chooses to publish or to
follow `peers`. Experimental is used as [RFC 2026](https://www.rfc-editor.org/rfc/rfc2026)
§4.2.1 uses it: a specification that is part of a development effort, published
for review and as a record; it claims no consensus. The member, its rules and
its limits may change or be withdrawn on the evidence of independent
implementations; a change comes with a new `spec` identifier (§3), never
silently. Three parts are marked *at risk* below (ADR 0018 D10): they may
change or go before this document leaves Experimental.

**Published:** 2026-11-07 (proposed)

**Repository:** https://github.com/vacationrentalprotocol/vrp-spec

**Builds on:** [Core VRP v0.1](./v0.1.md) (§1 no central discovery index, §2
discovery document, host-owned domain, node URL and fetching),
[Well-Known URI v0.1](./well-known-uri-v0.1.md) (§3 unknown fields are ignored,
§4 the document is no proof of any claim),
[StayIntent Discovery v0.1](./stayintent-discovery-v0.1.md) (§2 no index is
privileged, §4.2 order carries no meaning).

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
document are to be interpreted as described in BCP 14
([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119),
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they
appear in all capitals, as shown here.

## 1. Purpose

Core v0.1 tells an agent how to verify a node whose domain it already knows, and
forbids making verification depend on a central discovery index (Core §1). It
does not say how an agent that knows one node finds another. Without that, every
way in is a list someone keeps, and whoever keeps the list stands in the middle.

`peers` lets each node say, on its own domain, which other VRP nodes it knows: a
list of domains and nothing else. An agent, an index or a search engine that
knows one node can walk from it to others, and verifies each one at that node's
own domain. No list is the list: every node writes its own, none is required,
and none weighs more than another.

`peers` finds nodes. It does not answer a guest's request: matching place,
dates, guests and capabilities is [StayIntent Discovery](./stayintent-discovery-v0.1.md),
and an index MAY use `peers` to find the nodes it indexes.

## 2. What an entry is, and is not

An entry says only: "the operator of this node believes this domain is a VRP
node". It is:

- **not a trust relation:** listing confers nothing on the listed domain, and
  being listed confers nothing on the listing node;
- **not an endorsement,** a recommendation, a partnership or a rating;
- **not reciprocal:** a node MAY list a domain that does not list it back;
- **not proof:** like every other field of the discovery document it is
  advisory metadata (Well-Known URI §4). Each listed domain proves itself at its
  own domain, or does not count (§5).

## 3. The `peers` member

A node that publishes peers adds one member to its discovery document
(Core §2):

```json
"peers": {
  "spec": "https://vacationrentalprotocol.com/spec/peers-v0.1",
  "nodes": ["example.co.uk", "example.net", "example.org"],
  "updated_at": "2026-11-07T15:00:00Z"
}
```

- `spec` (REQUIRED): exactly `https://vacationrentalprotocol.com/spec/peers-v0.1`.
  It names this version of this document.
- `nodes` (REQUIRED): an array of zero to 100 domains (§3.1–§3.3).
- `updated_at` (OPTIONAL): an RFC 3339 date-time in UTC (`Z`), when the
  publisher last changed `nodes`. It states nothing about any listed node.

`peers` has no other member. A publisher MUST NOT add one, and MUST NOT put
anything about a listed node in `peers`: no name, URL, price, distance, score,
rating, category or date. What is said about a node is said by that node, on
its own domain.

[`schemas/peers-v0.1.schema.json`](../schemas/peers-v0.1.schema.json) describes
the member. The Core discovery schema does not change.

### 3.1 Entries

Each entry in `nodes`:

1. is a domain written the way Core §2 item 1 writes `canonical_domain`:
   lowercase ASCII, internationalized labels in A-label (`xn--`) form, no
   trailing dot, and at least two labels; no scheme, path, port or userinfo;
2. meets Core §2's host-owned domain rule (items 2 and 3): its own registrable
   domain under the ICANN section of the Public Suffix List, and not under a
   brand or closed top-level domain;
3. is not the listing node's own `canonical_domain`.

An entry is a domain, not a URI. Core §2 identifies a node by its registrable
domain and fixes where its discovery document is (RFC 8615,
`/.well-known/vacation-rental.json`), so the URL is derived, never stated: a
client that builds it itself (§5) cannot be sent anywhere else by a list, and
two lists that name the same node write it the same way.

### 3.2 Order

Entries appear once each, in ascending order of their characters' code points.
A list sorted by a rule anyone can recompute has no order to read meaning into:
the first entry is not a first choice. A client MUST treat `nodes` as a set and
MUST NOT rank, weight or present peers by their position.

*At risk (ADR 0018 D10):* whether ascending order stays a requirement or becomes
a recommendation is decided on implementation evidence.

### 3.3 Size

At most 100 entries. A node that knows more chooses which to list. The cap
bounds what one document can cost a client (§6).

*At risk (ADR 0018 D10):* the cap of 100.

## 4. Reading `peers`

A client that implements this document, reading a discovery document with a
`peers` member:

1. MUST ignore the whole `peers` member when any of the following holds. The
   discovery document itself stays as valid under Core as it was. The cases
   are checked in this order, and a client that reports a reason names the
   first case that holds; the conformance vectors use these names:
   - `not_object`: `peers` is not a JSON object;
   - `unknown_spec`: `spec` is missing or not exactly the identifier in §3;
   - `unexpected_member`: `peers` has a member other than `spec`, `nodes` and
     `updated_at`;
   - `updated_at_invalid`: `updated_at` is present and not an RFC 3339
     date-time in UTC (`Z`);
   - `nodes_invalid`: `nodes` is missing or not an array;
   - `too_many_entries`: `nodes` has more than 100 entries;
   - `entry_not_domain`: an entry is not a string written as §3.1 item 1;
   - `duplicate_entry`: an entry appears more than once;
   - `not_sorted`: the entries are not in ascending order (§3.2).
2. MUST skip an entry that fails §3.1 item 2 (with Core's names
   `malformed_domain`, `public_suffix`, `not_host_owned` or `closed_tld`) or
   item 3 (`self`), and MAY use the other entries. The host-owned rule depends
   on the client's copies of the Public Suffix List and ICANN's gTLD list, which
   change; one entry that a newer copy rejects does not void the list.
3. MUST NOT treat an entry as a VRP node, as a statement by the listed domain,
   or as anything to quote, until it has reached that domain itself (§5).
4. MUST NOT read a domain's absence from a list, or the number of lists a
   domain appears on, as a statement about that domain. A domain that many
   nodes list has no more standing than one that a single node lists, and a
   domain that no list names is not thereby in question. A list says what its
   publisher knows (§8), nothing more.

The discovery document as a whole is read under Well-Known URI §3: a field a
client does not know is ignored. `peers` itself is read the other way: a member
this document does not define voids the whole `peers` member. The reason is
§3's rule that nothing about a listed node may appear in `peers`. That rule
binds publishers only if clients enforce it, and a client cannot tell a
harmless unknown member from a score or a name under another key. A later
version that needs another member carries a new `spec` identifier (§3), which
a client of this version ignores as `unknown_spec`.

A client that does not implement this document ignores `peers` as it ignores
every unknown field (Well-Known URI §3).

## 5. Reaching a listed domain

A client reaches a listed domain the way Core reaches any node. It builds the
URL `https://{domain}/.well-known/vacation-rental.json` itself, never taking a
URL from a list, and fetches it under Core §2 "Fetching", redirects included.
The domain is a node reached through peers only when that document meets
Core §2 for that domain: `protocol` and `protocol_version` as Core §2 requires,
`canonical_domain` equal to the domain, and `jwks_url` and
`verified_stay_offer_endpoint` node URLs. Otherwise (no answer, an error,
another `canonical_domain`, a missing field) the domain is not a node for this
client, and the client does not read that document's `peers`.

Reaching a node is not verifying an offer. Before it quotes anything from a
reached node, an agent verifies that node's signed offer under Core §3–§9,
exactly as for a node it learned of in any other way. Where the agent found the
domain changes nothing.

## 6. Walking

A client MAY follow the `peers` of the nodes it reaches. A client that does:

1. MUST bound the walk by a maximum depth (the starting node is depth 0, its
   peers depth 1), a maximum number of discovery fetches, and a time limit per
   fetch and per walk. RECOMMENDED defaults: depth 3, 100 fetches, 10 seconds
   per fetch. *At risk (ADR 0018 D10):* these defaults.
2. MUST fetch each domain at most once per walk, which also ends every cycle.
3. MUST follow the `peers` only of nodes it has reached (§5).
4. MUST NOT connect, for a domain taken from `peers`, to an address that is not
   globally reachable (loopback, private, link-local and the like).
5. SHOULD fetch at most one document at a time from any one domain, MUST honour
   `Retry-After` on a 429 or 503 answer, and SHOULD respect the HTTP caching of
   each document; without caching headers, it SHOULD NOT fetch the same document
   again within 24 hours.
6. MUST NOT present a walk that a limit stopped, while peers remained to
   follow, as all the nodes there are. Even a walk that ran out of peers covers
   only the nodes reachable from where it started (§7).
7. MUST treat the result as a set: it MUST NOT rank, score or order the nodes
   as a recommendation, nor weight them by how many lists named them (§4 item
   4). Where it has to list them, it uses an order anyone can recompute (for
   example ascending by domain) and does not present that order as meaningful
   (StayIntent §4.2).

Given the same documents and the same depth, the set of nodes reached does not
depend on the order in which a client processes entries: a node's depth is the
length of the shortest chain of reached nodes from the start. The conformance
vectors check this.

## 7. Where a walk starts

This document defines no starting node, no seed list and no registry, and no
starting point is privileged. A walk starts wherever the agent already is: a
domain the guest names, a search result, a link on a page, a list any operator
publishes, a StayIntent index's response. Conformance never depends on a
starting point. A node that lists no peers, and that no one lists, is still a
VRP node, reached the way Core reaches every node: by its domain.

## 8. Publishing `peers`

- A node MAY publish `peers`. It is never required.
- Which domains to list is the node's choice: nodes the host knows, nodes
  nearby, other nodes the same software runs. A list says nothing about the
  domains left out of it.
- A node SHOULD list only domains it has itself reached (§5), and SHOULD remove
  a domain that no longer answers as a VRP node.
- The list is as public as the rest of the discovery document: it shows which
  nodes a host knows. It never holds guest data, bookings, prices or
  availability (§3; Well-Known URI §5).

## 9. Security considerations

- **Many or false entries** cost a client fetches, never trust: the cap (§3.3)
  and the walk's limits (§6) bound the cost, and a listed domain that is not a
  node is skipped (§5).
- **Omission:** a listing node can leave nodes out; it cannot forge another
  node's discovery document or signature. A client that wants more nodes starts
  more walks, from more places (§7).
- **Requests to internal addresses:** a list is untrusted input that names hosts
  to connect to; §6 item 4 keeps a walk off non-public addresses.
- **Load:** a walk fetches only the public discovery document each node already
  serves to any client. The limits and caching of §6 bound it, and each node
  keeps its own rate limits.
- **No signature on the list in v0.1:** the list can only point at domains that
  must then prove themselves (§5). A signature would not change what a client
  may conclude from it, and would add key handling. A later version may revisit
  this if lists come to be used for more.
- **Lists as a ranking:** nothing here lets anyone rank, compare or gate nodes,
  and §4 item 4 and §6 item 7 forbid a client to turn lists, absence from them
  or their count into one. A walk turned into a ranking is outside this
  document (StayIntent §6).

## 10. Privacy considerations

- **What a list exposes:** which VRP nodes a host knows. To a third party that
  is new information. It is published by the host's choice (§8), and what each
  entry asserts, that a domain is a VRP node, that domain already publishes
  itself at a well-known URI.
- **Minimum:** domains only. No names, addresses, relationships, counts or
  dates about a node (§3); `updated_at` dates the list, not any node.
- **Personal data:** a host's domain can be a person's name. A list of such
  domains is then a list of persons, and its publisher answers for publishing
  it under the law that applies to the publisher, as for anything else on its
  domain. This document gives a listed domain no way to refuse a listing: what
  a listing asserts is public already, and a domain that stops serving a
  discovery document drops out of every walk (§5).
- **What a walk reveals:** each node a client fetches learns, as with any
  request, that this client fetched it. Nothing here adds identifiers, cookies
  or state. Which nodes a walk reached is known to the client alone.
- **No guest data,** bookings, prices or availability, in a list or in a walk
  (§3; Well-Known URI §5).
- **Legitimate misuse:** a software vendor may publish, on each node it
  operates, only the other nodes it operates. The list is true, and it buys
  nothing: §4 item 4 forbids a client to weigh how often a node is named. A
  vendor that wants its nodes reached from outside lists nodes it does not
  operate, or is listed by them.

## 11. Conformance

Two classes of product implement this document:

- a **peers publisher**: a VRP node whose discovery document carries a `peers`
  member (§3, §8);
- a **peers client**: software that reads a `peers` member (§4), reaches
  listed domains (§5) or walks (§6).

A node without the member, and a client that ignores it, are neither, and
conform to Core v0.1 as before.

- [`examples/conformance/peers/positive.v0.1.json`](../examples/conformance/peers/positive.v0.1.json):
  a small network of discovery documents; walks from different starting nodes
  and depths, the set of nodes reached, whether the walk is complete, and the
  domains not reached and why.
- [`examples/conformance/peers/negative.v0.1.json`](../examples/conformance/peers/negative.v0.1.json):
  `peers` members a client must ignore and entries it must skip, each with the
  name of its case (§4).
- [`scripts/verify-peers.mjs`](../scripts/verify-peers.mjs) checks both files
  offline, with no other code from this repository than Core's host-owned
  domain and node URL rules (`scripts/verify-host-domain.mjs`).

What the vectors cover: for a publisher, the shape of the member (the schema),
the cap, uniqueness and order; for a client, every case of §4, the reaching
rule of §5 on given documents, and the set, depth and completeness of a walk
under §6 items 2, 3, 6 and 7. What they cannot cover: a client's time limits,
its handling of addresses and of `Retry-After` (§6 items 1, 4 and 5), and how
it presents a result (§6 items 6 and 7). Those are read in an implementation,
not run.

Core conformance does not change: no Core vector, schema or verifier rule
refers to `peers`.

## 12. Relationship to other documents (informative)

- **Core v0.1 §1** forbids requiring a central discovery index. `peers` keeps
  it so: every list is optional, and every node it names proves itself.
- **StayIntent Discovery v0.1** answers a stay request with pointers to nodes;
  `peers` is one way an index, or an agent, learns which nodes exist.
- **[CM AI Docking Port and VRP](../docs/interop/cm-ai-docking-port.md)**: a
  node that already forwards requests to neighbouring nodes knows those
  neighbours, and can publish them as `peers`. This document defines no
  forwarding.

## References

- [Core VRP v0.1](./v0.1.md); [Well-Known URI v0.1](./well-known-uri-v0.1.md);
  [StayIntent Discovery v0.1](./stayintent-discovery-v0.1.md)
- [ADR 0002](../docs/adr/0002-no-gatekeeper-trust-and-interop.md) (no
  gatekeeper); [ADR 0018](../docs/adr/0018-peers-experimental.md) (this
  extension)
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119),
  [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174),
  [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339),
  [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615) (well-known URIs),
  [RFC 2026](https://www.rfc-editor.org/rfc/rfc2026) §4.2.1 (Experimental);
  the [Public Suffix List](https://publicsuffix.org/list/) as Core §2 applies it

## License

Specification text: dedicated to the public domain under [CC0 1.0](../LICENSE). Reference code and conformance test vectors: [Apache-2.0](../LICENSE-CODE) ([ADR 0007](../docs/adr/0007-receipt-envelope-v1.md) D7).
