# VRP StayIntent Discovery v0.1

**Status:** Public draft
**Date:** 2026-06-16
**Revised:** 2026-11-07 (proposed, [ADR 0019](../docs/adr/0019-stayintent-endpoint-and-pages.md)):
§3.1 `cursor`, §4.4 pages, §10 the endpoint in a node's discovery document and
its HTTP binding. Additive: a query without `cursor` and a response without
`next_cursor` mean what they meant before.
**Builds on:** VRP [v0.1](v0.1.md) (per-node discovery, `canonical_domain`,
signed offers), [attestations-v0.1](attestations-v0.1.md) (did:web).

## 1. Purpose

VRP v0.1 specifies how a **known** host-owned node publishes its facts and signs
offers. It deliberately does **not** specify how an agent *finds* which node
matches a natural request ("villa near Lund, dog, hot tub, 6 guests"). v0.1 §1
states verification MUST NOT require *"a central discovery index"*.

StayIntent Discovery fills that gap **without** a central index. It defines an
open, **federatable** query/response contract for verifiable hospitality
discovery: a deterministic capability+geo match that returns **non-authoritative
pointers** to host nodes, where authority is established only by verifying the
node's own Ed25519 signed offer at its `canonical_domain`.

This is the DNS model, not a catalog: anyone may run a StayIntent index; multiple
indexes coexist; HemmaBo runs a **reference implementation**, not the index.

## 2. No-gatekeeper mechanism (normative)

- A StayIntent **index response is non-authoritative.** It MAY only return
  pointers (a node's `canonical_domain` + its VRP discovery endpoints +
  verifiable trust facts). It MUST NOT be required to verify or book.
- **Authority lives at the node.** An agent establishes truth by fetching the
  node's signed `verified_stay_offer` and verifying its Ed25519 signature against
  the node's `jwks_url` / `did:web` document (VRP v0.1 §3). An index that lies or
  omits can be detected and routed around — it cannot forge a node's signature.
- **No index is privileged.** Any operator MAY run an index over the same nodes;
  responses are independently verifiable regardless of which index answered.
  Conformance MUST NOT depend on a specific index or operator.

## 3. StayIntent query (`stayintent-query-v0.1`)

A deterministic, structured intent — capability + geo + dates + guests:

```json
{
  "protocol": "vrp-stayintent",
  "protocol_version": "0.1",
  "geo": { "near_wikidata": "Q2167", "radius_km": 15 },
  "capabilities": ["pets_allowed", "hot_tub"],
  "dates": { "check_in": "2026-11-14", "check_out": "2026-11-16" },
  "guests": 6
}
```

- `geo` MUST use Wikidata QID (`near_wikidata`) and/or `{lat, lng, radius_km}`.
  No bespoke geo ontology — adopt Wikidata + OSM.
- `capabilities` are codes aliased to schema.org / OTA HAC (see §7); unknown codes
  are ignored, never an error.
- The query is **deterministic**: the same query MUST yield the same match set
  (subject to live availability). No free-text NL is required at this layer.

### 3.1 `cursor` (pages)

A query MAY carry `cursor`: an opaque string of 1 to 1024 characters, copied
from the `next_cursor` of a response to the same query (§4.4). A query that
carries a `cursor` MUST be identical, in every other member, to the query that
produced it. An index that does not recognise a cursor answers 400 (§10.1), and
the client starts again without one.

## 4. StayIntent response (`stayintent-response-v0.1`)

```json
{
  "protocol": "vrp-stayintent",
  "protocol_version": "0.1",
  "match": "yes",
  "nodes": [
    {
      "canonical_domain": "villaakerlyckan.se",
      "discovery": "https://villaakerlyckan.se/.well-known/vacation-rental.json",
      "jwks_url": "https://villaakerlyckan.se/.well-known/jwks.json",
      "verified_stay_offer_endpoint": "https://villaakerlyckan.se/api/verified-stay-offer",
      "trust_summary": {
        "did_web_resolved": true,
        "jwks_ed25519": true,
        "signed_offer_capable": true,
        "federation_member": true,
        "attestation_refs": ["vrp/attestations/v0.1/bundle.json"]
      }
    }
  ],
  "note": "Not ranked. Deterministic match. Verify each node's signed offer (Ed25519) before quoting price or booking."
}
```

### 4.1 Pricelessness (normative)
A StayIntent response MUST NOT contain a price, total, availability total, or any
monetary value. **Price exists only inside the node's signed offer.** This keeps
the index from becoming a price-oracle or OTA-light, and keeps the authoritative
total cryptographically bound to the node.

### 4.2 Order is non-normative
`nodes[]` order carries NO meaning. A conformant index MUST NOT rank, score, or
imply "best". (Implementations that sort internally, e.g. by domain, MUST NOT
present order as a recommendation.)

### 4.3 `trust_summary` = verifiable facts only (normative)
`trust_summary` MUST contain only **independently verifiable boolean facts or
references** — e.g. `did_web_resolved`, `jwks_ed25519`, `signed_offer_capable`,
`federation_member`, `federation_jws_valid`, `offer_fresh`, `attestation_refs`.
It MUST NOT contain editorial scores, ratings, confidence values, or any number
an agent could read as a ranking signal. Every field MUST be reproducible by the
agent fetching the node directly.

### 4.4 Pages (normative)

An index MAY answer a query in pages. These rules keep paging from becoming a
ranking: an index that shows twenty matches of five hundred has chosen which
twenty, unless the choice is nobody's.

- A response MAY carry `next_cursor`, an opaque string of 1 to 1024
  characters. Present, it means more matches follow, and the client sends the
  same query with `cursor` set to it (§3.1). Absent, the page is the last.
- A **chain** is a first page and every page reached by following its cursors.
  Across a chain the nodes MUST be in ascending order of `canonical_domain` by
  code points, each node at most once. Paging itself MUST NOT omit or repeat a
  node: every node that matches the query throughout the reading of the chain
  appears in it exactly once. A node that begins or stops matching while the
  chain is read (live availability) MAY be present or absent. *At risk (ADR
  0019 D8):* ascending domain as the rule; the requirements that the rule is
  one anyone can recompute, and that paging never omits or repeats, stay.
- No snapshot is needed (informative). Because the order is fixed, a cursor can
  carry the last `canonical_domain` of the page it ends, and the next page is
  the first matches whose domain sorts after it; the index keeps no state
  between requests. The cursor stays opaque to the client, and an index that
  prefers to keep a snapshot MAY.
- The index chooses the page size. It MUST NOT return an empty page that
  carries `next_cursor`; the last page MAY be empty.
- A response MAY carry `match_count`: the number of matches as the index
  counted them when it made the first page, a non-negative integer, the same
  on every page that carries it. It counts matches and says nothing about any node. *At risk
  (ADR 0019 D8).*
- `match` describes the chain, not the page: `"yes"` on every page of a chain
  with at least one node, `"no"` only on a chain with none.
- A client MUST NOT present the nodes it has read as all the matches while the
  last response it read carried `next_cursor`; it says that more follow, and
  how many it read of `match_count` when that was given. A client that reads
  only the first page has read the alphabetically first matches, not the best.
- §4.1, §4.2 and §4.3 apply to every page. The order across a chain is the
  only order a client can recompute and no one can sell; like the order within
  a page, it carries no meaning (§4.2).

## 5. Verification (how an agent uses a response)

1. Treat the response as **pointers only**.
2. For each node: fetch `verified_stay_offer_endpoint` for the dates/guests;
   verify the offer's Ed25519 signature against `jwks_url` (and/or the `did:web`
   document). VRP v0.1 §3.
3. Read price, availability, and `direct_booking_url` **only** from the verified
   signed offer. Per VRP v0.1 §5.1, `direct_booking_url` MUST be on the node's
   `canonical_domain` — never an OTA, never the index, never HemmaBo.
4. **found ≠ bookable.** A node appearing in a StayIntent response means it
   *matched the intent*, not that it is bookable. Bookability requires a fresh,
   signature-valid offer with availability.

## 6. Pricelessness + no-ranking rationale

These two rules (no price in §4.1, no ranking in §4.2/§4.3) are what keep
StayIntent a **trust-discovery** contract and not a marketplace. An index that
adds price or ranking has rebuilt the OTA it replaces.

## 7. Capability ontology (alias, do not reinvent)

`capabilities` codes are aliases over existing vocabularies:
- schema.org `LocationFeatureSpecification` names,
- OTA OpenTravel Hotel Amenity Codes (HAC) where a mapping exists,
- (future) the UCP hospitality namespace when published.

The alias table maps these codes to the vocabularies above; an implementation
provides the concrete lookup (for example `AMENITY_SCHEMA_MAP`). Geo uses
Wikidata QID + OSM.

## 8. Conformance

- **Positive vector** (`examples/conformance/stayintent/positive.v0.1.json`):
  a query (Lund 15 km, pets, hot_tub, 6 guests) → a response with the reference
  node, whose signed offer then verifies (Ed25519).
- **Negative vector** (`.../no-match.v0.1.json`): a query that matches nothing →
  `match: "no"`, empty `nodes`. (Mirrors VRP's failure-mode fixtures.)
- **Reference verifier** (`scripts/verify-stayintent.mjs`): independently checks a
  response shape + that a pointed node's offer verifies — anyone can run it.
- **Pages vector** (`examples/conformance/stayintent/pages.v0.1.json`): one
  chain of three pages over five nodes in ascending domain order with
  `match_count`, chains a client must reject (a node repeated across pages,
  pages out of order, an empty page with a cursor, a chain that does not end, a
  count that does not add up, a ranking signal, a monetary value), and
  `endpoints.stayintent` lists a client accepts and rejects (§10).
  `scripts/verify-stayintent-pages.mjs` checks it offline in `npm test`.
- **Conformance:** the StayIntent contract is defined by this specification and
  its conformance vectors. A conformant surface is any deterministic
  capability+geo filter that satisfies them (for example a pure-DB, no-LLM
  filter). A free-text, LLM-upstream search is a **non-normative** convenience
  layer and is NOT the StayIntent contract until its upstream is deterministic.

## 9. Relationship to UCP / A2A

StayIntent is a **verifiable discovery overlay** that sits *on top of* transport
standards (UCP, MCP, A2A), not against them. UCP/MCP carry the request; StayIntent
defines the verifiable, no-gatekeeper hospitality-discovery semantics + the
Ed25519 trust binding that those transports do not specify.

## 10. Finding an index: `endpoints.stayintent` (normative)

A client that knows one node can find a StayIntent index without a catalog: a
node MAY name the indexes it knows answer for it, in its discovery document
(Core v0.1 §2), under `endpoints`:

```json
"endpoints": {
  "stayintent": [
    "https://example.com/.well-known/vrp/stayintent",
    "https://index.example.net/stayintent"
  ]
}
```

- The value is an array of one to ten entries, each an absolute `https` URL
  with no userinfo, each once. An entry MAY be on another domain than the
  node's: an index covers many nodes, and the software that runs a node often
  runs an index. A node without the member is a node like any other, and a
  client that does not know the member ignores it (Well-Known URI v0.1 §3).
  The Core discovery schema does not change: `endpoints` is an open object.
  *At risk (ADR 0019 D8):* the cap of ten.
- The array is a set: its order carries no meaning, and a client MUST NOT
  prefer an index by its position. It names indexes that answer for this node,
  never **the** index. Any number of indexes MAY cover the same node (§2), a
  client MAY use any of them, named here or not, and the response of a named
  index has no more authority than any other's: pointers only, verified at
  each node (§5). A list of one is allowed: a node that knows only the index
  its own software runs names that one, and other indexes may still cover it.
- An index named in a discovery document MUST answer the query of §10.1
  without authentication or registration; it MAY rate-limit. A public pointer
  to a gated index would make the gate the catalog. *At risk (ADR 0019 D8).*
- A node MUST NOT name an index that does not answer for it. That is testable:
  the node appears in the index's chain for a query the node matches.
- A client treats every entry as untrusted input. It MUST NOT connect to an
  address that is not globally reachable (loopback, private, link-local and
  the like), and it bounds its own fetches and time.
- A client ignores the whole member, as it would an unknown field, when it is
  not an array, is empty, has more than ten entries, repeats an entry, or has
  an entry that is not such a URL. The conformance vectors name these cases.

### 10.1 HTTP binding

- The client sends `POST` to the URL with `Content-Type: application/json` and
  the StayIntent query (§3) as the body.
- The index answers `200` with `Content-Type: application/json` and the
  StayIntent response (§4) as the body; `400` when the body is not a valid
  query or carries a `cursor` it does not recognise (an unknown capability
  code is not an error, §3); `429` or `503` with `Retry-After` when it asks
  the client to wait. The client MUST honour `Retry-After`.
- The query carries no personal data (§3). An index MUST NOT require any, and
  MUST NOT keep queries against an identity of the asker beyond what rate
  limiting needs.
- This version defines no other method.

## References
- VRP [v0.1](v0.1.md) §1 (no central discovery index), §3 (signatures), §5.1
  (`direct_booking_url` on `canonical_domain`)
- [attestations-v0.1](attestations-v0.1.md) (did:web), [transparency-log-v0.1](transparency-log-v0.1.md)
- W3C VC / did:web; schema.org; Wikidata; OpenTravel HAC; UCP (transport)

## License

Specification text: dedicated to the public domain under [CC0 1.0](../LICENSE). Reference code and conformance test vectors: [Apache-2.0](../LICENSE-CODE) ([ADR 0007](../docs/adr/0007-receipt-envelope-v1.md) D7).
