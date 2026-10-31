#!/usr/bin/env node
// Writes sitemap.xml: one <url> per public HTML page, <lastmod> taken from git.
//
// Only pages a person reads are listed. The machine files (JSON Schemas,
// example and conformance JSON, the JSON-LD context, the Markdown source pack)
// stay public and are listed in llms.txt for agents; in the sitemap they were
// crawled and not indexed (Search Console, 2026-10-31), and IndexNow pinged
// them on every deploy. check-public-routes.mjs keeps every sitemap route an
// HTML page and every HTML route in llms.txt in the sitemap.
//
// <lastmod> is the committer date (git `%cs`, YYYY-MM-DD in the committer's
// recorded zone — never `--date=local`) of the last commit that touched the
// file a route serves. A file with uncommitted changes gets today's date, so
// one commit carries both the edit and the regenerated sitemap. sitemaps.org:
// lastmod is "the date the linked page was last modified, not when the
// sitemap is generated".
//
//   node scripts/build-sitemap.mjs          writes sitemap.xml
//   node scripts/build-sitemap.mjs --check  exits 1 when sitemap.xml is stale
//
// Needs full git history (CI: actions/checkout with fetch-depth: 0). On a
// shallow clone every file would be dated to the one commit present, so the
// script refuses to run there. On a pull request's synthetic merge commit git
// follows the parent whose tree already holds the file, so a file edited only
// in the PR keeps the PR's own commit date. A squash merge restamps every file
// it touches to the merge date: the first PR after one that touched a served
// file runs `npm run build-sitemap` once to catch up (dates only).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ORIGIN = "https://vacationrentalprotocol.com";
const OUT = "sitemap.xml";

// Route -> the repo file that serves it (vercel.json rewrites + cleanUrls), in
// the order sitemap.xml has listed them. HTML pages only (see above).
const ROUTES = [
  ["/", "index.html"],
  ["/vrp-vacation-rental", "vrp-vacation-rental.html"],
  ["/docs/what-is-vrp", "docs/what-is-vrp.md"],
  ["/source-pack", "pages/source-pack.html"],
  ["/reference-implementation", "reference-implementation.html"],
  ["/verify", "verify.html"],
  ["/declarations", "declarations.html"],
  ["/implement", "implement.html"],
  ["/film", "film.html"],
  ["/demo", "demo.html"],
  ["/docs/first-mover-evidence-memo", "docs/first-mover-evidence-memo.md"],
  ["/terms", "terms.html"],
  ["/rel/protocol", "rel/protocol.html"],
  ["/spec/v0.1", "spec/v0.1.md"],
  ["/spec/attestations-v0.1", "spec/attestations-v0.1.md"],
  ["/spec/well-known-uri-v0.1", "spec/well-known-uri-v0.1.md"],
  ["/spec/stayintent-discovery-v0.1", "spec/stayintent-discovery-v0.1.md"],
  ["/spec/transparency-log-v0.1", "spec/transparency-log-v0.1.md"],
  ["/spec/attestation-status-bitstring-v0.1", "spec/attestation-status-bitstring-v0.1.md"],
  ["/docs/interop-and-trust-positioning", "docs/interop-and-trust-positioning.md"],
  ["/docs/interop/cm-ai-docking-port", "docs/interop/cm-ai-docking-port.md"],
  ["/docs/agent-guide", "docs/agent-guide.md"],
  ["/docs/implement-vrp", "docs/implement-vrp.md"],
  ["/docs/implement-attestations", "docs/implement-attestations.md"],
  ["/docs/adr/0002-no-gatekeeper-trust-and-interop", "docs/adr/0002-no-gatekeeper-trust-and-interop.md"],
  ["/spec/receipt-v1", "spec/receipt-v1.md"],
  ["/spec/proof-chain-v0.1", "spec/proof-chain-v0.1.md"],
  ["/spec/node-seal-v0.1", "spec/node-seal-v0.1.md"],
  ["/spec/addon-attestation-layer-v0.1", "spec/addon-attestation-layer-v0.1.md"],
  ["/spec/domain-continuity-v0.1", "spec/domain-continuity-v0.1.md"],
  ["/spec/node-tool-binding-v0.1", "spec/node-tool-binding-v0.1.md"],
  ["/verify-receipt", "verify-receipt.html"],
  ["/docs/conformance-report", "docs/conformance-report.md"],
];

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

if (git("rev-parse", "--is-shallow-repository") === "true") {
  console.error("build-sitemap: shallow clone — git dates would all be HEAD's. Fetch full history (fetch-depth: 0).");
  process.exit(1);
}

function lastmod(file) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`${file}: file does not exist`);
  if (git("status", "--porcelain", "--", file) !== "") return today();
  const date = git("log", "-1", "--format=%cs", "HEAD", "--", file);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${file}: no commit touches it`);
  return date;
}

const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
for (const [route, file] of ROUTES) {
  lines.push("  <url>", `    <loc>${ORIGIN}${route}</loc>`, `    <lastmod>${lastmod(file)}</lastmod>`, "  </url>");
}
lines.push("</urlset>", "");
const expected = lines.join("\n");

const rows = (xml) =>
  new Map([...xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]));

if (process.argv.includes("--check")) {
  const outPath = path.join(root, OUT);
  const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf8") : "";
  if (current !== expected) {
    console.error(`✗ ${OUT} is stale. Run: npm run build-sitemap`);
    const have = rows(current);
    for (const [loc, date] of rows(expected)) {
      if (have.get(loc) !== date) console.error(`  ${loc}: sitemap ${have.get(loc) ?? "<missing>"} -> git ${date}`);
    }
    process.exit(1);
  }
  console.log(`✓ ${OUT} is up to date (${ROUTES.length} routes)`);
} else {
  fs.writeFileSync(path.join(root, OUT), expected);
  console.log(`✓ wrote ${OUT} (${ROUTES.length} routes)`);
}
