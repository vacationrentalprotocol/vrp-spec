// Self-describing signed-offer conformance vectors.
// Runs the reference verifier (scripts/conformance.mjs verifyCompactJws)
// against every committed vector in examples/conformance/offer/ and checks
// that its outcome matches each vector's inline `expected` block.
//
// Vector format: { name, description, clock, jwks, input, expected }
//   input     — a complete signed_verified_stay_offer envelope (spec §5)
//   clock     — the injected evaluation instant (no wall-clock dependency)
//   expected  — { verified, reason, fresh }
//       verified: does the JWS verify against the embedded jwks
//       reason:   null, or the reference rejection reason
//       fresh:    offer.valid_until > clock; null when not verified
//
// These vectors mirror the executable base checks in
// scripts/verify-conformance-vectors.mjs as implementation-neutral data, so an
// independent verifier can consume them without reading any JavaScript.
//
// Run directly or via `npm test`:  node scripts/verify-offer-vectors.mjs

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyCompactJws } from "./conformance.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const vectorsDir = join(repoRoot, "examples/conformance/offer");

const failures = [];
const pass = (name) => console.log(`  ok   ${name}`);
const check = (name, cond) => (cond ? pass(name) : failures.push(name));

const vectorFiles = readdirSync(vectorsDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

check("offer vector set is non-empty", vectorFiles.length >= 5);

for (const file of vectorFiles) {
  const v = JSON.parse(readFileSync(join(vectorsDir, file), "utf8"));

  for (const field of ["name", "description", "clock", "jwks", "input", "expected"]) {
    check(`${file}: has ${field}`, v[field] !== undefined);
  }

  const jws = v.input?.signature?.jws;
  const result = verifyCompactJws(jws, v.jwks);

  const verified = result.valid === true;
  const reason = result.reason ?? null;
  let fresh = null;
  if (verified) {
    const validUntil = Date.parse(result.payload?.valid_until ?? "");
    fresh = Number.isFinite(validUntil) && validUntil > Date.parse(v.clock);
  }

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

if (failures.length > 0) {
  console.error("\nOffer vector verification failed:");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log(`\nOffer vectors OK (${vectorFiles.length} self-describing vectors).`);
