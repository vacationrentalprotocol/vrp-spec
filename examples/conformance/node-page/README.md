# VRP node page vectors

Apache-2.0 — see [`LICENSE-CODE`](../../../LICENSE-CODE).

These vectors exercise [spec/v0.1.md §2.1 *Node page identification*](../../../spec/v0.1.md)
([ADR 0006](../../../docs/adr/0006-node-page-identification.md)): the page at
`https://{canonical_domain}/` names the protocol where people and models read —
(a) `<link rel="protocol" href="https://vacationrentalprotocol.com/">` in the head
and (b) a visible `<a rel="protocol">` in the body, on the standard's origin, with
`VRP` in its text. In v0.1 both are SHOULD; the vectors decide what *passing* means.

`vectors.json` is the manifest: one entry per file with the node's
`canonical_domain` and the expected outcome of (a), (b) and the overall pass.
Every page is a complete, minimal HTML document for the fictitious node
`example-host.invalid`; nothing in it names an implementation.

| File | Expect | Why |
| --- | --- | --- |
| `positive.html` | pass | head link; visible footer link to the root, text `VRP` |
| `positive-self-closing.html` | pass | `<link … />` self-closing; footer link to `/verify?host=example-host.invalid`; `rel="protocol noopener"` |
| `negative-missing-head-link.html` | fail (a) | no head link |
| `negative-no-visible-link.html` | fail (b) | the footer link lacks `rel="protocol"` |
| `negative-link-to-implementation.html` | fail (b) | the link points at a platform, not the standard |
| `negative-text-without-vrp.html` | fail (b) | the link text does not contain `VRP` |
| `negative-hidden-link.html` | fail (b) | the link is `hidden` |
| `negative-verify-wrong-host.html` | fail (b) | `/verify?host=` names another node |

Run them: `npm run verify-node-page` (part of `npm test`). Check a live node:
`npm run verify-node-page:live -- example-host.invalid` — it also reports the
SHOULD-level (c) `Link` header, (d) JSON-LD `additionalType` and (e) title.

The checker reads attributes, never literal tag text: attribute order,
quoting and self-closing syntax do not matter. It cannot render a page; a link
is treated as visible unless it carries `hidden`, `aria-hidden="true"` or an
inline `display: none`.
