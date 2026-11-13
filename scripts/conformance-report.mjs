#!/usr/bin/env node
// Runs one verifier over the signed-offer corpus (examples/conformance/offer/)
// and writes a conformance report (docs/conformance-report.md, schema
// schemas/conformance-report-v0.1.schema.json). One run, one engine, one
// corpus; score-free. A report is a record of what ran and what came out,
// not a verdict on the engine.
//
//   node scripts/conformance-report.mjs --engine reference \
//     --revision <commit of this repository> --run-at <UTC instant> --out <file>
//
//   node scripts/conformance-report.mjs --engine scripts/report-adapters/<x>.mjs \
//     --engine-dir <checkout of that verifier> \
//     --revision <commit of this repository> --run-at <UTC instant> --out <file>
//
// --revision names the commit of this repository that holds the corpus (and,
// for the reference engine, the engine). The script refuses to run when the
// corpus on disk differs from that commit, so the binding is true.
//
// An adapter is a module that exports
//   describe(engineDir) -> { name, version, repository, revision, path, digest }
//   load(engineDir)     -> async (vector) => ({ verified, reason, fresh })
// and maps the engine's own result to the corpus's { verified, reason, fresh }.
// The mapping is the adapter's and is stated in `config.mapping`.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = "examples/conformance/offer";
const REPOSITORY = "https://github.com/vacationrentalprotocol/vrp-spec";
// Declared before the run: the engine MUST refuse each of these.
const CONTROLS = [
  ["03-tampered-signature.json", "signature altered; the engine MUST reject with signature_mismatch."],
  ["09-protocol-version-unknown.json", 'genuine signature over an offer declaring protocol_version "0.2"; the engine MUST refuse it as unsupported_version (1.0 §5, §9).'],
  ["13-alg-none.json", 'header alg "none" with an empty signature; the engine MUST reject with unexpected_alg (1.0 §3, §5).'],
];

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
for (const required of ["engine", "revision", "run-at", "out"]) {
  if (!args[required]) {
    console.error(`conformance-report: missing --${required}`);
    process.exit(2);
  }
}
if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/.test(args["run-at"])) {
  console.error("conformance-report: --run-at must be a UTC instant, YYYY-MM-DDTHH:MM:SSZ");
  process.exit(2);
}

const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8" }).trim();
const sha256 = (data) => createHash("sha256").update(data).digest("hex");

// The corpus at --revision must be the corpus on disk.
const revision = git(repoRoot, "rev-parse", args.revision);
if (git(repoRoot, "status", "--porcelain", "--", CORPUS) !== "" || git(repoRoot, "diff", "--name-only", revision, "--", CORPUS) !== "") {
  console.error(`conformance-report: ${CORPUS} on disk differs from ${revision}; the report would bind to the wrong corpus`);
  process.exit(1);
}

const files = readdirSync(join(repoRoot, CORPUS)).filter((f) => f.endsWith(".json")).sort();
// `ls *.json | LC_ALL=C sort | xargs sha256sum | sha256sum`
const manifest = files.map((f) => `${sha256(readFileSync(join(repoRoot, CORPUS, f)))}  ${f}\n`).join("");
const corpusDigest = sha256(manifest);

let engine;
let verify;
let mapping;
let notes;
if (args.engine === "reference") {
  const { verifyOfferVector } = await import("./conformance.mjs");
  if (git(repoRoot, "diff", "--name-only", revision, "--", "scripts/conformance.mjs") !== "") {
    console.error(`conformance-report: scripts/conformance.mjs on disk differs from ${revision}`);
    process.exit(1);
  }
  engine = {
    name: "vrp-spec reference verifier (scripts/conformance.mjs verifyOfferVector)",
    version: JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).version,
    source: { repository: REPOSITORY, revision, path: "scripts/conformance.mjs" },
    digest: {
      alg: "sha256",
      value: sha256(readFileSync(join(repoRoot, "scripts/conformance.mjs"))),
      method: "sha256 of the file scripts/conformance.mjs at the stated revision",
    },
  };
  verify = async (vector) => {
    const { verified, reason, fresh } = verifyOfferVector(vector);
    return { verified, reason, fresh };
  };
  mapping = "none: the engine returns { verified, reason, fresh }";
} else {
  if (!args["engine-dir"]) {
    console.error("conformance-report: an adapter needs --engine-dir <checkout of the verifier>");
    process.exit(2);
  }
  const engineDir = resolve(args["engine-dir"]);
  const adapter = await import(pathToFileURL(resolve(args.engine)).href);
  if (git(engineDir, "status", "--porcelain") !== "") {
    console.error(`conformance-report: ${engineDir} has uncommitted changes; the report would bind to the wrong engine`);
    process.exit(1);
  }
  const d = adapter.describe(engineDir, { git, sha256 });
  engine = {
    name: d.name,
    version: d.version,
    source: { repository: d.repository, revision: git(engineDir, "rev-parse", "HEAD"), path: d.path },
    digest: d.digest,
  };
  verify = await adapter.load(engineDir);
  mapping = adapter.MAPPING;
  notes = adapter.NOTES;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const results = [];
for (const f of files) {
  const vector = JSON.parse(readFileSync(join(repoRoot, CORPUS, f), "utf8"));
  const expected = vector.expected;
  let observed;
  let outcome;
  let note;
  try {
    const r = await verify(vector);
    observed = { verified: r.verified, reason: r.reason, fresh: r.fresh };
    outcome = same(observed, expected) ? (expected.verified ? "pass" : "reject-as-required") : "inconclusive";
    if (outcome === "inconclusive") {
      note = observed.verified === expected.verified
        ? "The engine reached the expected accept/reject decision but reports a different reason or freshness."
        : expected.verified
          ? "The engine refused an offer the vector expects it to accept."
          : "The engine accepted an offer the vector expects it to refuse.";
    }
  } catch (error) {
    observed = { error: String(error?.message || error) };
    outcome = "void";
    note = "The adapter could not obtain a result.";
  }
  results.push({ vector: `${CORPUS}/${f}`, outcome, expected, observed, ...(note ? { note } : {}) });
}

const must_fail_controls = CONTROLS.map(([f, note]) => ({
  vector: `${CORPUS}/${f}`,
  expected: "reject-as-required",
  observed: results.find((r) => r.vector === `${CORPUS}/${f}`).outcome,
  note: `Declared must-fail control: ${note}`,
}));
const discriminates = must_fail_controls.every((c) => c.observed === "reject-as-required");
const count = (o) => results.filter((r) => r.outcome === o).length;

const report = {
  kind: "vrp_conformance_report",
  report_version: "0.1",
  engine,
  corpus: {
    repository: REPOSITORY,
    revision,
    path: CORPUS,
    version: "1.0-candidate",
    digest: {
      alg: "sha256",
      value: corpusDigest,
      method: `cd ${CORPUS} && ls *.json | LC_ALL=C sort | xargs sha256sum | sha256sum`,
    },
  },
  config: {
    clock: "injected per vector (`clock` field); no wall-clock dependency",
    key_resolution: "JWKS embedded in each vector; resolved by header kid",
    mapping,
    exclusions: [],
  },
  environment: { runtime: `node ${process.version}`, platform: `${process.platform} ${process.arch}`, ...(notes ? { notes } : {}) },
  run_at: args["run-at"],
  results,
  must_fail_controls,
  discriminates,
  // No aggregate is published when a declared control was not rejected.
  ...(discriminates
    ? {
        aggregate: {
          denominator: results.length,
          exercised: results.length - count("not-exercised"),
          distinguished: count("pass") + count("reject-as-required"),
          not_exercised: count("not-exercised"),
          inconclusive: count("inconclusive"),
          void: count("void"),
          note: "Counts only. Not a trust, safety, compliance, certification or whole-agent verdict.",
        },
      }
    : {}),
  reporter: "vrp-spec maintainers, run for the 1.0 candidate (ADR 0013 D6)",
};

writeFileSync(resolve(args.out), `${JSON.stringify(report, null, 2)}\n`);
const summary = ["pass", "reject-as-required", "inconclusive", "not-exercised", "void"].map((o) => `${o} ${count(o)}`).join(", ");
console.log(`wrote ${args.out}: ${results.length} vectors (${summary}); discriminates ${discriminates}`);
