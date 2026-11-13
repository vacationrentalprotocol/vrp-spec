// Adapter: @vacationrentalprotocol/vrp-verify (verifyOffer) for
// scripts/conformance-report.mjs. Reads a checkout of the package; installs
// nothing and fetches nothing.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const MAPPING =
  "verifyOffer({ envelope: vector.input, jwks: vector.jwks, now: vector.clock }) returns { status, code, fresh }; verified = status is \"verified\" or \"expired\"; reason = code; fresh = fresh";

export function describe(engineDir, { git, sha256 }) {
  const pkg = JSON.parse(readFileSync(join(engineDir, "package.json"), "utf8"));
  return {
    name: `${pkg.name} (verifyOffer)`,
    version: pkg.version,
    repository: "https://github.com/vacationrentalprotocol/vrp-verify",
    path: "src",
    digest: {
      alg: "sha256",
      value: sha256(`${git(engineDir, "ls-tree", "-r", "HEAD", "--", "src")}\n`),
      method: "git ls-tree -r <revision> -- src | sha256sum",
    },
  };
}

export async function load(engineDir) {
  const { verifyOffer } = await import(pathToFileURL(join(engineDir, "index.js")).href);
  return async (vector) => {
    const r = verifyOffer({ envelope: vector.input, jwks: vector.jwks, now: vector.clock });
    return { verified: r.status === "verified" || r.status === "expired", reason: r.code, fresh: r.fresh };
  };
}
