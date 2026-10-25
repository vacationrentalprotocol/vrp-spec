# VRP Node Tool Binding — Specification v0.1

**Status:** Public draft — **proposal for discussion** (tracks
[issue #156](https://github.com/vacationrentalprotocol/vrp-spec/issues/156)).
Additive by construction: Core v0.1 defines documents and verification rules,
not runtime tools, and that does not change here. This document binds the one
name and the one argument shape a node uses when it chooses to expose its
signed offer as a tool. A node that exposes no tool surface is unaffected, and
nothing here changes what a v0.1 verifier MUST do today.

**Published:** 2026-10-21

**Repository:** https://github.com/vacationrentalprotocol/vrp-spec

**Builds on:** [Core VRP v0.1](./v0.1.md) (§2 discovery document, §3 JWKS,
§4 endpoint parameters, §5 signed offer, §5.1 `direct_booking_url`, §6–§9
freshness, safe-to-quote, fail-closed, three-state verification),
[Well-Known URI v0.1](./well-known-uri-v0.1.md),
[MCP composition profile](./profiles/mcp-composition-profile.md) (the tool
name in the transport assertion, `snake_case` argument keys).

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
document are to be interpreted as described in BCP 14
([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119),
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they
appear in all capitals, as shown here.

## 1. Scope

A VRP node publishes its facts as documents on its own domain (Core v0.1).
Agents increasingly reach a site through tool-calling surfaces as well: a
Model Context Protocol (MCP) server, an Agent2Agent (A2A) agent card, or a
tool a page registers in the browser through WebMCP. Each surface has its own
way to name a capability. Without a binding, the same node would call the same
capability by three names, and an agent that learned one would not recognise
the other two. Left to implementers, the name becomes an operator's instead of
the protocol's.

This document binds, for every tool surface a node exposes:

- the **name** of the capability that returns the node's signed verified stay
  offer (§3);
- its **arguments** (§4);
- its **result** (§5);
- the **origin** the surface is served from (§6);
- who may use the name (§7).

Out of scope: how an agent finds a node (StayIntent discovery, open-web
search), search or ranking of any kind, payment, and any tool other than the
one bound here. A node MAY expose other tools under names of its own choosing;
this document does not name them.

## 2. Terms

- **Node**: a host-owned VRP node as in Core v0.1: one `canonical_domain`,
  one discovery document, one JWKS, one verified stay offer endpoint.
- **Tool surface** (surface): a machine interface on which a node lists
  callable capabilities. This version binds three: MCP (`tools/list` on the
  node's MCP endpoint), A2A (the `skills` array of the node's agent card) and
  WebMCP (a tool the node's page registers with the browser's model context).
- **Node tool**: a tool served by the node itself, from the node's own domain,
  returning the node's own signed offer.
- **Operator tool**: a tool served by any party other than the node (a
  platform, a verifier, a directory) that fetches or verifies a node's offer.

## 3. The capability name

The capability that returns the node's signed verified stay offer is named:

```text
get_verified_stay_offer
```

- A node that exposes this capability on any tool surface MUST use this exact
  name on that surface, and MUST use the same name on every surface it
  exposes.
- The name MUST appear exactly as written: lowercase, `snake_case`, no prefix,
  no suffix, no version, no vendor, operator, brand or domain string.
  `acme_get_verified_stay_offer`, `example_com_get_verified_stay_offer` and
  `get_verified_stay_offer_v1` are not this capability.
- Where a surface has more than one name-like field, the binding is to the
  field a client uses to **call** the capability:

| Surface | Field bound to the name | Where it is defined |
| --- | --- | --- |
| MCP | `name` of the tool in the `tools/list` result, the `name` a `tools/call` request carries | Model Context Protocol, Tools |
| A2A | `id` of the skill in the agent card's `skills[]` | Agent2Agent Protocol, AgentCard and AgentSkill |
| WebMCP | `name` passed to `registerTool()` | Web Model Context API (W3C Web Machine Learning Community Group draft) |

- Human-readable fields next to the bound one (MCP `title` and
  `annotations.title`, A2A skill `name`, every `description`) are not bound and
  MAY be localised.

**Why no prefix.** The name identifies a protocol capability, not an operator.
The node's identity is its domain, and every surface already carries that
domain: the MCP endpoint URL, the agent card's endpoint URL and the host that
served the card, the page's origin. Putting the domain or the operator into
the name would say the same thing twice and would make every node's capability
a different word. Clients tell same-named tools apart by the server they came
from: MCP leaves that disambiguation to the client, and WebMCP requires a name
to be unique within one document, not across the web.

## 4. Arguments

The capability takes the parameters of the verified stay offer endpoint
(Core v0.1 §4), with the same names and formats:

| Argument | Type | Requirement |
| --- | --- | --- |
| `check_in` | string, `YYYY-MM-DD` | REQUIRED |
| `check_out` | string, `YYYY-MM-DD` | REQUIRED |
| `guests` | integer, at least 1 | REQUIRED |

- Keys are `snake_case`, as in Core v0.1 §4 and the MCP composition profile's
  normative casing section. A node MAY additionally accept the `camelCase`
  aliases `checkIn` and `checkOut` that `direct_booking_url` query strings use
  (Core §5.1), but MUST accept the `snake_case` form.
- A node MUST NOT require any other argument. It MAY accept optional ones.
- On every surface the arguments are one JSON object with these keys: the
  `arguments` of an MCP `tools/call`, the single data part of an A2A message,
  the input of a WebMCP `execute()`.

## 5. Result

- The result is the node's **signed verified stay offer envelope** for exactly
  these arguments: the same envelope the verified stay offer endpoint returns
  (Core §4–§5), with `offer` (the signed payload) and `signature` (`format`,
  `alg: EdDSA`, `kid`, `jws`) as
  [`schemas/verified-stay-offer-v0.1.schema.json`](../schemas/verified-stay-offer-v0.1.schema.json)
  pins them.
- The node MUST return the envelope unmodified, as signed. The tool is a
  transport for the signed document, not a second source of truth: it MUST NOT
  replace the signature with a verdict, a summary or a re-serialised payload.
- The node MUST NOT claim in the tool's description or result that the offer
  is verified. Verification is the agent's (§8). The description SHOULD say
  that the tool does not verify the signature and SHOULD name the node's JWKS
  path.
- Per surface: MCP returns the envelope as the `tools/call` result content
  (JSON text and, where the client supports it, `structuredContent`); A2A
  returns it as a data part of the task's artifact or message; WebMCP returns
  it as the `execute()` return value.
- Unavailable dates, a closed property or a rejected request are expressed as
  Core v0.1 expresses them (a non-quoteable offer under §7, or the endpoint's
  own error); the tool MUST NOT invent an offer. An error on the surface
  itself (an MCP result with `isError`, a failed A2A task, a rejected WebMCP
  promise) is an unverified outcome: the agent MUST NOT quote anything from
  it.

## 6. Origin binding

The tool surface and the offer are on the same domain:

- The MCP endpoint URL's host, the agent card's endpoint host and the host
  that served the card, and the page origin that registered the WebMCP tool
  MUST be the offer's `canonical_domain` or a subdomain of it, the rule Core
  §5.1 sets for `direct_booking_url`.
- An agent MUST check that the offer's `canonical_domain` is the domain that
  served the surface. An offer that arrives through a surface on another
  domain is an operator tool's result (§7) and MUST be treated as such,
  whatever the tool is named.
- The JWKS the agent verifies against is the one the node's own discovery
  document names (`jwks_url`, Core §2), fetched from the node's domain, never
  a key set delivered through the tool surface.

## 7. Who may use the name

- Only a node tool (§2) MAY be advertised under the name
  `get_verified_stay_offer`.
- An operator tool MUST NOT be advertised under this name on the operator's
  tool list, card or page. It SHOULD carry a name in the operator's own
  namespace, so an agent can tell a node's own voice from a third party's.
  Accepting the bare name inbound as a compatibility alias, without listing
  it, is not advertising.
- The name is part of the protocol, not of any implementation. No operator,
  the reference implementer included, has a say over it beyond this
  repository's process ([GOVERNANCE.md](../GOVERNANCE.md)).

## 8. Verification is the agent's

Nothing on a tool surface is a trust signal: not the name, not the
description, not the annotations, not a signature on the card, not the
transport. An agent:

1. MUST verify the returned envelope's signature against the JWKS the node's
   discovery document names (Core §3, §9), exactly as it would for an envelope
   fetched over HTTPS;
2. MUST apply the freshness, safe-to-quote and fail-closed rules
   (Core §6–§8);
3. MUST take the guest to the `direct_booking_url` inside the verified
   payload, and to nothing else (Core §5.1);
4. SHOULD treat tool descriptions as untrusted text.

A tool call is not a signed artifact (MCP composition profile). It is one more
way to fetch the signed document.

## 9. Where the surfaces live (informative)

This version adds no field to the discovery document. Agents find a node's
surfaces by each surface's own convention:

- A2A: the agent card at `/.well-known/agent-card.json` on the node's domain.
- MCP: the node's MCP endpoint URL, published where the node's clients read
  it (MCP's own discovery conventions were still drafts at the time of
  writing), always on the node's domain.
- WebMCP: the node's own pages, when loaded in a browser that implements the
  API.

A future revision MAY add an optional discovery field that lists a node's
surfaces.

## 10. Conformance

A node conforms to this document when, for every tool surface it exposes:

1. the surface lists exactly one capability named `get_verified_stay_offer`
   (§3);
2. that capability takes `check_in`, `check_out` and `guests`, and requires
   nothing else (§4);
3. its result for given arguments is the same signed envelope the node's
   verified stay offer endpoint returns for the same arguments, and that
   envelope verifies against the node's JWKS with `canonical_domain` equal to
   the surface's domain (§5, §6).

The name check is three reads of the node and one comparison: the MCP tool
list, the agent card's skill ids and the page's registered tool name are
either one string or they are not. Conformance vectors for this document (a
node's three surfaces and the expected outcome) are to be added to
[`examples/conformance/`](../examples/conformance/) before it leaves proposal
status (GOVERNANCE.md §4, §6).

## 11. Security considerations

- **Name squatting.** Any server can list a tool called
  `get_verified_stay_offer`. The name proves nothing; §6 and §8 do. An agent
  that trusts a tool because of its name has left the protocol.
- **Description injection.** Tool descriptions, skill descriptions and card
  text are attacker-controlled on a hostile server. Agents SHOULD treat them
  as data.
- **Cross-origin offers.** A surface on domain A that returns an offer whose
  `canonical_domain` is B is not A's node tool (§6). The offer may still
  verify against B's JWKS; it is then B's offer, obtained through A, and A's
  surface is an operator tool.
- **Duplicate registration.** WebMCP rejects a second registration under a
  name already registered in the document; a node page registers the
  capability once.
- **Keys.** Nothing here moves a key. The node signs with the same key as its
  endpoint (Core §3); rotation and revocation are Core §3.1.

## 12. Privacy considerations

The arguments are two dates and a guest count, as in Core §4 and §15. A node
MUST NOT require guest-identifying input to return the offer. An agent SHOULD
NOT send more than the three arguments.

## 13. Relationship to other documents

- **MCP composition profile.** The receipt's `transport` attestation names the
  tool that served the offer (`"tool": "get_verified_stay_offer"`). This
  document is where that name is bound, so an assertion and a surface agree by
  construction.
- **UCP.** The Universal Commerce Protocol binds its capability names
  one-to-one to the tools that carry them; this document takes the same
  approach for one VRP capability.
- **Core v0.1** stays the only source of what the envelope means and how it
  is verified.

## 14. Reference implementation (informative)

The reference node, `villaakerlyckan.se`, exposes the capability on all three
surfaces under the bound name, with the arguments of §4 and the result of §5.
Read from production on 2026-10-21 (UTC): the node's MCP manifest, its agent
card and its page name the capability `get_verified_stay_offer`, one string on
all three. The platform that operates the node lists its own offer tool under
an operator-namespaced name (`vrp_get_verified_stay_offer`), per §7. HemmaBo is
a reference implementer, not an approval authority.

## 15. Open questions (for discussion in #156)

1. Should the discovery document gain an optional field that lists a node's
   tool surfaces, or is each surface's own well-known convention enough?
2. Should the WebMCP binding also bind the `inputSchema` byte for byte, or
   only the three argument names and types?
3. Should operator tools be required (MUST) rather than recommended (SHOULD)
   to carry a namespace prefix?

## 16. Neutrality

The spec is vendor-neutral. HemmaBo is a reference implementer, not an
approval authority. Any node, on any stack, can expose the capability under
this name, and any agent can verify the result without permission from anyone.

## 17. License

Specification text: dedicated to the public domain under [CC0 1.0](../LICENSE).
