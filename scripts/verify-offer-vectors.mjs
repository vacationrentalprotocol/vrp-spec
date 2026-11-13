// Self-describing signed-offer conformance vectors.
// Runs the reference verifier (scripts/conformance.mjs verifyOfferVector)
// against every committed vector in examples/conformance/offer/ and checks
// that its outcome matches each vector's inline `expected` block.
//
// Vector format: { name, description, clock, jwks, input, expected }
//   input     — a complete signed_verified_stay_offer envelope (spec §5)
//   clock     — the injected evaluation instant (no wall-clock dependency)
//   expected  — { verified, reason, fresh }
//       verified: the JWS verifies against the embedded jwks AND the signed
//                 payload declares a known protocol_version (1.0 §5, §9)
//       reason:   null, or the reference rejection reason
//       fresh:    offer.valid_until > clock; null when not verified
//
// The corpus covers the four combinations of version string and algorithm
// name (0.1/EdDSA, 0.1/Ed25519, 1.0/EdDSA, 1.0/Ed25519); the check below fails
// if one of them loses its accepting vector, so v0.1 compatibility cannot
// disappear from the corpus unnoticed.
//
// These vectors mirror the executable base checks in
// scripts/verify-conformance-vectors.mjs as implementation-neutral data, so an
// independent verifier can consume them without reading any JavaScript.
//
// Run directly or via `npm test`:  node scripts/verify-offer-vectors.mjs

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyOfferVector } from "./conformance.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const vectorsDir = join(repoRoot, "examples/conformance/offer");

const failures = [];
const pass = (name) => console.log(`  ok   ${name}`);
const check = (name, cond) => (cond ? pass(name) : failures.push(name));

const vectorFiles = readdirSync(vectorsDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

check("offer vector set is non-empty", vectorFiles.length >= 5);

// version string / algorithm name of every vector the verifier accepted
const accepted = new Set();

for (const file of vectorFiles) {
  const v = JSON.parse(readFileSync(join(vectorsDir, file), "utf8"));

  for (const field of ["name", "description", "clock", "jwks", "input", "expected"]) {
    check(`${file}: has ${field}`, v[field] !== undefined);
  }

  const { verified, reason, fresh, header, payload } = verifyOfferVector(v);
  if (verified) accepted.add(`${payload.protocol_version}/${header.alg}`);

  check(`${file}: verified matches expected (${v.name})`, verified === v.expected.verified);
  check(`${file}: reason matches expected (${v.name})`, reason === v.expected.reason);
  check(`${file}: fresh matches expected (${v.name})`, fresh === v.expected.fresh);
  if (
    verified !== v.expected.verified ||
    reason !== v.expected.reason ||
    fresh !== v.expected.fresh
  ) {
    console.error(`        expected: ${JSON.stringify(v.expected)}`);
    console.error(`        actual:   ${JSON.stringify({ verified, reason, fresh })}`);
  }
}

for (const combo of ["0.1/EdDSA", "0.1/Ed25519", "1.0/EdDSA", "1.0/Ed25519"]) {
  check(`an accepting vector exists for ${combo}`, accepted.has(combo));
}

if (failures.length > 0) {
  console.error("\nOffer vector verification failed:");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log(`\nOffer vectors OK (${vectorFiles.length} self-describing vectors).`);
