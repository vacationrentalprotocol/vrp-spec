# CM AI Docking Port and VRP: a field-by-field mapping

**Status:** Informative interop note. It changes nothing in VRP: no requirement,
no field, no verification rule. It maps one independent protocol's question and
answer onto VRP's, so that an agent can ask a CM Free node and a VRP node the same
question and read the same kind of answer. The protocol's own text decides what it
means; where this note and that text differ, that text wins.
**Date:** 2026-10-24
**Maps:** [CM AI Docking Port, protocol version 0.1](https://cmfree.duckdns.org/app/public/ai/)
(Viljem Dvojmoč, CM Free, AGPL-3.0,
[source](https://github.com/viljemd-hub/channel-manager/tree/main/public/ai))
onto [VRP StayIntent Discovery v0.1](../../spec/stayintent-discovery-v0.1.md),
[Core VRP v0.1](../../spec/v0.1.md) §2–§5 and the
[Node Tool Binding v0.1](../../spec/node-tool-binding-v0.1.md) proposal.
**Read on:** 2026-10-24, from the Docking Port's landing page and its manifest
(`/.well-known/cm-ai-docking-port.json`, HTTP 200 on `cmfree.duckdns.org` and
`ai-cmfree.duckdns.org`). The Docking Port's long-form spec is its author's
internal development log and is not read here.

## 1. What the Docking Port is

In its own words: "a standardized entry point for AI agents into the CM Ecosystem"
and "a thin discovery and routing layer that lets any AI agent, speaking plain HTTP
and JSON, find out what a CM instance can answer and how to ask." Each CM
installation is a node. An agent calls one endpoint, **Reception**, with a
Request Envelope; the node answers from its own data, and only when its local
result is not positive forwards the same request to a small set of nearby,
trusted nodes (depth-limited, geography-gated, loop-safe) and returns one
Response Envelope. "The one rule that matters most: an AI agent talks only to
Reception." Everything is read-only: "nothing an agent does through Reception
creates a booking, a block, or any other write." There is no central server and
no registry of nodes.

Four of those properties are the ones VRP's discovery layer requires of any
index: a node answers for itself, a response that is incomplete says so, no
central index, no write. The mapping below is therefore mostly renaming. The
places where it is not renaming are listed in §6, with what a CM node that is
also a VRP node does about each.

## 2. Identity and discovery

| Docking Port | VRP | Note |
| --- | --- | --- |
| `/.well-known/cm-ai-docking-port.json` | `/.well-known/vacation-rental.json` (Core §2, [Well-Known URI v0.1](../../spec/well-known-uri-v0.1.md)) | Two documents, one domain. A CM node that is a VRP node serves both; each describes its own layer. |
| `service.node_id` (`CM-AI-DEMO-058`) | `canonical_domain` (`apartmamatevz.si`) | VRP identifies a node by the registrable domain that serves its documents and signs its offers (Core §2). The Docking Port's `node_id` is a label. §6.1 says how to carry both. |
| `service.location` `{lat, lon, label}` | none in the discovery document | VRP's discovery document carries no coordinates; geo enters only through the StayIntent query. |
| `capabilities.local[]`, `capabilities.ecosystem[]` | none in the discovery document; tool names per the Node Tool Binding (§5 below) | VRP lists no capabilities in discovery. |
| `reception` `{method, endpoint, content_type}` | `verified_stay_offer_endpoint`, `jwks_url` | Different things: Reception answers *who has room*; the offer endpoint returns *one node's signed offer* for one stay. See §4. |
| `limits_default` | none | Routing policy, not discovery. |
| `version` `"0.1"` | `protocol_version` `"0.1"` | |

## 3. The question: Request Envelope and StayIntent query

| Docking Port (Request Envelope) | VRP StayIntent query (`stayintent-query-v0.1`) | Note |
| --- | --- | --- |
| `protocol` `"CM-AI-Docking-Port"`, `version` `"0.1"` | `protocol` `"vrp-stayintent"`, `protocol_version` `"0.1"` | |
| `target.location.lat`, `target.location.lon` | `geo.lat`, `geo.lng` | Same datum, one key renamed (`lon` → `lng`). |
| `target.location.label` | none | StayIntent uses `geo.near_wikidata` (a Wikidata QID) where a named place is meant, never free text. A label may be kept for the human trail; it is not a query term. |
| `target.radius_km` | `geo.radius_km` | Same. |
| `query.type` `"availability"` | implied | A StayIntent query is always a stay request. |
| `query.from`, `query.to` | `dates.check_in`, `dates.check_out` | Same format, `YYYY-MM-DD`. |
| `query.guests` | `guests` | Same. |
| `query.units` | none | No VRP equivalent. |
| none | `capabilities[]` (codes aliased to schema.org and OTA HAC, StayIntent §7) | A Reception node treats an absent list as empty. Unknown codes are ignored, never an error (StayIntent §3). |
| `request_id`, `request_expiry`, `origin`, `limits`, `visited` | none | Transport and routing: duplicate detection, expiry at the door, hop and radius ceilings, loop prevention. VRP leaves these to the transport. They do not change the match. |

Both queries are deterministic: the same query yields the same match set, subject
to live availability (StayIntent §3). Neither takes free text.

## 4. The answer: Response Envelope and StayIntent response

| Docking Port (Response Envelope) | VRP StayIntent response (`stayintent-response-v0.1`) | Note |
| --- | --- | --- |
| `ok` | — | Transport outcome. |
| `results[]` (non-empty) / `results[]` empty | `match` `"yes"` / `"no"` | |
| `results[].node_id` | `nodes[].canonical_domain` | See §6.1: the entry carries the node's domain. |
| — | `nodes[].discovery`, `nodes[].jwks_url`, `nodes[].verified_stay_offer_endpoint` | The three pointers an agent needs to verify the node itself (StayIntent §5). See §6.1. |
| `results[].node_location` | — | Not in a StayIntent response; harmless beside it. |
| `results[].depth`, `results[].source`, `results[].freshness` | — | Provenance of the hop. Not in StayIntent; harmless. |
| `results[].data` ("raw output of that node's own availability API, unmodified") | **not allowed** in a StayIntent response (§4.1: no price, no total, no availability total) | See §6.2. |
| `checked[]` (nodes contacted that confirmed zero availability) | — | In StayIntent a node with no room is simply not a match. `checked[]` is the Docking Port's own transparency about who was asked; it is not a match list. |
| `partial` | — (StayIntent has no flag; an index that omits "can be detected and routed around", §2) | The Docking Port's rule, "a partial search is never presented as a complete one", is stricter than StayIntent and compatible with it. |
| `search_meta.*`, `errors[]` | — | Transport. |
| order of `results[]` | order of `nodes[]` carries no meaning (§4.2) | The Docking Port states no ranking. A Reception node that forwards MUST NOT sort results into a recommendation if its response is read as a StayIntent response. |
| — | `nodes[].trust_summary` (verifiable boolean facts only, §4.3) | Optional in practice; a node that adds it may only add facts an agent can reproduce by fetching the node. |
| — | `note` | Free text for the agent; optional. |

## 5. The tool name

The Docking Port names two capabilities, `availability` (local) and
`accommodation-discovery` (ecosystem). Neither returns a signed offer, so the
[Node Tool Binding](../../spec/node-tool-binding-v0.1.md) does not name them, and
a node may keep calling them what it likes (binding §1, out of scope: "any tool
other than the one bound here").

The binding applies the moment a CM node exposes its **signed verified stay
offer** as a tool on any surface (MCP, A2A, WebMCP):

| Binding rule | For a CM node |
| --- | --- |
| Name (§3) | exactly `get_verified_stay_offer`, on every surface, no prefix or vendor string |
| Arguments (§4) | `check_in`, `check_out`, `guests`; the same three the Docking Port's `query` already carries under `from`, `to`, `guests` |
| Result (§5) | the node's signed envelope, unmodified, as `vrp_offer.php` returns it today; no verdict, no summary |
| Origin (§6) | served from a node URL (Core §2): the node's `canonical_domain` or `www.` followed by it, no other name |
| Who may use the name (§7) | only the node itself; a Reception that forwards another node's offer is an operator surface and MUST NOT advertise the name |

## 6. Where the two differ, and what a CM node that is a VRP node does

### 6.1 Identity: `node_id` is a label, `canonical_domain` is the node

A VRP agent verifies a node by fetching that node's own documents from its own
domain (Core §2–§3). A `node_id` such as `CM-AI-DEMO-058` gives an
agent nothing to fetch. For a Reception response to be usable as StayIntent
pointers, each `results[]` entry for a VRP node carries the node's domain and the
three VRP pointers, read from that node's own discovery document and passed
through unchanged:

```json
{
  "node_id": "apartmamatevz.si",
  "canonical_domain": "apartmamatevz.si",
  "discovery": "https://apartmamatevz.si/.well-known/vacation-rental.json",
  "jwks_url": "https://apartmamatevz.si/.well-known/jwks.json",
  "verified_stay_offer_endpoint": "https://apartmamatevz.si/app/public/api/vrp_offer.php",
  "depth": 1,
  "source": "cm_node",
  "freshness": { "generated_at": "2026-10-24T09:00:00Z" },
  "data": { "...": "the node's own availability output, as today" }
}
```

The same three fields belong in `service` of the node's own Docking Port
manifest, so that an agent that found the node through the Docking Port can
step to VRP without guessing. The node's VRP discovery document is the source of
these values; the manifest repeats them, it does not define them.

### 6.2 Availability data in the answer

A StayIntent response MUST NOT carry a price, a total or an availability total
(§4.1): "price exists only inside the node's signed offer". `results[].data` is
the node's availability output and stays the Docking Port's own. An agent reading
a Reception response as StayIntent takes the pointers (§6.1) and ignores `data`;
it then fetches the node's signed offer for `check_in`, `check_out`, `guests`,
verifies the signature against the node's `jwks_url`, and reads price,
availability and `direct_booking_url` from the verified offer and from nothing
else (StayIntent §5, Core §5.1). Found is not bookable: a `results[]` entry
means the node matched; a fresh, signature-valid offer with availability means
it can be booked.

### 6.3 Forwarding is an index

When a Reception node forwards to neighbours and aggregates, it is, in VRP terms,
running a StayIntent index over those neighbours. StayIntent allows that for
anyone ("anyone may run a StayIntent index; multiple indexes coexist", §1, §2)
on four conditions, all of which the Docking Port's own rules already meet or
can meet without change:

1. the response is pointers only; authority lives at each node (§2);
2. no price, no availability total in the response (§4.1, see §6.2);
3. no ranking, no score, no "best" (§4.2, §4.3);
4. an incomplete answer does not pass as complete (`partial`, stricter than §2).

What an index may not become is a catalogue that holds the hosts: the Docking
Port's "no central server", fallback-only forwarding and unmodified pass-through
keep it on the right side of that line. This note does not decide anything
beyond the mapping; a node's forwarding policy is the node's.

### 6.4 Geo

`lat`/`lon` maps to `lat`/`lng`. A `label` is a human trail, not a query term;
where a named place is meant, StayIntent names it by Wikidata QID
(`near_wikidata`) so that two nodes agree on what "Bled" is.

### 6.5 Two hosts today

On 2026-10-24 the Docking Port runs on a demo host (`cmfree.duckdns.org`, node
`CM-AI-DEMO-058`, which its own text marks as carrying no real data), while the
author's VRP node is `apartmamatevz.si` (discovery, JWKS and signed offers
verified 2026-10-20; see [IMPLEMENTATIONS.md](../../IMPLEMENTATIONS.md)).
`apartmamatevz.si` serves no Docking Port manifest, and the demo host signs no
offers. A Reception on the demo host that names `apartmamatevz.si` in a result is
an operator surface for that node (binding §2, §7): the agent still verifies
against `apartmamatevz.si`'s own JWKS and goes to that domain's
`direct_booking_url`. When the Docking Port runs on the VRP node's own domain,
the two documents sit on the same domain and §6.1 is a matter of three fields.

## 7. Worked example

The question, as a Request Envelope to the demo Reception, and as the StayIntent
query it is:

```json
{
  "protocol": "CM-AI-Docking-Port",
  "version": "0.1",
  "request_id": "req-2026-10-24-example",
  "request_expiry": "2026-10-24T12:00:00Z",
  "origin": "ai-agent",
  "target": { "location": { "lat": 46.3683, "lon": 14.1146, "label": "Bled" }, "radius_km": 30 },
  "query": { "type": "availability", "from": "2027-07-03", "to": "2027-07-07", "guests": 4, "units": null },
  "limits": { "max_depth": 2, "max_distance_km": 40, "max_results": 10 },
  "visited": []
}
```

```json
{
  "protocol": "vrp-stayintent",
  "protocol_version": "0.1",
  "geo": { "lat": 46.3683, "lng": 14.1146, "radius_km": 30 },
  "capabilities": [],
  "dates": { "check_in": "2027-07-03", "check_out": "2027-07-07" },
  "guests": 4
}
```

A `results[]` entry for the VRP node, carrying the §6.1 fields, read as a
StayIntent pointer:

```json
{
  "protocol": "vrp-stayintent",
  "protocol_version": "0.1",
  "match": "yes",
  "nodes": [
    {
      "canonical_domain": "apartmamatevz.si",
      "discovery": "https://apartmamatevz.si/.well-known/vacation-rental.json",
      "jwks_url": "https://apartmamatevz.si/.well-known/jwks.json",
      "verified_stay_offer_endpoint": "https://apartmamatevz.si/app/public/api/vrp_offer.php"
    }
  ],
  "note": "Not ranked. Deterministic match. Verify each node's signed offer (Ed25519) before quoting price or booking."
}
```

The agent's next step is VRP's, unchanged: fetch the node's verified stay offer
for `check_in=2027-07-03`, `check_out=2027-07-07`, `guests=4`; verify the
signature against the JWKS named in the node's own discovery document; quote
only a fresh, safe-to-quote offer; send the guest to the `direct_booking_url`
inside it, on `apartmamatevz.si`.

## 8. What this note does not do

- It does not add a field, a requirement or a rule to VRP.
- It does not make the Docking Port conformant to StayIntent. Conformance is
  shown against the vectors in this repository (StayIntent §8), by whoever runs
  them, with no approval from anyone (GOVERNANCE §6).
- It does not rank, compare or recommend either protocol or any node.
- It is not the Docking Port's specification. Its author's text is.

## References

- [VRP StayIntent Discovery v0.1](../../spec/stayintent-discovery-v0.1.md)
- [Core VRP v0.1](../../spec/v0.1.md), [Well-Known URI v0.1](../../spec/well-known-uri-v0.1.md)
- [Node Tool Binding v0.1](../../spec/node-tool-binding-v0.1.md) (proposal)
- [ADR 0002](../adr/0002-no-gatekeeper-trust-and-interop.md) (no gatekeeper)
- CM AI Docking Port: [landing page](https://cmfree.duckdns.org/app/public/ai/),
  [manifest](https://cmfree.duckdns.org/.well-known/cm-ai-docking-port.json),
  [source (AGPL-3.0)](https://github.com/viljemd-hub/channel-manager/tree/main/public/ai)
- [IMPLEMENTATIONS.md](../../IMPLEMENTATIONS.md)

## License

This document is specification text: [CC0 1.0](../../LICENSE) (public domain).
