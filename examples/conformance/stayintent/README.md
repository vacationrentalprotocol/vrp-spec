# VRP StayIntent open discovery — conformance vectors

Apache-2.0 — see [`LICENSE-CODE`](../../../LICENSE-CODE).

These vectors define the StayIntent conformant surface for
[`spec/stayintent-discovery-v0.1.md`](../../../spec/stayintent-discovery-v0.1.md)
§8. The **specification and these vectors**, not any implementation, define what
a conformant StayIntent response is. A conformant surface is any deterministic
capability+geo filter that produces these results; a free-text, LLM-upstream
search is a non-normative convenience layer and is not the StayIntent contract
until its upstream is deterministic.

## Files

| File | What it is |
| --- | --- |
| [`positive.v0.1.json`](./positive.v0.1.json) | A query that matches: the response shape, and that a pointed node's offer verifies. |
| [`no-match.v0.1.json`](./no-match.v0.1.json) | A query that matches nothing → `match: "no"`, empty `nodes`. |

The reference verifier is
[`scripts/verify-stayintent.mjs`](../../../scripts/verify-stayintent.mjs); anyone
can run it against these files without this repository's other code.
