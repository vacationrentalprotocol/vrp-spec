# ADR 0009: Host-Owned Domain and Offer Binding

**Status:** Accepted
**Date:** 2026-10-17 (proposed) · accepted with [ADR 0013](0013-vrp-1-0.md)

## Context

VRP's claim is that a stay offer is real because the host's own domain signed it
(ADR 0002). On `main` at `7a05d24`, `spec/v0.1.md` left that claim open in these
places:

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
2. **Brand and closed top-level domains.** The ICANN section also holds
   top-level domains run by one company for its own business. `booking` and
   `hotels` (registry operator Booking.com B.V., PSL lines 7305–7307 and
   8589–8591), `amazon` and `google` are among them. Under such a top-level
   domain every name belongs to its operator, so a rule based on the ICANN
   section alone would accept `villa.booking`. ICANN's gTLD list
   (<https://www.icann.org/resources/registries/gtlds/v2/gtlds.json>, read
   2026-10-17) marks 369 brand top-level domains with `"specification13": true`,
   `amazon` and `google` among them, but not `booking` or `hotels`. ICANN
   publishes no single machine-readable list of the other closed top-level
   domains; their Code of Conduct exemptions are separate documents per domain.
3. **The booking URL could leave the node.** §5.1 allowed `direct_booking_url` on
   "a subdomain of that registrable domain" (since 2026-06-08, `ce91e25`). When
   `canonical_domain` is itself a name under a shared domain, its registrable
   domain is the platform's, so every other customer's name passed. A separate
   clause named one operator and stopped that one case only. Userinfo and a
   non-default port were not addressed.
4. **The node's own URLs were not bound.** `jwks_url` and
   `verified_stay_offer_endpoint` had to "point to the host-domain" resource, a
   phrase with no test, and nothing said what "fetched from" means when a fetch
   is redirected.
5. **The offer was not bound to its domain.** §2 bound the discovery document to
   the fetched domain, and §5.1 bound the booking URL to the offer's *own*
   `canonical_domain`, but no rule bound the signed offer to the domain it was
   fetched from. The node at one domain could sign an offer naming another domain,
   with a booking URL on that other domain; fetched from the signing node, it met
   all eleven conditions of §7, and an agent could present it as the other
   domain's official offer.
6. **§7 had no keywords.** It said "may quote … only when". That is normative
   text in plain English (RFC 8174 §2), but §1.1 now declares BCP 14 and the
   conditions are clearer in capitals.
7. **The site verifiers** (`verify.html`, `verify-receipt.html`) checked none of
   the domain rules, so an offer or a receipt from a platform-issued name could be
   shown as verified there. `verify.html` never read the discovery document, and
   both pages tried a key other than the one named when the JWS header carried no
   `kid` (`verify.html` also when the `kid` was unknown).

The IETF draft `ietf/draft-abbas-vrp-offer-verification-00` has the same wording
(lines 173, 213 and 453 of the `.txt`).

## Decision

**D1. Host-owned domain (§2).** `canonical_domain` MUST (1) be lowercase ASCII,
with internationalized labels in A-label form and no trailing dot; (2) equal its
own registrable domain as computed by the Public Suffix List algorithm using only
the ICANN section, each rule compared in A-label form, with the default rule `*`
where no ICANN rule matches; and (3) not be under a brand or closed top-level
domain: one marked `"specification13": true` in ICANN's gTLD list, or one named
in §2, which today names `booking` and `hotels`. That list changes only by ADR.
The PRIVATE section does not count. A name under a platform, catalog,
marketplace, OTA, site builder or operator domain is never a `canonical_domain`,
whoever operates that domain. A verifier that holds no copy of either list treats
the node as unknown.

**D2. Node URL and fetching (§2).** A node URL is an absolute `https` URL whose
host is `canonical_domain` or `www.` followed by it, with no userinfo and no port
other than the `https` default. `jwks_url` and `verified_stay_offer_endpoint`
are node URLs. "Fetched from" is the host of the URL the verifier requested; a
verifier follows a redirect only to a node URL and treats anything else as
unknown.

**D3. Offer binding (§7).** The discovery document's `canonical_domain` is the
domain it was fetched from, and the signed payload's `canonical_domain` is the
domain the discovery document was fetched from. A valid signature over an offer
that names another domain is not that domain's offer.

**D4. Booking URL (§5.1).** `direct_booking_url` is a node URL of the offer's
`canonical_domain`. The registrable-domain wording and the clause naming one
operator are replaced by this general rule.

**D5. §7 in BCP 14 form.** "An agent MUST NOT quote … unless all of the following
are true", with the binding as its own condition; §8 lists the binding among what
must be verified.

**D6. Before 1.0 (GOVERNANCE.md §5).** GOVERNANCE.md §5 gains a paragraph: while
VRP is below 1.0, a correction that closes a security gap may be made within the
current draft version without changing `protocol_version`, with an ADR that
states the gap, what stops being accepted, which known nodes are affected and
the migration path. Semantic versioning reserves major version zero for initial
development ("Anything MAY change at any time", semver 2.0.0 item 4). Under
GOVERNANCE.md §12 this amendment is itself substantive, and this record is its
ADR.

**D7. Conformance vectors and the site verifiers.**
`examples/conformance/host-domain/vectors.v0.1.json` (53 cases in five groups,
three with real Ed25519 signatures), checked by `scripts/verify-host-domain.mjs`
in `npm test`. `verify.html` and `verify-receipt.html` fetch both lists live from
their publishers (both serve `Access-Control-Allow-Origin: *`) and show
"unknown" when a list cannot be fetched. Both pages follow no redirect from a
node: a browser cannot see where a redirect points, so a redirect is "unknown".
Both select the key only by the `kid` in the JWS header (§3.1).

- `verify.html`, live offer: D1–D4. It fetches the discovery document from the
  domain typed, requires its `protocol`, `protocol_version` and
  `canonical_domain`, takes `jwks_url` and the offer endpoint from it only when
  both are node URLs, and requires the signed `canonical_domain` to be that
  domain and the booking URL to be a node URL.
- `verify.html`, pasted offer: D1, D2, D4 and the discovery half of D3, for the
  domain the offer names. A pasted offer can come from anywhere, so the page
  never shows one as safe to quote.
- `verify-receipt.html`: D1 for the issuer domain. Nothing is fetched from a
  name that fails D1; when the lists cannot be fetched, the page still checks
  the signature, and the result is unknown. The receipt's `subject.node` and
  `issuer.did`, when present, must name the domain that signed it: `subject.node`
  equal to it, `issuer.did` a `did:web` whose host is it (a leading `www.`
  ignored on both). Otherwise the receipt is not verified. "Booked directly at"
  shows the domain that signed it, not the name the receipt gives. Receipt v1 §3
  defines `subject` and `issuer` as generic objects; these are the field names
  the page reads today. Which fields identify the node is not decided here.
- `demo.html` and `implement.html` also select the key only by `kid`.

The pages were checked in a browser during review, with every request answered
locally; the cases are listed in the pull request. That browser test is not
part of this repository or of `npm test`.

## Consequences

- **Version class.** D1–D4 change what a verifier accepts, a MAJOR-class change
  under GOVERNANCE.md §5. It is made within the v0.1 public draft under the new
  "Before 1.0" paragraph (D6). What stops being accepted: names under another
  party's domain or under a brand or closed top-level domain; booking, JWKS and
  offer-endpoint URLs on any other name than the node's domain or `www.` under
  it, with userinfo or with a non-default port; redirects off those names; offers
  naming another domain than the one fetched. Known nodes affected: none — the
  known production node, measured 2026-10-17, serves its discovery document,
  `jwks_url`, offer endpoint and signed booking URL on its own registered domain
  (apex), and the site verifier passes it.
- **Substantive** under GOVERNANCE.md §4 and §12: this record, seven days of
  review and two approvals while two maintainers are active.
- **Migration path.** A node whose `canonical_domain` is a name under another
  party's domain, or under a brand or closed top-level domain, moves to a domain
  registered for the host. A booking URL, `jwks_url` or offer endpoint on another
  name, with userinfo or with a non-default port, moves to the node's domain or
  `www.`. Verifiers add the list checks, the node-URL and redirect checks and the
  binding check. `vacationrentalprotocol/vrp-verify` (which accepts any name
  under `canonical_domain`) and the reference implementation follow in their own
  repositories.
- **Residual gap.** A closed top-level domain that ICANN's gTLD list does not
  mark and §2 does not name is excluded by the rule's wording but not by a
  program. Adding one to §2 takes an ADR that names its registry operator and the
  source.
- A verifier now needs two public lists. Both change; the default rule `*` keeps
  a new top-level domain registrable in an older copy of the suffix list.
- The IETF draft keeps the old wording until its next revision.
- Neutrality: the rule applies to every operator equally, the operator of any
  implementation included (ADR 0002). The two named top-level domains are named
  because the public lists do not mark them, not to single out a company.
