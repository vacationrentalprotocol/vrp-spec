// Builds examples/conformance/host-domain/vectors.v0.1.json (spec/v0.1.md §2,
// §5.1, §7; ADR 0009). Called by scripts/generate-conformance-vectors.mjs; the
// output is deterministic (Ed25519 signatures are), so regenerating changes
// nothing unless an input changed.
//
// No vector fetches anything. The host_owned, offer_binding, node_url and
// redirects groups use reserved names (RFC 2606, RFC 6761) or names that only
// exercise suffix rules; real_world names real platforms and top-level domains
// as the Public Suffix List and ICANN's gTLD list record them.

import { CANONICAL_DOMAIN, KID, baseOffer, jwks, signOffer } from "./conformance.mjs";
import { CLOSED_TLDS } from "./verify-host-domain.mjs";

const OTHER = "other-host.invalid";

function envelope(offer) {
  return {
    kind: "signed_verified_stay_offer",
    protocol_version: "0.1",
    offer,
    signature: { format: "jws_compact", alg: "EdDSA", kid: KID, jws: signOffer(offer) },
  };
}

const offerNamingOther = {
  ...baseOffer,
  canonical_domain: OTHER,
  node_id: OTHER,
  property: { ...baseOffer.property, url: `https://${OTHER}/` },
  booking: { direct_booking_url: `https://${OTHER}/book?offer_id=test-vector` },
};

const domain = (canonical_domain, reason, note, extra = {}) => ({
  canonical_domain,
  ...extra,
  note,
  expected: { reason },
});

const nodeUrl = (field, url, reason, note) => ({
  canonical_domain: CANONICAL_DOMAIN,
  field,
  url,
  note,
  expected: { reason },
});

const redirects = (name, chain, reason, note) => ({
  name,
  canonical_domain: CANONICAL_DOMAIN,
  requested: `https://${CANONICAL_DOMAIN}/.well-known/vacation-rental.json`,
  chain,
  note,
  expected: { reason },
});

const D = CANONICAL_DOMAIN;
const WK = "/.well-known/vacation-rental.json";

export function buildHostDomainVectors() {
  return {
    name: "vrp-host-domain-vectors-v0.1",
    description:
      "Host-owned domain (§2), offer bound to the fetched domain (§7), node URLs and redirects (§2, §5.1). A verifier uses the full ICANN section of the Public Suffix List and ICANN's gTLD list; these vectors carry only the entries they depend on. expected.reason is null when the check passes.",
    sources: {
      psl: "https://publicsuffix.org/list/public_suffix_list.dat (read 2026-10-17: ICANN section lines 13-11245, PRIVATE section lines 11247-16571; myshopify.com 15873, wixsite.com 16462, booking 7307, hotels 8591, amazon 6959, google 8403, cn 812, 公司.cn 820)",
      icann_gtlds:
        "https://www.icann.org/resources/registries/gtlds/v2/gtlds.json (read 2026-10-17: specification13 true for amazon and google; false for booking and hotels, registry operator Booking.com B.V.)",
    },
    psl_icann_rules: ["com", "uk", "co.uk", "se", "*.ck", "!www.ck", "cn", "公司.cn", "booking", "hotels", "amazon", "google"],
    psl_private_rules: ["platform.example", "myshopify.com", "wixsite.com"],
    icann_specification13_tlds: ["amazon", "google"],
    closed_tlds: CLOSED_TLDS,
    host_owned: [
      domain("example.com", null, "one label under the ICANN suffix com"),
      domain("example.co.uk", null, "one label under the two-label ICANN suffix co.uk"),
      domain(D, null, "no ICANN rule matches .invalid, so the default rule * applies"),
      domain("xn--exmple-cua.com", null, "an internationalized name in A-label form"),
      domain("example.xn--55qx5d.cn", null, "one label under the ICANN suffix 公司.cn, compared in A-label form"),
      domain("host.example.ck", null, "the wildcard rule *.ck makes example.ck a suffix"),
      domain("www.ck", null, "the exception rule !www.ck makes www.ck registrable"),
      domain("www.example.com", "not_host_owned", "a name under the host's domain is not the node's domain"),
      domain(
        "villa.platform.example",
        "not_host_owned",
        "a name a platform hands out under its own domain; the PRIVATE-section rule platform.example does not count",
        { admitted_by_private_section: true },
      ),
      domain("com", "public_suffix", "a public suffix is not a domain anyone holds"),
      domain("co.uk", "public_suffix", "a public suffix is not a domain anyone holds"),
      domain("xn--55qx5d.cn", "public_suffix", "公司.cn is an ICANN suffix once the rule is in A-label form", {
        admitted_without_a_labels: true,
      }),
      domain("example.ck", "public_suffix", "under *.ck, example.ck is itself a suffix"),
      domain("Example.com", "malformed_domain", "canonical_domain is lowercase"),
      domain("example.com.", "malformed_domain", "no trailing dot"),
      domain("exämple.com", "malformed_domain", "internationalized names use the A-label form"),
    ],
    real_world: [
      domain("example.se", null, "a domain under the ICANN suffix se"),
      domain("villa.myshopify.com", "not_host_owned", "PRIVATE-section rule myshopify.com (a site builder's domain)", {
        admitted_by_private_section: true,
      }),
      domain("villa.wixsite.com", "not_host_owned", "PRIVATE-section rule wixsite.com (a site builder's domain)", {
        admitted_by_private_section: true,
      }),
      domain("villa.airbnb.com", "not_host_owned", "a name under a marketplace's domain"),
      domain("villa.hemmabo.com", "not_host_owned", "a name under an operator's domain, the reference implementation's included"),
      domain("annanvilla.exempelplattform.com", "not_host_owned", "a name under a platform's domain"),
      domain("villa.booking", "closed_tld", "booking: a closed top-level domain listed in §2 (Booking.com B.V.)"),
      domain("villa.hotels", "closed_tld", "hotels: a closed top-level domain listed in §2 (Booking.com B.V.)"),
      domain("villa.amazon", "closed_tld", "amazon: specification13 true in ICANN's gTLD list"),
      domain("villa.google", "closed_tld", "google: specification13 true in ICANN's gTLD list"),
    ],
    offer_binding: [
      {
        name: "offer_names_fetched_domain",
        note: "discovery, JWKS and the signed offer all name the domain they were fetched from",
        fetched_domain: D,
        discovery: { canonical_domain: D },
        jwks: jwks(),
        input: envelope(baseOffer),
        expected: { signature_valid: true, reason: null },
      },
      {
        name: "offer_names_another_domain",
        note: "the node at example-host.invalid validly signs an offer naming other-host.invalid, with a booking URL on that domain; the signature verifies, the offer is still not other-host.invalid's",
        fetched_domain: D,
        discovery: { canonical_domain: D },
        jwks: jwks(),
        input: envelope(offerNamingOther),
        expected: { signature_valid: true, reason: "offer_domain_mismatch" },
      },
      {
        name: "discovery_names_another_domain",
        note: "a discovery document fetched from example-host.invalid that declares another canonical_domain",
        fetched_domain: D,
        discovery: { canonical_domain: OTHER },
        jwks: jwks(),
        input: envelope(baseOffer),
        expected: { signature_valid: null, reason: "discovery_domain_mismatch" },
      },
    ],
    node_url: [
      nodeUrl("direct_booking_url", `https://${D}/book`, null, "the node's own domain"),
      nodeUrl("direct_booking_url", `https://www.${D}/book`, null, "www. under the node's own domain"),
      nodeUrl("direct_booking_url", "https://EXAMPLE-HOST.invalid/book", null, "hosts compare after URL parsing, which lowercases them"),
      nodeUrl("direct_booking_url", `https://${D}:443/book`, null, "an explicit default port is the default port"),
      nodeUrl("direct_booking_url", `https://book.${D}/`, "url_host_mismatch", "any other name under the node's domain"),
      nodeUrl("direct_booking_url", `https://www.www.${D}/`, "url_host_mismatch", "only one www. label"),
      nodeUrl("direct_booking_url", `https://${OTHER}/book`, "url_host_mismatch", "another node's domain"),
      nodeUrl("direct_booking_url", `https://www.${OTHER}/book`, "url_host_mismatch", "www. under another node's domain"),
      nodeUrl("direct_booking_url", `https://${D}.${OTHER}/`, "url_host_mismatch", "the node's domain as a prefix of another host"),
      nodeUrl("direct_booking_url", "https://wwwexample-host.invalid/", "url_host_mismatch", "not a www. label"),
      nodeUrl("direct_booking_url", `https://${D}@${OTHER}/`, "url_userinfo", "the node's domain as userinfo before another host"),
      nodeUrl("direct_booking_url", `https://guest@${D}/book`, "url_userinfo", "userinfo on the node's own host"),
      nodeUrl("direct_booking_url", `https://${D}:8443/book`, "url_port", "a port other than the https default"),
      nodeUrl("direct_booking_url", `http://${D}/book`, "url_not_https", "https only (§5.1)"),
      nodeUrl("direct_booking_url", "not a url", "url_invalid", "not an absolute URL"),
      nodeUrl("jwks_url", `https://${D}/.well-known/jwks.json`, null, "the JWKS on the node's own domain"),
      nodeUrl("jwks_url", `https://keys.${OTHER}/jwks.json`, "url_host_mismatch", "a JWKS on another host"),
      nodeUrl("verified_stay_offer_endpoint", `https://www.${D}/api/verified-stay-offer`, null, "the offer endpoint under www."),
      nodeUrl("verified_stay_offer_endpoint", `https://api.${D}/offer`, "url_host_mismatch", "any other name under the node's domain"),
    ],
    redirects: [
      redirects("no_redirect", [], null, "the document is served where it was requested"),
      redirects("to_www", [`https://www.${D}${WK}`], null, "the node's domain redirects to www. under it"),
      redirects("to_another_host", [`https://${OTHER}${WK}`], "redirect_off_node", "a redirect to another node's domain"),
      redirects("via_www_to_another_host", [`https://www.${D}${WK}`, `https://${OTHER}${WK}`], "redirect_off_node", "every hop counts"),
      redirects("to_http", [`http://www.${D}${WK}`], "redirect_not_https", "a redirect that leaves https"),
    ],
  };
}
