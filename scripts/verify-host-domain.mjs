// Host-domain conformance vectors (spec/v0.1.md §2, §5.1, §7; ADR 0009).
//
// Groups, all offline and deterministic:
//   host_owned / real_world — is `canonical_domain` a host-owned domain (§2):
//                   its own registrable domain under the ICANN section of the
//                   Public Suffix List (rules compared in A-label form), and not
//                   under a brand or closed top-level domain.
//   offer_binding — is a signed offer bound to the domain it was fetched from
//                   (§7): a valid signature over an offer that names another
//                   domain is not that domain's offer.
//   node_url      — is a node URL (`jwks_url`, `verified_stay_offer_endpoint`,
//                   `direct_booking_url`) an https URL on `canonical_domain` or
//                   `www.` + `canonical_domain`, with no userinfo and no port
//                   other than the https default (§2, §5.1).
//   redirects     — does every redirect while fetching stay on node URLs (§2).
//
// The vectors carry the list entries they depend on, so they need no copy of
// the full lists; a real verifier uses the full ICANN section and ICANN's gTLD
// list.
//
// Run directly or via `npm test`:  node scripts/verify-host-domain.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { domainToASCII, fileURLToPath } from "node:url";
import { verifyCompactJws } from "./conformance.mjs";

// spec/v0.1.md §2: top-level domains a single company runs for its own business
// that ICANN's gTLD list does not flag with Specification 13. Changed only by ADR.
export const CLOSED_TLDS = ["booking", "hotels"];

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

// A rule label in A-label form; "*" stays a wildcard.
const toALabel = (label) => (label === "*" ? label : domainToASCII(label));

// Public Suffix List algorithm (https://publicsuffix.org/list/): the prevailing
// rule is an exception rule if one matches, else the matching rule with the
// most labels, else the default rule "*". Returns the suffix's label count.
function publicSuffixLength(labels, rules) {
  const matches = [];
  for (const raw of rules) {
    const exception = raw.startsWith("!");
    const rule = (exception ? raw.slice(1) : raw).split(".").map(toALabel);
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

/**
 * §2: `canonical_domain` is lowercase ASCII (A-labels), no trailing dot, its own
 * registrable domain under the ICANN section, and not under a brand or closed
 * top-level domain.
 */
export function checkHostOwned(canonicalDomain, { icannRules, specification13Tlds }) {
  if (typeof canonicalDomain !== "string" || canonicalDomain.length > 253) {
    return "malformed_domain";
  }
  const labels = canonicalDomain.split(".");
  if (!labels.every((l) => LABEL.test(l))) return "malformed_domain";
  const registrable = registrableDomain(canonicalDomain, icannRules);
  if (registrable === null) return "public_suffix";
  if (registrable !== canonicalDomain) return "not_host_owned";
  const tld = labels[labels.length - 1];
  if (specification13Tlds.includes(tld) || CLOSED_TLDS.includes(tld)) return "closed_tld";
  return null;
}

/** §2, §5.1: an https URL on `canonical_domain` or `www.` + it, no userinfo, default port. */
export function checkNodeUrl(url, canonicalDomain) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "url_invalid";
  }
  if (parsed.protocol !== "https:") return "url_not_https";
  if (parsed.username !== "" || parsed.password !== "") return "url_userinfo";
  if (parsed.port !== "") return "url_port";
  const host = parsed.hostname;
  return host === canonicalDomain || host === `www.${canonicalDomain}` ? null : "url_host_mismatch";
}

/** §2: every redirect target while fetching a node resource is itself a node URL. */
export function checkRedirects(chain, canonicalDomain) {
  for (const location of chain) {
    const reason = checkNodeUrl(location, canonicalDomain);
    if (reason === "url_not_https") return "redirect_not_https";
    if (reason) return "redirect_off_node";
  }
  return null;
}

/** §7: the discovery document and the signed offer both name the domain they were fetched from. */
export function checkOfferBinding({ fetchedDomain, discovery, jwks, envelope }) {
  if (discovery?.canonical_domain !== fetchedDomain) return { signatureValid: null, reason: "discovery_domain_mismatch" };
  const result = verifyCompactJws(envelope?.signature?.jws, jwks);
  if (!result.valid) return { signatureValid: false, reason: result.reason };
  if (result.payload?.canonical_domain !== fetchedDomain) return { signatureValid: true, reason: "offer_domain_mismatch" };
  return { signatureValid: true, reason: null };
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

  const lists = { icannRules: doc.psl_icann_rules, specification13Tlds: doc.icann_specification13_tlds };
  check(
    "vectors name the same closed top-level domains as spec/v0.1.md §2",
    JSON.stringify(doc.closed_tlds) === JSON.stringify(CLOSED_TLDS),
  );
  for (const group of ["host_owned", "real_world"]) {
    for (const v of doc[group]) {
      const reason = checkHostOwned(v.canonical_domain, lists);
      check(`${group} ${v.canonical_domain}`, reason === v.expected.reason, `got ${reason}`);
      // The PRIVATE section must not count: with it, a platform-issued name would pass.
      if (v.admitted_by_private_section) {
        const withPrivate = registrableDomain(v.canonical_domain, [...doc.psl_icann_rules, ...doc.psl_private_rules]);
        check(
          `${group} ${v.canonical_domain}: the PRIVATE section would wrongly admit it`,
          withPrivate === v.canonical_domain,
          `got ${withPrivate}`,
        );
      }
      // Rules must be compared in A-label form: with Unicode rules left as they are, this would pass.
      if (v.admitted_without_a_labels) {
        const rawRules = doc.psl_icann_rules.filter((r) => /^[\x00-\x7f]*$/.test(r));
        check(
          `${group} ${v.canonical_domain}: comparing rules without A-labels would wrongly admit it`,
          registrableDomain(v.canonical_domain, rawRules) === v.canonical_domain,
        );
      }
    }
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
  for (const v of doc.node_url) {
    const reason = checkNodeUrl(v.url, v.canonical_domain);
    check(`node_url ${v.field} ${v.url}`, reason === v.expected.reason, `got ${reason}`);
  }
  for (const v of doc.redirects) {
    const reason = checkRedirects(v.chain, v.canonical_domain);
    check(`redirects ${v.name}`, reason === v.expected.reason, `got ${reason}`);
  }

  const total = ["host_owned", "real_world", "offer_binding", "node_url", "redirects"]
    .map((g) => doc[g].length)
    .reduce((a, b) => a + b, 0);
  if (failures.length > 0) {
    console.error("\nHost-domain vector verification failed:");
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }
  console.log(`\nHost-domain vectors OK (${total} vectors, spec/v0.1.md §2, §5.1, §7).`);
}
