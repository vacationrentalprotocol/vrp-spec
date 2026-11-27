// Readable from a browser (spec/v0.1.md §4, ADR 0020).
//
// A verifier that runs in a web page can read a node's discovery document,
// JWKS and offer only when each response carries Access-Control-Allow-Origin.
// Core §4 says a node SHOULD send `Access-Control-Allow-Origin: *` on all
// three, error responses included.
//
// Offline (npm test): runs every vector in
// examples/conformance/browser-readable/vectors.json through checkResponses()
// and compares the outcome with the vector's expectation.
//
// Live:  node scripts/verify-browser-readable.mjs --live example-host.invalid
//        fetches the three documents of that node (four GET requests, one a
//        second apart, redirects followed by hand) and reports the header on
//        each response; exits 1 when one of them cannot be read by a page on
//        another origin.
//
// What "readable" means here is the browser's own rule (Fetch, "CORS check"):
// without credentials, a response is shared with every origin when the header
// is `*`. A header that names one origin shares it with that origin only, so
// it does not meet §4.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const vectorsPath = join(repoRoot, "examples/conformance/browser-readable/vectors.json");

export const RESPONSES = ["discovery", "jwks", "offer", "offer_error"];

// One response's headers as a plain object, a Headers instance or a list of
// [name, value] pairs. Header names compare without regard to case.
function headerValues(headers, name) {
  const wanted = name.toLowerCase();
  const pairs =
    headers && typeof headers.entries === "function"
      ? [...headers.entries()]
      : Array.isArray(headers)
        ? headers
        : Object.entries(headers || {});
  return pairs
    .filter(([k]) => String(k).toLowerCase() === wanted)
    .flatMap(([, v]) => (Array.isArray(v) ? v : [v]))
    .map((v) => String(v));
}

// Can a page on any other origin read this response?
export function readableFromAnyOrigin(headers) {
  const values = headerValues(headers, "access-control-allow-origin");
  if (values.length === 0) return { ok: false, reason: "no Access-Control-Allow-Origin header" };
  if (values.length > 1) return { ok: false, reason: `the header is sent ${values.length} times` };
  const value = values[0].trim();
  if (value === "*") return { ok: true, reason: "Access-Control-Allow-Origin: *" };
  if (value === "") return { ok: false, reason: "the header is empty" };
  return { ok: false, reason: `the header names "${value}": at most that one origin can read the response` };
}

// `responses` maps discovery, jwks, offer and (optionally) offer_error to
// { status, headers }. A response that is absent from the map is not judged.
export function checkResponses(responses) {
  const results = {};
  for (const name of RESPONSES) {
    if (responses[name] === undefined) continue;
    results[name] = readableFromAnyOrigin(responses[name].headers);
  }
  const judged = Object.values(results);
  return { results, pass: judged.length > 0 && judged.every((r) => r.ok) };
}

function runVectors() {
  const manifest = JSON.parse(readFileSync(vectorsPath, "utf8"));
  const failures = [];
  for (const v of manifest.vectors) {
    const got = checkResponses(v.responses);
    const gotReadable = Object.fromEntries(Object.entries(got.results).map(([k, r]) => [k, r.ok]));
    const same = JSON.stringify(gotReadable) === JSON.stringify(v.expected.readable) && got.pass === v.expected.pass;
    console.log(`  ${same ? " ok " : "FAIL"} ${v.name}`);
    if (!same) failures.push(`${v.name}: got ${JSON.stringify({ readable: gotReadable, pass: got.pass })}, want ${JSON.stringify(v.expected)}`);
  }
  if (failures.length) {
    console.error(`\nBrowser-readable vectors FAILED:\n- ${failures.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`\nBrowser-readable vectors OK (${manifest.vectors.length} cases).`);
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One GET, redirects followed by hand: a browser applies the same check to a
// redirect response before it follows it, so every hop is judged.
async function get(url) {
  const hops = [];
  let next = url;
  for (let i = 0; i < 4; i += 1) {
    const response = await fetch(next, { redirect: "manual", headers: { accept: "application/json" } });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      hops.push({ url: next, status: response.status, headers: response.headers });
      next = new URL(location, next).href;
      await pause(1100);
      continue;
    }
    return { url: next, status: response.status, headers: response.headers, body: await response.text(), hops };
  }
  throw new Error(`${url}: more than three redirects`);
}

async function runLive(domain) {
  const discovery = await get(`https://${domain}/.well-known/vacation-rental.json`);
  const doc = JSON.parse(discovery.body);
  await pause(1100);
  const jwks = await get(doc.jwks_url);
  // A stay about two months ahead; the header is judged, not the offer.
  const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const offerUrl = new URL(doc.verified_stay_offer_endpoint);
  offerUrl.searchParams.set("check_in", day(60));
  offerUrl.searchParams.set("check_out", day(62));
  offerUrl.searchParams.set("guests", "2");
  await pause(1100);
  const offer = await get(offerUrl.href);
  // The endpoint asked for nothing: whatever it answers, a page must be able to read it.
  await pause(1100);
  const offerError = await get(doc.verified_stay_offer_endpoint);
  const responses = { discovery, jwks, offer, offer_error: offerError };
  const { results } = checkResponses(responses);
  let pass = true;
  for (const name of RESPONSES) {
    for (const hop of responses[name].hops) {
      const r = readableFromAnyOrigin(hop.headers);
      pass = pass && r.ok;
      console.log(`  ${r.ok ? " ok " : "FAIL"} ${name.padEnd(11)} HTTP ${hop.status}  ${r.reason}  ${hop.url} (redirect)`);
    }
    const r = results[name];
    pass = pass && r.ok;
    console.log(`  ${r.ok ? " ok " : "FAIL"} ${name.padEnd(11)} HTTP ${responses[name].status}  ${r.reason}  ${responses[name].url}`);
  }
  console.log(pass ? "\nEvery response can be read by a page on another origin." : "\nA verifier in a browser is stopped at the response marked FAIL.");
  process.exit(pass ? 0 : 1);
}

const liveAt = process.argv.indexOf("--live");
if (liveAt >= 0) {
  const domain = process.argv[liveAt + 1];
  if (!domain) {
    console.error("Usage: node scripts/verify-browser-readable.mjs --live <domain>");
    process.exit(2);
  }
  runLive(domain).catch((error) => {
    console.error(`Could not check ${domain}: ${error.message}`);
    process.exit(2);
  });
} else if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runVectors();
}
