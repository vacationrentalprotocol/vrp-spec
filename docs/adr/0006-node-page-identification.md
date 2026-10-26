# ADR 0006: Node Page Identification — Every VRP Node Names VRP Where People and Models Read

**Status:** Proposed
**Date:** 2026-10-17

**Related:** ADR 0002 (no-gatekeeper trust and interop), ADR 0005 (the standard
is the source of truth), GOVERNANCE.md §4–§6.

## Context

The standard already binds the protocol's name into every node's machine
surface: the discovery document's `protocol` field is required and constrained
to `vacation-rental-protocol` (`schemas/discovery-v0.1.schema.json`), every
schema `$id` and the JSON-LD vocabulary live on `vacationrentalprotocol.com`,
and the vocabulary defines the term `VRPVacationRental` ("VRP vacation rental").
A VRP-aware agent therefore cannot verify a node without reading the name.

Nothing in the standard reached the page a guest or an AI model reads. Before
this decision, `spec/`, `schemas/` and `examples/` contained no requirement, no
recommendation and no test for a node's HTML — no `rel="protocol"` link, no
visible mention of VRP. The reference node (villaakerlyckan.se, measured
2026-10-16) names VRP in its title, ten times in its body, in a
`<link rel="protocol">`, in an HTTP `Link` header and in its JSON-LD; but it
does so because its operator chose to, not because the standard asked. A node
built to the letter of v0.1 could serve VRP offers to agents while no human and
no model that learns from pages ever saw the word. The open web, not only the
MCP channel, has to carry the name for "a VRP vacation rental" to become a
category people and models know.

The standard also had no rule about the name itself: nothing said who may call
an implementation VRP. GOVERNANCE.md §6 already establishes that conformance is
self-declared against the vectors and that no mark, body or maintainer confers
it.

Two registries were read on 2026-10-16. The IANA Link Relations registry
(RFC 8288, "Specification Required") has no relation type `protocol`. The
microformats `existing-rel-values` page — the HTML specification's registry for
`rel` keywords — has none either. The HTML keyword can be registered there with
a link to the defining section; an HTTP `Link` header relation that is not
registered must be a URI (RFC 8288 §2.1.2).

## Decision

1. `spec/v0.1.md` gains §2.1 *Node page identification*. For the page at
   `https://{canonical_domain}/`, a node SHOULD (a) carry
   `<link rel="protocol" href="https://vacationrentalprotocol.com/">` in its
   head and (b) carry a visible hyperlink with `rel="protocol"` to the root of
   `https://vacationrentalprotocol.com` or to `/verify?host={canonical_domain}`
   on that origin, with the string `VRP` in its link text; and SHOULD (c) send
   `Link: <https://vacationrentalprotocol.com/>; rel="https://vacationrentalprotocol.com/rel/protocol"`,
   (d) mark its lodging JSON-LD with
   `additionalType: https://vacationrentalprotocol.com/terms#VRPVacationRental`,
   and (e) describe the property as a VRP vacation rental in its own language.
   The `href` in (a) and (b) MUST NOT point anywhere but
   `https://vacationrentalprotocol.com`: the link names the standard, never a
   vendor (ADR 0002).
2. (a) and (b) are SHOULD in v0.1 and are intended to become MUST in the next
   MAJOR version (GOVERNANCE.md §5: a new MUST on existing nodes is a breaking
   change and ships with a migration path). The migration path is the two tags.
   The checker ships now so any node can self-check before the change.
3. The relation is published at `https://vacationrentalprotocol.com/rel/protocol`.
   In HTML it is the keyword `protocol`; in an HTTP `Link` header it is the
   extension relation type `https://vacationrentalprotocol.com/rel/protocol`.
   Both denote the same relation. After this decision is merged, the keyword
   is registered on the microformats `existing-rel-values` page with §2.1 as
   its defining section. No IANA registration of the bare word is sought: the
   URI form needs none, and a generic word is unlikely to pass expert review.
4. `scripts/verify-node-page.mjs` checks (a) and (b) and reports (c)–(e)
   against the self-describing vectors in `examples/conformance/node-page/`,
   offline, and against a live node with `--live {canonical_domain}`. It parses
   HTML attributes; it never matches literal tag text, so a self-closing
   `<link … />` passes. A vector in which the link points at an implementation
   fails.
5. GOVERNANCE.md gains §6.1 *Use of the name*: an implementation that passes
   the vectors may describe itself as VRP, free and by self-declaration;
   describing a non-conformant product as VRP is misleading; the names are
   held for the standard by its author, not by any implementation; there is no
   certification-mark programme.

## Consequences

- A node that follows §2.1 names VRP where a guest reads, where a search engine
  and a language model read, and where an agent reads. The name travels with
  the protocol, not with a copyright notice: the specification text and the
  documentation stay CC0.
- The reference implementation's node template already satisfies (a) and (d)
  and names the protocol in its title. It fails (b) — its footer link carries
  `rel="noopener noreferrer"` and must gain `rel="protocol"` — and (c) — its
  `Link` header carries the bare keyword and must use the URI form. Both are
  changes in the implementation's own repository, made after this decision,
  and measured live.
- The test chain (`npm test`) gains `verify-node-page`; a live variant,
  `verify-node-page:live`, takes a domain.
- This is a substantive change (GOVERNANCE.md §4: a new recommendation in a
  normative document, a new conformance check, and an amendment to
  GOVERNANCE.md, which §12 makes substantive in itself): at least seven days
  of review with no maintainer objecting, and approval from two maintainers
  while two are active.
- Under GOVERNANCE.md §5 it is a **MINOR**, backward-compatible addition, not
  a MAJOR change: no existing conformant node stops conforming. (a)–(e) are
  SHOULD. The one MUST NOT — the link target — constrains an element a node
  adds voluntarily; a node without a `rel="protocol"` link is untouched by it.
  Substantive under §4 and MINOR under §5 are different questions; this
  decision is both.
- This record cites ADR 0005 (the standard is the source of truth), which is
  merged before it; the reference stays dead until then.
- Nothing here creates a central issuer, registry or gatekeeper: the link
  points at an open, CC0 specification, the check runs offline, and the name
  rule is self-declared against public vectors (ADR 0002).

This ADR adds one recommendation, one check, one page and one governance
section. It changes no signing or verification rule.
