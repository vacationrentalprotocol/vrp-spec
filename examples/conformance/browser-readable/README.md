# VRP browser-readable vectors

Apache-2.0 — see [`LICENSE-CODE`](../../../LICENSE-CODE).

These vectors exercise [spec/v0.1.md §4 *Readable from a browser*](../../../spec/v0.1.md)
([ADR 0020](../../../docs/adr/0020-readable-from-a-browser.md)): a node SHOULD
send `Access-Control-Allow-Origin: *` on its discovery document, its JWKS and
every response from its offer endpoint, error responses included, so that a
verifier running in a web page can read them.

`vectors.json` is the manifest. Each case gives the status and the response
headers of up to four responses of the fictitious node `example-host.invalid`
(`discovery`, `jwks`, `offer`, `offer_error`) and the expected outcome: which
of them a page on another origin can read, and whether the node meets §4.
A response that a case leaves out is not judged.

| Case | Expect | Why |
| --- | --- | --- |
| the header as `*` on all four | pass | every response is shared with every origin |
| set for `/.well-known/` only | fail (offer) | the offer endpoint at another path lacks the header |
| no response sends it | fail (all) | nothing can be read from a page |
| on the offer, not on its error response | fail (offer_error) | a page cannot read why the node said no |
| one origin named | fail (offer) | at most that origin can read the response |
| `null` | fail | `null` is not `*` |
| sent twice | fail | a browser reads two headers as one value, `*, *`, which is not `*` |
| two values | fail | not `*` |
| empty | fail | not `*` |
| lower-case name, padded value | pass | header names compare without case; the value is trimmed |

Run them with `npm run verify-browser-readable`. Check a live node with
`node scripts/verify-browser-readable.mjs --live <domain>`.
