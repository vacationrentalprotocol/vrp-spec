# VRP Peers — conformance vectors (experimental)

Apache-2.0 — see [`LICENSE-CODE`](../../../LICENSE-CODE).

These vectors define what a client does with the optional `peers` member of
[`spec/peers-v0.1.md`](../../../spec/peers-v0.1.md) (Experimental,
[ADR 0018](../../../docs/adr/0018-peers-experimental.md)). They are not part of
Core conformance: no Core vector, schema or verifier rule refers to `peers`.

## Files

| File | What it is |
| --- | --- |
| [`negative.v0.1.json`](./negative.v0.1.json) | `peers` members a client ignores in full (§4 item 1) and entries it skips (§4 item 2), each with the name of its case, and three valid controls. Each case breaks one rule, so the name does not depend on the order of checks; a client that reports a reason names the first case in §4's order. `schema_valid` says whether the member is valid against [`schemas/peers-v0.1.schema.json`](../../../schemas/peers-v0.1.schema.json). |
| [`positive.v0.1.json`](./positive.v0.1.json) | A five-domain network of discovery documents and six walks over it (§5, §6): the nodes reached, whether the walk is complete, and the domains not reached and why. |

The domains are reserved example names (`example.com`, `example.net`,
`example.org`, `example.co.uk`) and names under `.invalid`. No vector names an
implementation or a real node.

The reference check is [`scripts/verify-peers.mjs`](../../../scripts/verify-peers.mjs).
It runs offline, runs every walk a second time with each node's entries
reversed (the set reached must not depend on the order), and uses no other code
from this repository than Core's host-owned domain and node URL rules
([`scripts/verify-host-domain.mjs`](../../../scripts/verify-host-domain.mjs)).
