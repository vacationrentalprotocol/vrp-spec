// Host-domain conformance vectors (spec/v0.1.md §2, §5.1, §7; ADR 0009).
//
// Three groups, all offline and deterministic:
//   host_owned    — is `canonical_domain` a host-owned domain (§2): its own
//                   registrable domain under the ICANN section of the Public
//                   Suffix List, never a name under another party's domain.
//   offer_binding — is a signed offer bound to the domain it was fetched from
//                   (§7): a valid signature over an offer that names another
//                   domain is not that domain's offer.
//   booking_host  — is `direct_booking_url` on `canonical_domain` or
//                   `www.` + `canonical_domain`, and nothing else (§5.1).
//
// The vectors carry the few ICANN-section rules they depend on, so they need no
// copy of the full list; a real verifier uses the full ICANN section.
//
// Run directly or via `npm test`:  node scripts/verify-host-domain.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyCompactJws } from "./conformance.mjs";

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

// Public Suffix List algorithm (https://publicsuffix.org/list/): the prevailing
// rule is an exception rule if one matches, else the matching rule with the
// most labels, else the default rule "*". Returns the suffix's label count.
function publicSuffixLength(labels, rules) {
  const matches = [];
  for (const raw of rules) {
    const exception = raw.startsWith("!");
    const rule = (exception ? raw.slice(1) : raw).split(".");
    if (rule.length > labels.length) continue;
    const offset = labels.length - rule.length;
    if (rule.every((l, i) => l === "*" || l === labels[offset + i])) {
      matches.push({ exception, length: rule.length });
    }
  }
  const exception = matches.find((m) => m.exception);
  if (exception) return exception.length - 1;
  return Math.max(1, ...matches.map((m) => m.length));
}

/** The registrable domain of `host` under `rules`, or null if `host` is a public suffix. */
export function registrableDomain(host, rules) {
  const labels = host.split(".");
  const suffix = publicSuffixLength(labels, rules);
  return labels.length > suffix ? labels.slice(-(suffix + 1)).join(".") : null;
}

/** §2: `canonical_domain` is lowercase ASCII (A-labels), no trailing dot, and its own registrable domain. */
export function checkHostOwned(canonicalDomain, icannRules) {
  if (typeof canonicalDomain !== "string" || canonicalDomain.length > 253) {
    return "malformed_domain";
  }
  const labels = canonicalDomain.split(".");
  if (!labels.every((l) => LABEL.test(l))) return "malformed_domain";
  const registrable = registrableDomain(canonicalDomain, icannRules);
  if (registrable === null) return "public_suffix";
  return registrable === canonicalDomain ? null : "not_host_owned";
}

/** §7: the discovery document and the signed offer both name the domain they were fetched from. */
export function checkOfferBinding({ fetchedDomain, discovery, jwks, envelope }) {
  if (discovery?.canonical_domain !== fetchedDomain) return { signatureValid: null, reason: "discovery_domain_mismatch" };
  const result = verifyCompactJws(envelope?.signature?.jws, jwks);
  if (!result.valid) return { signatureValid: false, reason: result.reason };
  if (result.payload?.canonical_domain !== fetchedDomain) return { signatureValid: true, reason: "offer_domain_mismatch" };
  return { signatureValid: true, reason: null };
}

/** §5.1: an absolute https URL whose host is `canonical_domain` or `www.` + `canonical_domain`. */
export function checkBookingHost(url, canonicalDomain) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "booking_url_invalid";
  }
  if (parsed.protocol !== "https:") return "booking_url_not_https";
  const host = parsed.hostname;
  return host === canonicalDomain || host === `www.${canonicalDomain}` ? null : "booking_url_host_mismatch";
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const doc = JSON.parse(
    readFileSync(join(repoRoot, "examples/conformance/host-domain/vectors.v0.1.json"), "utf8"),
  );
  const failures = [];
  const check = (name, ok, detail) => {
    if (ok) console.log(`  ok   ${name}`);
    else failures.push(detail ? `${name} (${detail})` : name);
  };

  const icann = doc.psl_icann_rules;
  for (const v of doc.host_owned) {
    const reason = checkHostOwned(v.canonical_domain, icann);
    check(`host_owned ${v.canonical_domain}`, reason === v.expected.reason, `got ${reason}`);
  }
  // The PRIVATE section must not count: with it, a platform-issued name would pass.
  for (const v of doc.host_owned.filter((x) => x.admitted_by_private_section)) {
    const withPrivate = registrableDomain(v.canonical_domain, [...icann, ...doc.psl_private_rules]);
    check(
      `host_owned ${v.canonical_domain}: the PRIVATE section would wrongly admit it`,
      withPrivate === v.canonical_domain,
      `got ${withPrivate}`,
    );
  }
  for (const v of doc.offer_binding) {
    const r = checkOfferBinding({
      fetchedDomain: v.fetched_domain,
      discovery: v.discovery,
      jwks: v.jwks,
      envelope: v.input,
    });
    check(
      `offer_binding ${v.name}`,
      r.signatureValid === v.expected.signature_valid && r.reason === v.expected.reason,
      `got ${JSON.stringify(r)}`,
    );
  }
  for (const v of doc.booking_host) {
    const reason = checkBookingHost(v.direct_booking_url, v.canonical_domain);
    check(`booking_host ${v.direct_booking_url}`, reason === v.expected.reason, `got ${reason}`);
  }

  const total = doc.host_owned.length + doc.offer_binding.length + doc.booking_host.length;
  if (failures.length > 0) {
    console.error("\nHost-domain vector verification failed:");
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }
  console.log(`\nHost-domain vectors OK (${total} vectors, spec/v0.1.md §2, §5.1, §7).`);
}
