// Node page identification (spec/v0.1.md §2.1, ADR 0006).
//
// Offline (npm test): runs every vector listed in
// examples/conformance/node-page/vectors.json through checkNodePage() and
// compares the outcome of the two SHOULD-level checks (a) head link and (b)
// visible body link with the vector's expectation.
//
// Live:  node scripts/verify-node-page.mjs --live example-host.invalid
//        fetches https://example-host.invalid/ and reports (a)–(e); exits 1
//        when (a) or (b) fails.
//
// The checker parses attributes; it never matches literal tag text, so a
// self-closing <link … /> and any attribute order pass alike.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://vacationrentalprotocol.com";
const REL_URI = `${ORIGIN}/rel/protocol`;
const TERM = `${ORIGIN}/terms#VRPVacationRental`;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const vectorsDir = join(repoRoot, "examples/conformance/node-page");

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// Attributes of one start tag. `inner` is the text between "<" and ">".
function parseAttrs(inner) {
  const attrs = {};
  const rest = inner.replace(/^[A-Za-z][^\s/>]*/, "");
  const re = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(rest)) !== null) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

function relTokens(value) {
  return (value || "").toLowerCase().split(/\s+/).filter(Boolean);
}

// Where a rel="protocol" href may point: the standard's root, or its verify
// page for this node. Anything else — another origin, an implementation, a
// vendor — fails (ADR 0002).
function checkHref(href, { canonicalDomain } = {}) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return { ok: false, reason: `href "${href}" is not an absolute URL` };
  }
  if (url.origin !== ORIGIN) return { ok: false, reason: `href origin ${url.origin} is not ${ORIGIN}` };
  if (url.pathname === "/") return { ok: true, target: "root" };
  if (url.pathname === "/verify") {
    const host = url.searchParams.get("host");
    if (!host) return { ok: false, reason: "/verify link carries no host parameter" };
    if (canonicalDomain && host.toLowerCase() !== canonicalDomain.toLowerCase()) {
      return { ok: false, reason: `/verify?host=${host} is not this node (${canonicalDomain})` };
    }
    return { ok: true, target: "verify", host };
  }
  return { ok: false, reason: `href path ${url.pathname} is neither / nor /verify` };
}

export function checkNodePage(html, { canonicalDomain, linkHeader } = {}) {
  const headEnd = html.search(/<\/head\s*>/i);
  const head = headEnd >= 0 ? html.slice(0, headEnd) : html;
  const body = headEnd >= 0 ? html.slice(headEnd) : html;

  // (a) <link rel="protocol" href="https://vacationrentalprotocol.com/"> in the head.
  const links = [...head.matchAll(/<link\b([^>]*)>/gi)].map((m) => parseAttrs(`link${m[1]}`));
  const headLink = links.find((attrs) => relTokens(attrs.rel).includes("protocol"));
  const a = { ok: false, reason: 'no <link rel="protocol"> in the document head' };
  if (headLink) {
    const r = checkHref(headLink.href || "");
    if (r.ok && r.target === "root") {
      a.ok = true;
      a.reason = `head link → ${headLink.href}`;
    } else {
      a.reason = r.ok ? "the head link must point at the root of the standard" : r.reason;
    }
  }

  // (b) a visible <a rel="protocol"> in the body, on the standard's origin, with "VRP" in its text.
  const anchors = [...body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)].map((m) => ({
    attrs: parseAttrs(`a${m[1]}`),
    text: decodeEntities(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(),
  }));
  const candidates = anchors.filter((x) => relTokens(x.attrs.rel).includes("protocol"));
  const b = { ok: false, reason: 'no <a rel="protocol"> in the document body' };
  for (const x of candidates) {
    if ("hidden" in x.attrs || x.attrs["aria-hidden"] === "true" || /display\s*:\s*none/i.test(x.attrs.style || "")) {
      b.reason = 'the <a rel="protocol"> is hidden';
      continue;
    }
    const r = checkHref(x.attrs.href || "", { canonicalDomain });
    if (!r.ok) {
      b.reason = r.reason;
      continue;
    }
    if (!x.text.includes("VRP")) {
      b.reason = `link text "${x.text}" does not contain VRP`;
      continue;
    }
    b.ok = true;
    b.reason = `visible link "${x.text}" → ${x.attrs.href}`;
    break;
  }

  // (c)–(e): reported, not enforced. (c) is only measurable with response headers.
  const c = linkHeader === undefined || linkHeader === null
    ? null
    : new RegExp(`<${ORIGIN.replace(/[.]/g, "\\.")}/?>\\s*;\\s*rel="${REL_URI.replace(/[.]/g, "\\.")}"`, "i").test(linkHeader);
  const d = html.includes(TERM);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, " ").trim() : "";
  const e = title.includes("VRP");

  return { must: { a, b }, should: { c, d, e, title }, pass: a.ok && b.ok };
}

function report(result) {
  const mark = (ok) => (ok === null ? " —  " : ok ? " ok " : "FAIL");
  console.log(`  ${mark(result.must.a.ok)} (a) head link: ${result.must.a.reason}`);
  console.log(`  ${mark(result.must.b.ok)} (b) visible link: ${result.must.b.reason}`);
  console.log(`  ${mark(result.should.c)} (c) Link header rel="${REL_URI}"${result.should.c === null ? " (not measurable here)" : ""}`);
  console.log(`  ${mark(result.should.d)} (d) JSON-LD additionalType ${TERM}`);
  console.log(`  ${mark(result.should.e)} (e) title names VRP: "${result.should.title}"`);
}

async function runLive(domain) {
  const url = `https://${domain}/`;
  const response = await fetch(url, { redirect: "follow", headers: { accept: "text/html" } });
  const html = await response.text();
  console.log(`${url} → HTTP ${response.status}`);
  const result = checkNodePage(html, { canonicalDomain: domain, linkHeader: response.headers.get("link") });
  report(result);
  console.log(result.pass ? "\nNode page checks (a) and (b) pass." : "\nNode page check failed.");
  process.exit(result.pass ? 0 : 1);
}

function runVectors() {
  const manifest = JSON.parse(readFileSync(join(vectorsDir, "vectors.json"), "utf8"));
  const failures = [];
  for (const v of manifest.vectors) {
    const html = readFileSync(join(vectorsDir, v.file), "utf8");
    const result = checkNodePage(html, { canonicalDomain: v.canonical_domain });
    const got = { a: result.must.a.ok, b: result.must.b.ok, pass: result.pass };
    const same = got.a === v.expected.a && got.b === v.expected.b && got.pass === v.expected.pass;
    console.log(`  ${same ? "ok  " : "FAIL"} ${v.file}: ${v.name}`);
    if (!same) {
      failures.push(v.file);
      console.log(`       expected ${JSON.stringify(v.expected)}, got ${JSON.stringify(got)}`);
      console.log(`       (a) ${result.must.a.reason}\n       (b) ${result.must.b.reason}`);
    }
  }
  if (failures.length > 0) {
    console.error(`\nNode page vectors FAILED: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log(`\nNode page vectors OK (${manifest.vectors.length} vectors, spec/v0.1.md §2.1).`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const liveIndex = process.argv.indexOf("--live");
  if (liveIndex !== -1) {
    const domain = process.argv[liveIndex + 1];
    if (!domain) {
      console.error("usage: node scripts/verify-node-page.mjs --live <canonical_domain>");
      process.exit(2);
    }
    await runLive(domain);
  } else {
    runVectors();
  }
}
