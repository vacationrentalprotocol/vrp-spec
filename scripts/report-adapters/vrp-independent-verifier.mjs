// Adapter: vrp-independent-verifier (src/verifier.mjs verifyOffer) for
// scripts/conformance-report.mjs. That verifier consumes the corpus's vector
// format directly, so nothing is mapped.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const MAPPING = "none: verifyOffer(vector) returns { verified, reason, fresh }";

export function describe(engineDir, { git, sha256 }) {
  const pkg = JSON.parse(readFileSync(join(engineDir, "package.json"), "utf8"));
  return {
    name: `${pkg.name} (src/verifier.mjs verifyOffer)`,
    version: pkg.version,
    repository: "https://github.com/Swarnabha753/vrp-independent-verifier",
    path: "src/verifier.mjs",
    digest: {
      alg: "sha256",
      value: sha256(readFileSync(join(engineDir, "src/verifier.mjs"))),
      method: "sha256 of the file src/verifier.mjs at the stated revision",
    },
  };
}

export async function load(engineDir) {
  const { verifyOffer } = await import(pathToFileURL(join(engineDir, "src/verifier.mjs")).href);
  return async (vector) => {
    const r = verifyOffer(vector);
    return { verified: r.verified, reason: r.reason, fresh: r.fresh };
  };
}
