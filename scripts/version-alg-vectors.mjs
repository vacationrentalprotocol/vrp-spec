// Builds the version and algorithm-name vectors of the 1.0 candidate
// (spec/v1.0.md §2, §3, §5, §7, §9; ADR 0013, ADR 0017). Called by
// scripts/generate-conformance-vectors.mjs; the output is deterministic
// (Ed25519 signatures are), so regenerating changes nothing unless an input
// changed.
//
//   examples/conformance/offer/06 … 15      signed-offer vectors, the same
//       self-describing format as 01–05 (which stay byte-identical: they are
//       the v0.1 corpus and prove that a 1.0 verifier still accepts it)
//   examples/conformance/discovery-version/vectors.v1.0.json
//       the discovery document's declared version, apart from the offer's
//
// No vector fetches anything. Every name is under example-host.invalid.

import { KID, baseOffer, publicJwk, signOffer } from "./conformance.mjs";

const CLOCK = "2026-06-02T12:05:00Z"; // inside baseOffer's lifetime

function offerVector({ file, name, description, version, alg, jwkAlg = "EdDSA", unsigned = false, expected }) {
  const offer = { ...baseOffer };
  if (version === undefined) delete offer.protocol_version;
  else offer.protocol_version = version;
  // The unsigned envelope repeats the signed payload's version, or says "1.0"
  // when the payload declares none: only the signed payload counts (§5, §7).
  const envelopeVersion = version === undefined ? "1.0" : version;
  return {
    file,
    vector: {
      name,
      description,
      clock: CLOCK,
      jwks: { keys: [{ ...publicJwk(), alg: jwkAlg }] },
      input: {
        kind: "signed_verified_stay_offer",
        protocol_version: envelopeVersion,
        offer,
        signature: { format: "jws_compact", alg, kid: KID, jws: signOffer(offer, { alg, unsigned }) },
      },
      expected,
    },
  };
}

const ACCEPT = { verified: true, reason: null, fresh: true };
const reject = (reason) => ({ verified: false, reason, fresh: null });

export function buildOfferVersionAlgVectors() {
  return [
    offerVector({
      file: "06-alg-ed25519-valid-fresh",
      name: "alg_ed25519_valid_fresh",
      description:
        "Correctly signed 1.0 offer whose JWS header names the algorithm with the fully specified identifier Ed25519 (RFC 9864 §2.2) instead of the polymorphic EdDSA (RFC 8037). Same key, same operation. A verifier accepts either name (1.0 §3, §5; ADR 0017); the offer verifies and is fresh.",
      version: "1.0",
      alg: "Ed25519",
      expected: ACCEPT,
    }),
    offerVector({
      file: "07-alg-unexpected",
      name: "alg_unexpected",
      description:
        "A JWS whose header alg is ES256, which VRP does not use, signed with the Ed25519 test key. Verification must fail with unexpected_alg before any cryptographic check (§3, §5, §9): only Ed25519 and EdDSA name the operation VRP signs with.",
      version: "1.0",
      alg: "ES256",
      expected: reject("unexpected_alg"),
    }),
    offerVector({
      file: "08-protocol-version-1-0-valid-fresh",
      name: "protocol_version_1_0_valid_fresh",
      description:
        'An otherwise valid offer that declares protocol_version "1.0", signed with EdDSA. 1.0 and 0.1 name the same wire format (1.0 §2, ADR 0013); a verifier accepts either. The offer verifies and is fresh.',
      version: "1.0",
      alg: "EdDSA",
      expected: ACCEPT,
    }),
    offerVector({
      file: "09-protocol-version-unknown",
      name: "protocol_version_unknown",
      description:
        'An otherwise valid, correctly signed offer that declares protocol_version "0.2", a version that does not exist. The signature is genuine, but the offer is unknown (§9): a verifier reports unsupported_version and never quotes it. Fresh is null because an unknown offer has no freshness.',
      version: "0.2",
      alg: "EdDSA",
      expected: reject("unsupported_version"),
    }),
    offerVector({
      file: "10-alg-ed25519-protocol-version-0-1-valid-fresh",
      name: "alg_ed25519_protocol_version_0_1_valid_fresh",
      description:
        'A correctly signed offer that declares protocol_version "0.1" and whose JWS header says Ed25519. The version string and the algorithm name are independent: each has two accepted values and a verifier accepts every combination (1.0 §2, §3, §5). The offer verifies and is fresh.',
      version: "0.1",
      alg: "Ed25519",
      expected: ACCEPT,
    }),
    offerVector({
      file: "11-alg-ed25519-jwk-alg-ed25519-valid-fresh",
      name: "alg_ed25519_jwk_alg_ed25519_valid_fresh",
      description:
        "A correctly signed 1.0 offer whose JWS header says Ed25519, verified against a JWKS whose key also names its alg Ed25519 (1.0 §3; jwks-v1.0 schema). The offer verifies and is fresh.",
      version: "1.0",
      alg: "Ed25519",
      jwkAlg: "Ed25519",
      expected: ACCEPT,
    }),
    offerVector({
      file: "12-alg-eddsa-jwk-alg-ed25519-valid-fresh",
      name: "alg_eddsa_jwk_alg_ed25519_valid_fresh",
      description:
        'A correctly signed 0.1 offer whose JWS header says EdDSA, verified against a JWKS whose key names its alg Ed25519. The two names are one operation and the key\'s crv decides it (1.0 §3), so a header and a key that use different names of the pair still verify. The offer verifies and is fresh.',
      version: "0.1",
      alg: "EdDSA",
      jwkAlg: "Ed25519",
      expected: ACCEPT,
    }),
    offerVector({
      file: "13-alg-none",
      name: "alg_none",
      description:
        'A JWS whose header alg is "none" and whose signature part is empty. Verification must fail with unexpected_alg before any cryptographic check (1.0 §3, §5, §9): an unsigned offer is never verified, whatever its payload says.',
      version: "1.0",
      alg: "none",
      unsigned: true,
      expected: reject("unexpected_alg"),
    }),
    offerVector({
      file: "14-alg-wrong-case",
      name: "alg_wrong_case",
      description:
        'A JWS whose header alg is "ed25519" in lower case, signed with the Ed25519 test key. Algorithm names are case-sensitive (RFC 7515 §4.1.1): only the exact strings Ed25519 and EdDSA are accepted (1.0 §3, §5). Verification must fail with unexpected_alg.',
      version: "1.0",
      alg: "ed25519",
      expected: reject("unexpected_alg"),
    }),
    offerVector({
      file: "15-protocol-version-missing",
      name: "protocol_version_missing",
      description:
        'A correctly signed offer whose signed payload declares no protocol_version, while the unsigned envelope beside it says "1.0". Only the signed payload counts (1.0 §5, §7): the offer is unknown (§9), a verifier reports missing_protocol_version and never quotes it. Nothing is filled in for the node (§8).',
      version: undefined,
      alg: "EdDSA",
      expected: reject("missing_protocol_version"),
    }),
  ];
}

// A discovery document that meets the Core schema, with the version member
// replaced, removed or accompanied by another member.
function discoveryCase(base, name, patch, note, expected) {
  const document = { ...base };
  patch(document);
  return { name, note, document, expected };
}

export function buildDiscoveryVersionVectors(baseDiscovery) {
  const set = (value) => (d) => { d.protocol_version = value; };
  const ok = { reason: null, schema_valid: true };
  const bad = (reason) => ({ reason, schema_valid: false });

  const discovery = [
    discoveryCase(baseDiscovery, "version_1_0", set("1.0"), 'Declares "1.0".', ok),
    discoveryCase(baseDiscovery, "version_0_1", set("0.1"), 'Declares "0.1": every v0.1 node, unchanged.', ok),
    discoveryCase(baseDiscovery, "version_0_2", set("0.2"), "A version that does not exist.", bad("unsupported_version")),
    discoveryCase(baseDiscovery, "version_2_0", set("2.0"), "A later MAJOR version is not 1.0.", bad("unsupported_version")),
    discoveryCase(baseDiscovery, "version_1_0_0", set("1.0.0"), "Three parts: not the string 1.0.", bad("unsupported_version")),
    discoveryCase(baseDiscovery, "version_1", set("1"), "One part: not the string 1.0.", bad("unsupported_version")),
    discoveryCase(baseDiscovery, "version_v1_0", set("v1.0"), "A prefix: compared as written.", bad("unsupported_version")),
    discoveryCase(baseDiscovery, "version_leading_space", set(" 1.0"), "White space is not trimmed.", bad("unsupported_version")),
    discoveryCase(baseDiscovery, "version_number_1", set(1), "A JSON number, not a string (1.0 is serialized as 1).", bad("unsupported_version")),
    discoveryCase(baseDiscovery, "version_number_0_1", set(0.1), "A JSON number, not a string.", bad("unsupported_version")),
    discoveryCase(baseDiscovery, "version_null", set(null), "null is a value, and not a known one.", bad("unsupported_version")),
    discoveryCase(baseDiscovery, "version_array", set(["1.0", "0.1"]), "A list of versions is not a version.", bad("unsupported_version")),
    discoveryCase(baseDiscovery, "version_absent", (d) => { delete d.protocol_version; }, "No protocol_version member.", bad("missing_protocol_version")),
    discoveryCase(
      baseDiscovery,
      "version_absent_with_pre_0_1_member",
      (d) => { delete d.protocol_version; d.version = "0.1"; },
      "No protocol_version; the pre-0.1 member `version` is not a substitute.",
      bad("missing_protocol_version"),
    ),
    discoveryCase(
      baseDiscovery,
      "protocol_wrong",
      (d) => { d.protocol = "vrp"; d.protocol_version = "1.0"; },
      "A known version under another protocol name (§7).",
      bad("unexpected_protocol"),
    ),
  ];

  // The discovery document's version and the signed offer's version are two
  // declarations, checked separately. A verifier accepts every pair of known
  // values; one unknown or absent value on either side leaves the offer
  // unknown (§9) and never quoted.
  const signed = (version) => {
    const offer = { ...baseOffer };
    if (version === undefined) delete offer.protocol_version;
    else offer.protocol_version = version;
    return signOffer(offer);
  };
  const pair = (name, discoveryVersion, offerVersion, note, expected) => {
    const document = { ...baseDiscovery };
    if (discoveryVersion === undefined) delete document.protocol_version;
    else document.protocol_version = discoveryVersion;
    return { name, note, discovery: document, jws: signed(offerVersion), expected };
  };
  const pairs = [
    pair("discovery_0_1_offer_0_1", "0.1", "0.1", "A v0.1 node, unchanged: still accepted.", { discovery_reason: null, offer_reason: null, version_accepted: true }),
    pair("discovery_1_0_offer_1_0", "1.0", "1.0", "Both declare 1.0.", { discovery_reason: null, offer_reason: null, version_accepted: true }),
    pair("discovery_1_0_offer_0_1", "1.0", "0.1", "The two declarations are independent; both values are known.", { discovery_reason: null, offer_reason: null, version_accepted: true }),
    pair("discovery_0_1_offer_1_0", "0.1", "1.0", "The two declarations are independent; both values are known.", { discovery_reason: null, offer_reason: null, version_accepted: true }),
    pair("discovery_0_2_offer_1_0", "0.2", "1.0", "A known offer version does not repair an unknown discovery version.", { discovery_reason: "unsupported_version", offer_reason: null, version_accepted: false }),
    pair("discovery_1_0_offer_0_2", "1.0", "0.2", "A known discovery version does not repair an unknown offer version.", { discovery_reason: null, offer_reason: "unsupported_version", version_accepted: false }),
    pair("discovery_absent_offer_0_1", undefined, "0.1", "The discovery document declares no version.", { discovery_reason: "missing_protocol_version", offer_reason: null, version_accepted: false }),
    pair("discovery_1_0_offer_absent", "1.0", undefined, "The signed offer declares no version.", { discovery_reason: null, offer_reason: "missing_protocol_version", version_accepted: false }),
  ];

  return {
    kind: "vrp_discovery_version_vectors",
    version: "1.0-candidate",
    spec: "spec/v1.0.md §2, §5, §7, §9 (ADR 0013)",
    note:
      "discovery: one discovery document per case, with the reason a verifier reports for its declared protocol and protocol_version (null = accepted) and whether the document validates against schemas/discovery-v1.0.schema.json. pairs: a discovery document and a signed offer (compact JWS, signed with the test key of examples/conformance/jwks.v0.1.json) whose versions are declared separately.",
    jwks: { keys: [publicJwk()] },
    discovery,
    pairs,
  };
}
