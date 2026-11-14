// The web verifier (verify.html) against the conformance vectors.
//
// verify.html is a verifier of its own: it does not import
// scripts/conformance.mjs, it carries its own copy of the rules for a browser.
// This script runs that copy, as it is served, so that the page and the
// reference verifier cannot drift apart unnoticed:
//
//   offers    — every vector in examples/conformance/offer/ through the page's
//               verifyJws(jws, jwks), with the vector's own JWKS. A vector the
//               reference verifier refuses before or at the signature
//               (unexpected_alg, kid_not_in_jwks, unsupported_key,
//               signature_mismatch) must not come back as a valid signature.
//               A vector refused for the version its signed payload declares
//               has a genuine signature; the page judges that version when it
//               renders, so here the signature must verify and the payload
//               must carry the vector's version unchanged.
//   discovery — every document in examples/conformance/discovery-version/
//               through the page's checkDiscovery(doc, domain): the page names
//               a protocol or version problem exactly when the vector expects
//               a reason.
//   keys      — the valid vector's own signature, against the same key under
//               another alg label. A VRP signing key names its alg, Ed25519
//               or EdDSA (1.0 §3; schemas/jwks-v1.0.schema.json). Any other
//               label, or none, is refused before any signature check.
//
// The page's inline script is evaluated unmodified in a Node `vm` context with
// Web Crypto and a stub document; nothing is fetched.
//
// Run directly or via `npm test`:  node scripts/verify-web-verifier.mjs

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import vm from "node:vm";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(repoRoot, "verify.html"), "utf8");

const failures = [];
const check = (name, cond, detail = "") => {
  if (cond) console.log(`  ok   ${name}`);
  else failures.push(detail ? `${name} (${detail})` : name);
};

// The page has one inline script; evaluate exactly that text.
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
check("verify.html has one inline script", scripts.length === 1, `found ${scripts.length}`);

// A document that accepts everything the page does at load time and renders
// nothing: element lookups, listeners, class and style changes.
const element = () =>
  new Proxy(function () {}, {
    get: (_t, key) => (key === "value" || key === "textContent" || key === "innerHTML" ? "" : element()),
    set: () => true,
    apply: () => element(),
  });
const context = vm.createContext({
  crypto: webcrypto,
  atob,
  TextEncoder,
  TextDecoder,
  URL,
  URLSearchParams,
  Promise,
  Date,
  JSON,
  document: { getElementById: () => element() },
  location: { search: "" },
  fetch: () => Promise.reject(new Error("verify-web-verifier: the page must not fetch in this run")),
});
vm.runInContext(scripts[0] ?? "", context, { filename: "verify.html" });
const { verifyJws, checkDiscovery } = context;
check("the page defines verifyJws and checkDiscovery", typeof verifyJws === "function" && typeof checkDiscovery === "function");

// Reasons the reference verifier gives before or at the signature check. The
// page must refuse the same vectors; it throws for the first three and returns
// ok === false for a signature that does not match.
const REFUSED_BEFORE_PAYLOAD = new Set(["unexpected_alg", "kid_not_in_jwks", "unsupported_key", "signature_mismatch"]);
// Reasons about the version the signed payload declares: the signature is genuine.
const VERSION_REASONS = new Set(["unsupported_version", "missing_protocol_version"]);

const offerDir = join(repoRoot, "examples", "conformance", "offer");
const offerFiles = readdirSync(offerDir).filter((f) => f.endsWith(".json")).sort();
check("offer vectors are present", offerFiles.length >= 15, `found ${offerFiles.length}`);

const seen = new Set();
for (const file of offerFiles) {
  const v = JSON.parse(readFileSync(join(offerDir, file), "utf8"));
  const jws = v.input?.signature?.jws;
  let observed;
  try {
    const r = await verifyJws(jws, v.jwks);
    observed = { ok: r.ok === true, payload: r.payload, error: null };
  } catch (e) {
    observed = { ok: false, payload: null, error: String(e?.message ?? e) };
  }
  const reason = v.expected.reason;
  seen.add(reason ?? "accepted");
  if (reason === null) {
    check(`offer ${file}: the page verifies the signature`, observed.ok, observed.error ?? "signature invalid");
  } else if (REFUSED_BEFORE_PAYLOAD.has(reason)) {
    check(`offer ${file}: the page refuses it (${reason})`, !observed.ok, "the page returned a valid signature");
    if (reason !== "signature_mismatch") {
      check(`offer ${file}: the page stops before any signature check`, observed.error !== null, "the page ran the signature check");
    }
  } else if (VERSION_REASONS.has(reason)) {
    const payload = JSON.parse(Buffer.from(String(jws).split(".")[1], "base64url").toString("utf8"));
    check(`offer ${file}: genuine signature, version left to the payload rule`, observed.ok, observed.error ?? "signature invalid");
    check(
      `offer ${file}: the page reads the signed version as declared`,
      observed.ok && observed.payload?.protocol_version === payload.protocol_version,
    );
  } else {
    failures.push(`offer ${file}: reason ${reason} is not one this script knows; add it`);
  }
}
// The run is only worth something if it met each kind of case.
for (const kind of ["accepted", "unexpected_alg", "kid_not_in_jwks", "signature_mismatch", "unsupported_version", "missing_protocol_version"]) {
  check(`offers: a vector of kind ${kind} was run`, seen.has(kind));
}

const versions = JSON.parse(readFileSync(join(repoRoot, "examples", "conformance", "discovery-version", "vectors.v1.0.json"), "utf8"));
const accepted = new Set();
for (const c of versions.discovery) {
  const domain = c.document?.canonical_domain;
  const { problems } = checkDiscovery(c.document, domain);
  const versionProblem = problems.some((p) => /does not declare vacation-rental-protocol/.test(p));
  check(
    `discovery ${c.name}: ${c.expected.reason ?? "accepted"}`,
    versionProblem === (c.expected.reason !== null),
    `page problems: ${JSON.stringify(problems)}`,
  );
  if (c.expected.reason === null) {
    check(`discovery ${c.name}: the page reports no problem at all`, problems.length === 0, JSON.stringify(problems));
    accepted.add(c.document.protocol_version);
  }
}
check('discovery: "1.0" and "0.1" are both accepted by the page', accepted.has("1.0") && accepted.has("0.1"));

// The key's own alg label. Same key material and a genuine signature every
// time: only the label differs.
const base = JSON.parse(readFileSync(join(offerDir, "01-valid-fresh.json"), "utf8"));
const baseJws = base.input.signature.jws;
const withLabel = (label) => ({
  keys: base.jwks.keys.map((k) => {
    const { alg, ...rest } = k;
    return label === undefined ? rest : { ...rest, alg: label };
  }),
});
const underLabel = async (label) => {
  try {
    const r = await verifyJws(baseJws, withLabel(label));
    return { ok: r.ok === true, error: null };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
};
for (const label of ["EdDSA", "Ed25519"]) {
  check(`key labelled ${JSON.stringify(label)}: the page verifies`, (await underLabel(label)).ok);
}
const refusedLabels = ["ES256", "RS256", "none", "ed25519", "eddsa", "EDDSA", "", null, 1, undefined];
for (const label of refusedLabels) {
  const observed = await underLabel(label);
  const name = label === undefined ? "no alg" : `alg ${JSON.stringify(label)}`;
  check(`key with ${name}: the page refuses it`, !observed.ok, "the page returned a valid signature");
  check(`key with ${name}: refused before any signature check`, observed.error !== null && /labelled alg/.test(observed.error), observed.error ?? "the page ran the signature check");
}

if (failures.length > 0) {
  console.error("\nWeb verifier check failed:");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log(`\nWeb verifier OK (verify.html: ${offerFiles.length} offer vectors, ${versions.discovery.length} discovery documents, ${refusedLabels.length + 2} key labels).`);
