// Builds examples/conformance/host-domain/vectors.v0.1.json (spec/v0.1.md §2,
// §5.1, §7; ADR 0009). Called by scripts/generate-conformance-vectors.mjs; the
// output is deterministic (Ed25519 signatures are), so regenerating changes
// nothing unless an input changed.
//
// No vector fetches anything. Most domains are reserved names (RFC 2606,
// RFC 6761); the others (example.co.uk, the A-label and the .ck cases) only
// exercise suffix rules.

import { CANONICAL_DOMAIN, KID, baseOffer, jwks, signOffer } from "./conformance.mjs";

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

const hostOwned = (canonical_domain, reason, note, extra = {}) => ({
  canonical_domain,
  ...extra,
  note,
  expected: { reason },
});

const bookingHost = (direct_booking_url, reason, note) => ({
  canonical_domain: CANONICAL_DOMAIN,
  direct_booking_url,
  note,
  expected: { reason },
});

export function buildHostDomainVectors() {
  return {
    name: "vrp-host-domain-vectors-v0.1",
    description:
      "Host-owned domain (§2), offer-domain binding (§7) and booking-URL host (§5.1). A verifier uses the full ICANN section of the Public Suffix List; these vectors carry only the rules they depend on. expected.reason is null when the check passes.",
    psl_icann_rules: ["com", "uk", "co.uk", "se", "*.ck", "!www.ck"],
    psl_private_rules: ["platform.example"],
    host_owned: [
      hostOwned("example.com", null, "one label under the ICANN suffix com"),
      hostOwned("example.co.uk", null, "one label under the two-label ICANN suffix co.uk"),
      hostOwned(CANONICAL_DOMAIN, null, "no ICANN rule matches .invalid, so the default rule * applies"),
      hostOwned("xn--exmple-cua.com", null, "an internationalized name in A-label form"),
      hostOwned("host.example.ck", null, "the wildcard rule *.ck makes example.ck a suffix"),
      hostOwned("www.ck", null, "the exception rule !www.ck makes www.ck registrable"),
      hostOwned("www.example.com", "not_host_owned", "a name under the host's domain is not the node's domain"),
      hostOwned(
        "villa.platform.example",
        "not_host_owned",
        "a name a platform hands out under its own domain; the PRIVATE-section rule platform.example does not count",
        { admitted_by_private_section: true },
      ),
      hostOwned("com", "public_suffix", "a public suffix is not a domain anyone holds"),
      hostOwned("co.uk", "public_suffix", "a public suffix is not a domain anyone holds"),
      hostOwned("example.ck", "public_suffix", "under *.ck, example.ck is itself a suffix"),
      hostOwned("Example.com", "malformed_domain", "canonical_domain is lowercase"),
      hostOwned("example.com.", "malformed_domain", "no trailing dot"),
      hostOwned("exämple.com", "malformed_domain", "internationalized names use the A-label form"),
    ],
    offer_binding: [
      {
        name: "offer_names_fetched_domain",
        note: "discovery, JWKS and the signed offer all name the domain they were fetched from",
        fetched_domain: CANONICAL_DOMAIN,
        discovery: { canonical_domain: CANONICAL_DOMAIN },
        jwks: jwks(),
        input: envelope(baseOffer),
        expected: { signature_valid: true, reason: null },
      },
      {
        name: "offer_names_another_domain",
        note: "the node at example-host.invalid validly signs an offer naming other-host.invalid, with a booking URL on that domain; the signature verifies, the offer is still not other-host.invalid's",
        fetched_domain: CANONICAL_DOMAIN,
        discovery: { canonical_domain: CANONICAL_DOMAIN },
        jwks: jwks(),
        input: envelope(offerNamingOther),
        expected: { signature_valid: true, reason: "offer_domain_mismatch" },
      },
      {
        name: "discovery_names_another_domain",
        note: "a discovery document fetched from example-host.invalid that declares another canonical_domain",
        fetched_domain: CANONICAL_DOMAIN,
        discovery: { canonical_domain: OTHER },
        jwks: jwks(),
        input: envelope(baseOffer),
        expected: { signature_valid: null, reason: "discovery_domain_mismatch" },
      },
    ],
    booking_host: [
      bookingHost(`https://${CANONICAL_DOMAIN}/book`, null, "the node's own domain"),
      bookingHost(`https://www.${CANONICAL_DOMAIN}/book`, null, "www. under the node's own domain"),
      bookingHost("https://EXAMPLE-HOST.invalid/book", null, "hosts compare after URL parsing, which lowercases them"),
      bookingHost(`https://book.${CANONICAL_DOMAIN}/`, "booking_url_host_mismatch", "any other name under the node's domain"),
      bookingHost(`https://www.www.${CANONICAL_DOMAIN}/`, "booking_url_host_mismatch", "only one www. label"),
      bookingHost(`https://${OTHER}/book`, "booking_url_host_mismatch", "another node's domain"),
      bookingHost(`https://www.${OTHER}/book`, "booking_url_host_mismatch", "www. under another node's domain"),
      bookingHost(`https://${CANONICAL_DOMAIN}.${OTHER}/`, "booking_url_host_mismatch", "the node's domain as a prefix of another host"),
      bookingHost("https://wwwexample-host.invalid/", "booking_url_host_mismatch", "not a www. label"),
      bookingHost(`https://${CANONICAL_DOMAIN}@${OTHER}/`, "booking_url_host_mismatch", "userinfo before another host"),
      bookingHost(`http://${CANONICAL_DOMAIN}/book`, "booking_url_not_https", "https only (§5.1)"),
      bookingHost("not a url", "booking_url_invalid", "not an absolute URL"),
    ],
  };
}
