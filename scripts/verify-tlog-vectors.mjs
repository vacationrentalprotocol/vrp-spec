// Transparency-log conformance vectors (spec/transparency-log-v0.1.md §11).
// Runs the reference verifier (lib/vrp-tlog.mjs) against the committed vectors
// in examples/conformance/log/: a signed tree head, inclusion (anchoring)
// vectors and consistency vectors, positive and negative.
//
// Run directly or via `npm test`:  node scripts/verify-tlog-vectors.mjs

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  artifactHash,
  verifyAnchoring,
  verifyConsistencyVector,
  verifySignedTreeHead,
} from "../lib/vrp-tlog.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const logDir = join(repoRoot, "examples/conformance/log");
const readJson = (abs) => JSON.parse(readFileSync(abs, "utf8"));

const failures = [];
const pass = (name) => console.log(`  ok   ${name}`);
const check = (name, cond) => (cond ? pass(name) : failures.push(name));

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object") {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((k, i) => kb[i] === k && deepEqual(a[k], b[k]));
  }
  return false;
}

const listVectors = (sub) =>
  readdirSync(join(logDir, sub))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ file: `${sub}/${f}`, v: readJson(join(logDir, sub, f)) }));

// 1. The published operator key verifies the committed signed tree head.
const didDocument = readJson(join(logDir, "did-web-document.v0.1.json"));
const signedSth = readJson(join(logDir, "sth.signed.v0.1.json"));
const sthCheck = verifySignedTreeHead(signedSth, didDocument);
check("sth.signed.v0.1.json verifies against did-web-document.v0.1.json (§5.1)", sthCheck.valid);
check(
  "sth.signed.v0.1.json: log_id is the operator's did:web",
  signedSth.signed_tree_head.log_id === didDocument.id,
);

// 2. Leaf 0 is the committed signed offer vector, hashed over its exact bytes (§4.1).
const offer = readJson(join(repoRoot, "examples/conformance/verified-stay-offer.signed.v0.1.json"));
const anchoredVector = readJson(join(logDir, "inclusion/01-anchored.json"));
check(
  "inclusion/01-anchored: artifact is the committed signed offer vector",
  anchoredVector.artifact_jws === offer.signature.jws &&
    anchoredVector.expected.artifact_hash === artifactHash(offer.signature.jws),
);

// 3. Every inclusion vector: the reference verifier returns exactly `expected`.
const inclusion = listVectors("inclusion");
check("inclusion vector set is non-empty", inclusion.length >= 2);
for (const { file, v } of inclusion) {
  const result = verifyAnchoring(v);
  const ok = deepEqual(result, v.expected);
  check(`${file}: verifyAnchoring matches expected (${v.expected.reason})`, ok);
  if (!ok) {
    console.error(`        expected: ${JSON.stringify(v.expected)}`);
    console.error(`        actual:   ${JSON.stringify(result)}`);
  }
}

// 4. Every consistency vector likewise.
const consistency = listVectors("consistency");
check("consistency vector set is non-empty", consistency.length >= 2);
for (const { file, v } of consistency) {
  const result = verifyConsistencyVector(v);
  const ok = deepEqual(result, v.expected);
  check(`${file}: verifyConsistencyVector matches expected (${v.expected.reason})`, ok);
  if (!ok) {
    console.error(`        expected: ${JSON.stringify(v.expected)}`);
    console.error(`        actual:   ${JSON.stringify(result)}`);
  }
}

// 5. Spotlight: the two rules a verifier most often gets wrong.
const unsigned = readJson(join(logDir, "inclusion/02-sth-unsigned.json"));
const noProof = readJson(join(logDir, "inclusion/09-no-inclusion-proof.json"));
check("spotlight: a tree head without an operator signature never anchors (§5)", verifyAnchoring(unsigned).anchored === false);
check(
  "spotlight: a missing proof is 'no_inclusion_proof', not a failure (§3 principle 1)",
  verifyAnchoring(noProof).reason === "no_inclusion_proof",
);

if (failures.length > 0) {
  console.error(`\nTransparency-log vectors FAILED (${failures.length}):`);
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
console.log(
  `\nTransparency-log vectors OK (${inclusion.length} inclusion + ${consistency.length} consistency vectors; signed tree head verified).`,
);
