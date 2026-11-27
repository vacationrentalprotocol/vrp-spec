# ADR 0020: The Three Responses Readable from a Browser

**Status:** Proposed
**Date:** 2026-11-27 (proposed)

## Context

VRP's claim is that anyone can verify an offer against the host's own domain.
One way to do that is a verifier that runs in a web page: this site's
[/verify](https://vacationrentalprotocol.com/verify) fetches a node's discovery
document, its JWKS and an offer, and checks the signature with the browser's
own Web Crypto. No server of ours sees the request.

A browser lets a page read a response from another origin only under the
browser's own rule. The Fetch standard (Living Standard, last updated
20 November 2026) says of the response header:

> `Access-Control-Allow-Origin` Indicates whether the response can be shared,
> via returning the literal value of the `Origin` request header (which can be
> `null`) or `*` in a response.

and its "CORS check" (§4.10) reads:

> Let *origin* be the result of getting `Access-Control-Allow-Origin` from
> *response*'s header list. If *origin* is null, then return failure. […] If
> *request*'s credentials mode is not "include" and *origin* is `*`, then
> return success.

`spec/v0.1.md` said nothing about this for any of the three responses. Neither
did `/implement` or the implementation guide until 2026-11-26.

What that led to. An independent signing node listed in `IMPLEMENTATIONS.md`
sent `Access-Control-Allow-Origin: *` on its two `.well-known` files and not on
its offer endpoint. The header was set at the web server for that one
directory; the offer endpoint lives at another path. The verify page fetched
the discovery document and the keys and was stopped at the offer. The
signature was valid: the same offer verified outside a browser. The node's
operator added the header to the endpoint itself within a day of the report.
Measured in a browser afterwards (2026-11-26 18:03 UTC): all three responses
carry the header and the page reads the offer.

The implementer had followed our texts. The gap was ours.

## Decision

**D1. A SHOULD in §4.** A node SHOULD send `Access-Control-Allow-Origin: *` on
every response from the verified stay offer endpoint, error responses
included, and on the discovery document and the JWKS. The paragraph says why:
the three are public and are fetched without credentials. It also says what
happens without the header: the node stays verifiable by a verifier that does
not run in a browser, and a verifier in a browser has a blocked fetch, which
§9 already names as unknown, never negated.

**D2. §2 and §3 point to it.** One sentence each: a node SHOULD serve the
discovery document, and the JWKS, so that a verifier running in a browser can
read it (§4).

**D3. SHOULD, not MUST.** A verifier that does not run in a browser needs no
such header, and the signature, the freshness and the binding to the domain
do not depend on it. A MUST would make a node non-conforming for a property
that only one kind of verifier needs. Core already has one SHOULD about a
response header, `Cache-Control` on the JWKS (§3.1).

**D4. The value is `*`.** The three responses are public. A page fetches them
without credentials, and with `*` a browser refuses a credentialed read in any
case. A header that names one origin shares the response with that origin
only, which makes one verifier the reader of record; that is not what a node
with no gatekeeper wants (ADR 0002). A verifier that sends only
CORS-safelisted request headers causes no preflight request, so this record
says nothing about `OPTIONS`.

**D5. Conformance vectors and a checker.**
`examples/conformance/browser-readable/vectors.json` (10 cases: the header as
`*` on every response; set for `/.well-known/` only; absent; present on the
offer and absent on its error response; one origin named; `null`; sent twice;
two values; empty; lower-case name and padded value), checked by
`scripts/verify-browser-readable.mjs` in `npm test`. The same script has a
live mode, `--live <domain>`, that fetches a node's discovery document, JWKS,
an offer and the endpoint's answer to an empty request, one request a second,
and reports the header on each response, redirects included.

**D6. The guide and `/implement` say the same.** The section "Readable in a
Browser" in `docs/implement-vrp.md` and the two lines on `/implement` called
the header guidance that Core did not require. They now cite §4.

## Consequences

- **Version class.** A backward-compatible addition under GOVERNANCE.md §5. No
  verifier accepts or refuses anything it did not before, and no node stops
  conforming: a SHOULD that a node does not follow leaves it a VRP node. The
  text changes within the v0.1 public draft; `protocol_version` stays `0.1`.
- **Known nodes, measured.** The two signing nodes in `IMPLEMENTATIONS.md`,
  checked with the live mode on 2026-11-27 (01:36 and 01:37 UTC): both send
  `Access-Control-Allow-Origin: *` on the discovery document, the JWKS, an
  offer and the 400 answer to an empty request. Neither has anything to change.
- **Substantive** under GOVERNANCE.md §4: the change adds normative text, so it
  takes this record, a review period of at least seven days, and approval from
  two maintainers while two are active.
- **Migration path.** None is required. A node that wants to be verifiable from
  a web page sends the header where each endpoint is served, not for one
  directory.
- **Verifiers.** A verifier outside a browser is unaffected.
  `vacationrentalprotocol/vrp-verify` does not change. The site's verify page
  already reports a blocked fetch as a fetch that failed, and names
  cross-origin blocking as a possible cause; it does not call the signature
  invalid.
- The IETF draft keeps the old wording until its next revision.
- Open pull requests that prepare a later text of the specification need the
  same paragraph if this record is accepted before they are.
- Neutrality: the rule applies to every node alike, the reference
  implementation included (ADR 0002).
