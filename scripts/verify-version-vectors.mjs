// Discovery-document version vectors (spec/v1.0.md §2, §5, §7, §9; ADR 0013).
//
// The discovery document declares `protocol` and `protocol_version`; the signed
// offer declares its own `protocol_version`. They are two declarations and this
// script checks them separately, so that a verifier which reads only one of
// them cannot pass:
//
//   discovery — one document per case; the reference rule
//               (scripts/conformance.mjs checkDiscoveryVersion) must report
//               each case's expected reason (null = accepted).
//   pairs     — a discovery document and a signed offer; the offer's JWS must
//               verify, and checkDiscoveryVersion and checkOfferVersion must
//               each report their expected reason. The version is accepted
//               only when both are null.
//
// Whether each discovery document validates against
// schemas/discovery-v1.0.schema.json is checked in validate-artifacts.mjs,
// which owns the schema checker.
//
// Run directly or via `npm test`:  node scripts/verify-version-vectors.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDiscoveryVersion, checkOfferVersion, verifyCompactJws } from "./conformance.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = "examples/conformance/discovery-version/vectors.v1.0.json";
const vectors = JSON.parse(readFileSync(join(repoRoot, file), "utf8"));

const failures = [];
const check = (name, cond, detail = "") => {
  if (cond) console.log(`  ok   ${name}`);
  else failures.push(detail ? `${name} (${detail})` : name);
};

check("discovery cases are present", Array.isArray(vectors.discovery) && vectors.discovery.length >= 10);
check("pair cases are present", Array.isArray(vectors.pairs) && vectors.pairs.length >= 6);

const accepted = new Set();
const rejected = new Set();
for (const c of vectors.discovery) {
  const { reason } = checkDiscoveryVersion(c.document);
  check(`discovery ${c.name}: ${c.expected.reason ?? "accepted"}`, reason === c.expected.reason, `got ${reason}`);
  if (reason === null) accepted.add(c.document.protocol_version);
  else rejected.add(reason);
}
// Both known values are accepted and both failure reasons occur: a rule that
// accepts everything, or one that only knows "0.1", fails here.
check('discovery: "1.0" is accepted by some case', accepted.has("1.0"));
check('discovery: "0.1" is accepted by some case (v0.1 compatibility)', accepted.has("0.1"));
check("discovery: an unsupported version is refused by some case", rejected.has("unsupported_version"));
check("discovery: a missing version is refused by some case", rejected.has("missing_protocol_version"));

for (const c of vectors.pairs) {
  const jws = verifyCompactJws(c.jws, vectors.jwks);
  check(`pair ${c.name}: the signed offer verifies`, jws.valid === true, `got ${jws.reason}`);
  const discoveryReason = checkDiscoveryVersion(c.discovery).reason;
  const offerReason = jws.valid ? checkOfferVersion(jws.payload).reason : "unverified";
  check(`pair ${c.name}: discovery ${c.expected.discovery_reason ?? "accepted"}`, discoveryReason === c.expected.discovery_reason, `got ${discoveryReason}`);
  check(`pair ${c.name}: offer ${c.expected.offer_reason ?? "accepted"}`, offerReason === c.expected.offer_reason, `got ${offerReason}`);
  const versionAccepted = discoveryReason === null && offerReason === null;
  check(`pair ${c.name}: version ${c.expected.version_accepted ? "accepted" : "not accepted"}`, versionAccepted === c.expected.version_accepted);
}

if (failures.length > 0) {
  console.error("\nVersion vector verification failed:");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log(`\nVersion vectors OK (${vectors.discovery.length} discovery cases, ${vectors.pairs.length} pairs, spec/v1.0.md §2, §5, §7).`);
