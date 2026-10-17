# ADR 0009: Host-Owned Domain and Offer Binding

**Status:** Proposed
**Date:** 2026-10-17 (proposed)

## Context

VRP's claim is that a stay offer is real because the host's own domain signed it
(ADR 0002). On `main` at `7a05d24`, four places in `spec/v0.1.md` left that claim
open:

1. **"Host-owned" was undefined.** §2 required `canonical_domain` to "match the
   host-owned domain being verified" but never said what a host-owned domain is.
   A name that a platform hands out under its own domain could be read as one.
   The [Public Suffix List](https://publicsuffix.org/list/) shows why a rule must
   say which part of the list counts: its PRIVATE section (read 2026-10-17, lines
   11247–16571) lists domains under which a company hands out names to its
   customers, site builders and hosting platforms among them (for example
   `myshopify.com`, `wixsite.com`, `webflow.io`, `github.io`, `vercel.app`,
   `netlify.app`). A rule based on the whole list would accept those customers'
   names as their own domains.
2. **The booking URL could leave the node.** §5.1 allowed `direct_booking_url` on
   "a subdomain of that registrable domain" (since 2026-06-08, `ce91e25`). When
   `canonical_domain` is itself a name under a shared domain, its registrable
   domain is the platform's, so every other customer's name passed. A separate
   clause named one operator and stopped that one case only.
3. **The offer was not bound to its domain.** §2 bound the discovery document to
   the fetched domain, and §5.1 bound the booking URL to the offer's *own*
   `canonical_domain`, but no rule bound the signed offer to the domain it was
   fetched from. The node at one domain could sign an offer naming another domain,
   with a booking URL on that other domain; fetched from the signing node, it met
   all eleven conditions of §7, and an agent could present it as the other
   domain's official offer.
4. **§7 had no keywords.** It said "may quote … only when". That is normative
   text in plain English (RFC 8174 §2), but §1.1 now declares BCP 14 and the
   conditions are clearer in capitals.

The IETF draft `ietf/draft-abbas-vrp-offer-verification-00` has the same wording
(lines 173, 213 and 453 of the `.txt`).

## Decision

**D1. Host-owned domain (§2).** `canonical_domain` MUST be lowercase ASCII, with
internationalized labels in A-label form and no trailing dot, and MUST equal its
own registrable domain as computed by the Public Suffix List algorithm using only
the ICANN section (the default rule `*` applies where no ICANN rule matches). The
PRIVATE section does not count. A name under a platform, catalog, marketplace,
OTA, site builder or operator domain is never a `canonical_domain`, whoever
operates that domain. A verifier that holds no copy of the ICANN section treats
the node as unknown.

**D2. Offer binding (§7).** The discovery document's `canonical_domain` is the
domain it was fetched from, and the signed payload's `canonical_domain` is the
domain the discovery document was fetched from. A valid signature
over an offer that names another domain is not that domain's offer.

**D3. Booking URL host (§5.1).** The host of `direct_booking_url` is the offer's
`canonical_domain` or `www.` followed by it, and no other name. The
registrable-domain wording and the clause naming one operator are replaced by
this general rule, which names no company.

**D4. §7 in BCP 14 form.** "An agent MUST NOT quote … unless all of the following
are true", with the binding as its own condition; §8 lists the binding among what
must be verified.

**D5. Conformance vectors.** `examples/conformance/host-domain/vectors.v0.1.json`
(14 host-owned-domain cases, 3 offer-binding cases with real signatures, 12
booking-host cases), checked by `scripts/verify-host-domain.mjs` in `npm test`.

## Consequences

- **Version class.** D1–D3 change the rules a verifier uses to accept an offer.
  GOVERNANCE.md §5 classes such a change as MAJOR and requires an explicit ADR
  and a migration path. This record applies it to the v0.1 public draft without
  changing `protocol_version`: it removes acceptance only of offers that no
  host-owned node could legitimately produce, and the known production node
  already conforms (measured 2026-10-17: `canonical_domain` and the signed
  booking URL on the node's own registered domain). The maintainers decide at
  approval (§4) whether it lands in v0.1 or waits for v0.2.
- **Substantive** under GOVERNANCE.md §4: this record, seven days of review and
  two approvals while two maintainers are active.
- **Migration path.** A node whose `canonical_domain` is a name under another
  party's domain moves to a domain registered for the host. A booking URL on
  another name under the node's domain moves to the node's domain or `www.`.
  Verifiers add the ICANN-section check and the binding check.
  `vacationrentalprotocol/vrp-verify` (which accepts any name under
  `canonical_domain`) and the reference implementation follow in their own
  repositories.
- A verifier now needs a copy of the ICANN section of the Public Suffix List.
  The list changes; the default rule `*` keeps a new top-level domain
  registrable in an older copy.
- The IETF draft keeps the old wording until its next revision.
- Neutrality: the rule applies to every operator equally, the operator of any
  implementation included (ADR 0002).
