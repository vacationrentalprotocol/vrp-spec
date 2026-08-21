# Implementations

VRP is an open, CC0-licensed specification. Anyone may implement it — there is
no registration, no approval step, and no gatekeeper. This page lists known
implementations and explains how to add yours.

## Known implementations

| Implementation | Type | License | Notes |
| --- | --- | --- | --- |
| [hemmabo-mcp-server](https://github.com/HemmaBo-se/hemmabo-mcp-server) | Reference implementation (MCP server, verifier) | Apache-2.0 | Maintained by HemmaBo, the commercial reference implementer (disclosed in [MAINTAINERS.md](MAINTAINERS.md)) |
| [villaakerlyckan.se](https://villaakerlyckan.se/.well-known/vacation-rental.json) | Live production node | — | Serves signed offers and a JWKS on its own domain |

An independent implementation — a verifier or a node not operated by the
reference implementer — is exactly what this page exists to welcome.

## Implement a verifier

A minimal conforming verifier needs only Ed25519 signature verification and
JSON parsing, both available in the standard library of most modern runtimes.

1. Read the wire format and verification rules in [spec/v0.1.md](spec/v0.1.md)
   (§5 Signed Offer, §6 Freshness, §7 Safe-to-Quote, §8 Fail-Closed).
2. Run your implementation against the self-describing conformance vectors:
   - [examples/conformance/offer/](examples/conformance/offer/) — signed-offer
     verification and freshness, `{ name, description, clock, jwks, input, expected }`
   - [examples/conformance/receipt/](examples/conformance/receipt/) — receipt
     envelopes, same self-describing shape
   Each vector embeds its own key set, evaluation clock, and expected outcome —
   no network access and no reading of this repository's JavaScript required.
3. Every vector must produce the vector's `expected` outcome.

## Implement a node

A node publishes a discovery document, a JWKS, and a signed-offer endpoint on
its own domain. Start with [docs/implement-vrp.md](docs/implement-vrp.md).

## Get listed

Open a pull request adding a row to the table above, or open an issue with a
link to your implementation. The only requirement for a verifier is that it
passes the committed conformance vectors; for a node, that its discovery
document, JWKS, and signed offers verify. Decision process per
[GOVERNANCE.md](GOVERNANCE.md).
