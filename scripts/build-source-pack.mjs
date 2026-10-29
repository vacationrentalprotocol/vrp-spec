// Build the VRP Source Pack: one Markdown file containing the full VRP open
// standard, assembled deterministically from the canonical documents so it can
// be dropped into an AI notebook (Google NotebookLM / Gemini Notebook, ChatGPT,
// Claude Projects) or read/cited offline as a single source.
//
//   node scripts/build-source-pack.mjs          # write docs/source-pack.md
//   node scripts/build-source-pack.mjs --check   # fail if the file is stale
//
// Design notes:
// - No build timestamp is embedded, so regeneration is byte-deterministic and
//   the --check drift guard is meaningful in CI.
// - Every internal relative link is rewritten to an absolute URL: docs/ and
//   spec/ pages map to their canonical clean URLs; other repository files map to
//   GitHub blob/tree URLs. A reader in a notebook cannot follow repo-relative
//   links, and this also keeps the repository link checker happy.
// - Link/heading rewriting is fence-aware: fenced code blocks are left verbatim.

import fs from "node:fs";
import path from "node:path";
import { ORIGIN, GH, slug, resolveTarget, LINK_RE, mdToHtml } from "./lib/markdown.mjs";

const root = process.cwd();
const OUT = "docs/source-pack.md";

// Ordered, curated manifest — the reader-facing standard. Machine artifacts
// (JSON schemas, examples, contexts) are indexed as links in the appendix, not
// inlined. Internal QA docs and external proposals are intentionally excluded.
const MANIFEST = [
  { file: "docs/what-is-vrp.md", title: "What is VRP?" },
  { file: "spec/v0.1.md", title: "Core specification v0.1" },
  { file: "spec/well-known-uri-v0.1.md", title: "Well-Known URI v0.1" },
  { file: "spec/stayintent-discovery-v0.1.md", title: "StayIntent open discovery v0.1" },
  { file: "spec/structure-declarations-v0.1.md", title: "Node structure declarations v0.1" },
  { file: "spec/attestations-v0.1.md", title: "Portable attestations v0.1" },
  { file: "spec/attestation-status-bitstring-v0.1.md", title: "Attestation status (Bitstring Status List) v0.1" },
  { file: "spec/transparency-log-v0.1.md", title: "Transparency log v0.1" },
  { file: "spec/receipt-v1.md", title: "VRP receipt envelope v1" },
  { file: "spec/proof-chain-v0.1.md", title: "Booking Proof Chain v0.1" },
  { file: "spec/node-seal-v0.1.md", title: "Node Seal v0.1" },
  { file: "spec/addon-attestation-layer-v0.1.md", title: "Addon attestation layer v0.1" },
  { file: "spec/domain-continuity-v0.1.md", title: "Domain continuity v0.1" },
  { file: "spec/node-tool-binding-v0.1.md", title: "Node tool binding v0.1" },
  { file: "docs/implement-vrp.md", title: "Implement VRP signed offers" },
  { file: "docs/implement-attestations.md", title: "Implement portable attestations" },
  { file: "docs/agent-guide.md", title: "Agent integration guide" },
  { file: "docs/interop-and-trust-positioning.md", title: "Interop and trust positioning" },
  { file: "docs/first-mover-evidence-memo.md", title: "First-mover evidence memo" },
];

// Machine artifacts referenced by URL in the appendix (not inlined as JSON).
const MACHINE_ARTIFACTS = [
  ["VRP JSON-LD context", `${ORIGIN}/contexts/v1`],
  ["VRP terms vocabulary", `${ORIGIN}/terms`],
  ["Discovery JSON Schema", `${ORIGIN}/schemas/discovery-v0.1.schema.json`],
  ["JWKS JSON Schema", `${ORIGIN}/schemas/jwks-v0.1.schema.json`],
  ["Signed offer JSON Schema", `${ORIGIN}/schemas/verified-stay-offer-v0.1.schema.json`],
  ["Offer verification-result JSON Schema", `${ORIGIN}/schemas/verified-stay-offer-verification-result-v0.1.schema.json`],
  ["Attestations JSON Schema", `${ORIGIN}/schemas/attestations-v0.1.schema.json`],
  ["Receipt envelope JSON Schema", `${ORIGIN}/schemas/vrp-receipt.v1.schema.json`],
  ["StayIntent query JSON Schema", `${ORIGIN}/schemas/stayintent-query-v0.1.schema.json`],
  ["StayIntent response JSON Schema", `${ORIGIN}/schemas/stayintent-response-v0.1.schema.json`],
  ["Live reference node discovery", "https://villaakerlyckan.se/.well-known/vacation-rental.json"],
  ["In-browser offer verifier", `${ORIGIN}/verify`],
];

// Rewrite links + demote headings by two levels, skipping fenced code blocks.
function transform(body, srcFile) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let inFence = false;
  return lines
    .map((line) => {
      const fence = line.match(/^\s*(`{3,}|~{3,})/);
      if (fence) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      let out = line.replace(/^(#{1,6})(\s)/, (m, hashes, sp) => "#".repeat(Math.min(6, hashes.length + 2)) + sp);
      out = out.replace(LINK_RE, (m, label, tgt, title) => `${label}(${resolveTarget(tgt, srcFile)}${title})`);
      return out;
    })
    .join("\n");
}

// Wrap the rendered body in a neutral, self-contained HTML document. VRP has
// its own neutral identity — no HemmaBo branding here; the content itself
// states HemmaBo is only the reference implementer, not the owner.
function htmlDoc(bodyHtml) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>VRP Source Pack — the full standard on one page</title>
    <meta name="description" content="The full Vacation Rental Protocol (VRP) open standard on one HTML page, importable into AI notebooks such as Google NotebookLM, ChatGPT and Claude." />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${ORIGIN}/source-pack" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0 auto; max-width: 80ch; padding: 2.5rem 1.25rem 6rem;
        font: 16px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #1a1d1c; background: #ffffff;
      }
      @media (prefers-color-scheme: dark) { body { color: #e6e8e6; background: #0f1211; } }
      h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 2.2em 0 0.6em; }
      h1 { font-size: 2rem; } h2 { font-size: 1.5rem; } h3 { font-size: 1.2rem; }
      a { color: #147d73; } @media (prefers-color-scheme: dark) { a { color: #6fd3c6; } }
      code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.9em; }
      pre { overflow-x: auto; padding: 1rem; border-radius: 6px; background: #f4f6f5; }
      @media (prefers-color-scheme: dark) { pre { background: #171b1a; } }
      pre code { font-size: 0.85em; }
      table { border-collapse: collapse; width: 100%; display: block; overflow-x: auto; margin: 1em 0; }
      th, td { border: 1px solid #d8dfdc; padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
      @media (prefers-color-scheme: dark) { th, td { border-color: #2a302e; } }
      hr { border: 0; border-top: 1px solid #d8dfdc; margin: 2.5rem 0; }
      @media (prefers-color-scheme: dark) { hr { border-color: #2a302e; } }
      blockquote { margin: 1em 0; padding-left: 1rem; border-left: 3px solid #d8dfdc; color: #5c6863; }
    </style>
  </head>
  <body>
${bodyHtml}
  </body>
</html>
`;
}

function build() {
  const parts = [];
  parts.push(`# Vacation Rental Protocol (VRP) — Source Pack

**One file containing the full VRP open standard**, assembled for AI notebooks
(Google NotebookLM / Gemini Notebook, ChatGPT, Claude Projects) and for offline
reading and citation.

- Standard: **Vacation Rental Protocol (VRP)**, public draft **v0.1**
- Author & maintainer: **Rouiada Abbas** — VRP is an open standard with no central gatekeeper
- Reference implementation: **HemmaBo** (not the owner of the standard)
- Canonical site: <${ORIGIN}>
- Repository: <${GH}>
- Specification text is dedicated to the public domain under **CC0 1.0** (see <${GH}/blob/main/LICENSE>); reference code: <${GH}/blob/main/LICENSE-CODE>.

This pack is generated from the canonical documents; each section links to its
live source. If anything here disagrees with the canonical site, **the canonical
URL is authoritative.**

## How to use this in an AI notebook

- **Google NotebookLM / Gemini Notebook:** Add source → Website, and paste
  <${ORIGIN}/source-pack> (the HTML edition). NotebookLM's website importer
  needs an HTML page, not raw Markdown — the HTML edition carries this exact
  same standard. You can also download this file and upload it directly.
- **ChatGPT / Claude Projects:** attach this file, or paste either URL — the
  Markdown edition <${ORIGIN}/docs/source-pack> or the HTML edition
  <${ORIGIN}/source-pack>.
- Same content, two formats: the Markdown edition for tools that read
  text/Markdown, the HTML edition for website importers.

## Contents
`);
  MANIFEST.forEach((m, i) => {
    parts.push(`${i + 1}. [${m.title}](${ORIGIN}/${slug(m.file)})`);
  });
  parts.push(`${MANIFEST.length + 1}. Appendix: machine artifacts (schemas, context, live node)`);

  MANIFEST.forEach((m, i) => {
    const abs = path.join(root, m.file);
    const body = fs.readFileSync(abs, "utf8").trimEnd();
    parts.push(`
${"=".repeat(72)}
## ${i + 1}. ${m.title}

*Canonical source: <${ORIGIN}/${slug(m.file)}>*
${"=".repeat(72)}

${transform(body, m.file)}`);
  });

  parts.push(`
${"=".repeat(72)}
## ${MANIFEST.length + 1}. Appendix — machine artifacts

The documents above are the human-readable standard. The following machine
artifacts are referenced by URL rather than inlined; fetch them directly when
implementing or verifying.
`);
  for (const [label, url] of MACHINE_ARTIFACTS) {
    parts.push(`- ${label}: <${url}>`);
  }

  parts.push(`
---

*End of the Vacation Rental Protocol Source Pack (v0.1). Canonical: <${ORIGIN}>.*
`);

  return parts.join("\n").replace(/\n{4,}/g, "\n\n\n").trimEnd() + "\n";
}

const content = build();
const htmlContent = htmlDoc(mdToHtml(content));

// The HTML edition lives OUTSIDE /docs and /spec (whose Vercel headers force
// text/markdown) and is not a top-level *.html file, so it is served as
// text/html and stays clear of the landing-page updated-stamp guard.
const OUT_HTML = "pages/source-pack.html";

const outputs = [
  [OUT, content],
  [OUT_HTML, htmlContent],
];

if (process.argv.includes("--check")) {
  let stale = false;
  for (const [rel, expected] of outputs) {
    const p = path.join(root, rel);
    const current = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
    if (current !== expected) {
      console.error(`✗ ${rel} is stale. Run: npm run build-source-pack`);
      stale = true;
    } else {
      console.log(`✓ ${rel} is up to date`);
    }
  }
  process.exit(stale ? 1 : 0);
} else {
  for (const [rel, data] of outputs) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, data);
    console.log(`✓ wrote ${rel} (${data.length} bytes)`);
  }
  console.log(`  ${MANIFEST.length} sections`);
}
