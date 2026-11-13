// The web verifier (verify.html) against the signed-offer vectors.
//
// verify.html is a verifier of its own: it does not import
// scripts/conformance.mjs, it carries its own copy of the rules for a browser.
// This script runs that copy, as it is served:
//
//   vectors — every vector in examples/conformance/offer/ through the page's
//             verifyJws(jws, jwks), with the vector's own JWKS. A vector the
//             reference verifier refuses must not come back as a valid
//             signature; a vector it verifies must verify.
//   keys    — the valid vector's own signature, against the same key under
//             another alg label. Core §3 and schemas/jwks-v0.1.schema.json: a
//             VRP signing key names its alg, EdDSA. Any other label, or none,
//             is refused before any signature check.
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
const { verifyJws } = context;
check("the page defines verifyJws", typeof verifyJws === "function");

async function run(jws, jwks) {
  try {
    const r = await verifyJws(jws, jwks);
    return { ok: r.ok === true, error: null };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

const offerDir = join(repoRoot, "examples", "conformance", "offer");
const offerFiles = readdirSync(offerDir).filter((f) => f.endsWith(".json")).sort();
check("offer vectors are present", offerFiles.length >= 5, `found ${offerFiles.length}`);

let accepted = 0;
let refused = 0;
for (const file of offerFiles) {
  const v = JSON.parse(readFileSync(join(offerDir, file), "utf8"));
  const observed = await run(v.input?.signature?.jws, v.jwks);
  if (v.expected.verified) {
    accepted += 1;
    check(`vector ${file}: the page verifies the signature`, observed.ok, observed.error ?? "signature invalid");
  } else {
    refused += 1;
    check(`vector ${file}: the page refuses it (${v.expected.reason})`, !observed.ok, "the page returned a valid signature");
  }
}
check("vectors: the run met a verifying and a refused vector", accepted > 0 && refused > 0);

// The key's own alg label. Same key material and a genuine signature every
// time: only the label differs.
const base = JSON.parse(readFileSync(join(offerDir, "01-valid-fresh.json"), "utf8"));
const jws = base.input.signature.jws;
const withLabel = (label) => ({
  keys: base.jwks.keys.map((k) => {
    const { alg, ...rest } = k;
    return label === undefined ? rest : { ...rest, alg: label };
  }),
});
check("key labelled \"EdDSA\": the page verifies", (await run(jws, withLabel("EdDSA"))).ok);
for (const label of ["ES256", "RS256", "none", "ed25519", "eddsa", "Ed25519", "", null, 1, undefined]) {
  const observed = await run(jws, withLabel(label));
  const name = label === undefined ? "no alg" : `alg ${JSON.stringify(label)}`;
  check(`key with ${name}: the page refuses it`, !observed.ok, "the page returned a valid signature");
  check(`key with ${name}: refused before any signature check`, observed.error !== null && /labelled alg/.test(observed.error), observed.error ?? "the page ran the signature check");
}

if (failures.length > 0) {
  console.error("\nWeb verifier check failed:");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log(`\nWeb verifier OK (verify.html: ${offerFiles.length} offer vectors, 11 key labels).`);
