#!/usr/bin/env node
// Renders every Markdown document under spec/ and docs/ to an HTML page under
// pages/, served at the document's clean URL (vercel.json rewrites
// /spec/:slug → /pages/spec/:slug, /docs/:slug → /pages/docs/:slug, and the
// one-directory-deeper forms). The Markdown file stays where it is and is
// served unchanged at its .md URL for agents, with a Link: rel="canonical"
// header pointing at the clean URL (vercel.json).
//
//   node scripts/build-pages.mjs          # write pages/spec/**, pages/docs/**
//   node scripts/build-pages.mjs --check  # exit 1 when any page is stale
//
// Why: a clean URL that answers with raw text/markdown has no <title>, no
// canonical and no document structure, and Google Search Console reported
// every such URL as "Crawled – currently not indexed" (measured 2026-10-26).
// The HTML page carries the site's shell (styles.css, the landing page's
// navigation), <title>, meta description, canonical, Open Graph and a
// TechArticle JSON-LD record, and links to its Markdown twin.
//
// Deterministic: no timestamps, so the --check guard is meaningful in CI.
// docs/source-pack.md is excluded: it is the Markdown edition of the source
// pack, whose HTML edition is pages/source-pack.html (/source-pack).

import fs from "node:fs";
import path from "node:path";
import { ORIGIN, GH, escHtml, mdToHtml, rewriteLinks, summarize } from "./lib/markdown.mjs";

const root = process.cwd();
const SOURCE_DIRS = ["spec", "docs"];
const EXCLUDED = new Set(["docs/source-pack.md"]);
const OUT_DIR = "pages";
const SITE_NAME = "Vacation Rental Protocol (VRP)";

function walkMarkdown(dir, result = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walkMarkdown(rel, result);
    else if (entry.name.endsWith(".md")) result.push(rel);
  }
  return result;
}

export function sourceFiles() {
  return SOURCE_DIRS.flatMap((d) => walkMarkdown(d)).filter((f) => !EXCLUDED.has(f)).sort();
}

// The landing page's navigation, read from index.html so the two never drift.
function siteNav() {
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const m = index.match(/<header class="site-header">[\s\S]*?<\/header>/);
  if (!m) throw new Error("index.html: site header not found");
  return m[0];
}

function cleanUrlFor(file) {
  return `${ORIGIN}/${file.replace(/\.md$/, "")}`;
}

function outputPathFor(file) {
  return `${OUT_DIR}/${file.replace(/\.md$/, ".html")}`;
}

function jsonLd(url, title, description, file) {
  const record = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "@id": `${url}#techarticle`,
    headline: title,
    description,
    url,
    inLanguage: "en",
    isPartOf: { "@id": `${ORIGIN}/#website` },
    about: { "@id": `${ORIGIN}/#vrp` },
    author: { "@type": "Person", name: "Rouiada Abbas" },
    license: "https://creativecommons.org/publicdomain/zero/1.0/",
    encoding: { "@type": "MediaObject", encodingFormat: "text/markdown", contentUrl: `${ORIGIN}/${file}` },
    codeRepository: `${GH}/blob/main/${file}`,
  };
  // "<" never appears in this data, but keep the script body safe by construction.
  return JSON.stringify(record, null, 2).replace(/</g, "\\u003c");
}

export function renderPage(file, md, nav) {
  const { title, description } = summarize(md);
  const pageTitle = title || path.basename(file, ".md");
  // "name | Vacation Rental Protocol", unless the name already carries it.
  const fullTitle = /Vacation Rental Protocol/i.test(pageTitle) ? pageTitle : `${pageTitle} | Vacation Rental Protocol`;
  const url = cleanUrlFor(file);
  const body = mdToHtml(rewriteLinks(md, file), { headingIds: true });
  const section = file.startsWith("spec/") ? "Specification" : "Documentation";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escHtml(fullTitle)}</title>
    <meta name="description" content="${escHtml(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${escHtml(pageTitle)}" />
    <meta property="og:description" content="${escHtml(description)}" />
    <meta property="og:url" content="${url}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escHtml(description)}" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${url}" />
    <link rel="alternate" type="text/markdown" href="${url}.md" title="Markdown source" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/styles.css" />
    <style>
      .doc { max-width: 80ch; margin: 0 auto; padding: 2.5rem 1.25rem 6rem; line-height: 1.7; }
      .doc h1, .doc h2, .doc h3, .doc h4 { line-height: 1.25; margin: 2.2em 0 0.6em; }
      .doc h1 { margin-top: 0.6em; }
      .doc pre { overflow-x: auto; padding: 1rem; border-radius: 6px; background: #f4f6f5; }
      .doc pre code { font-size: 0.85em; }
      .doc table { border-collapse: collapse; width: 100%; display: block; overflow-x: auto; margin: 1em 0; }
      .doc th, .doc td { border: 1px solid #d8dfdc; padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
      .doc hr { border: 0; border-top: 1px solid #d8dfdc; margin: 2.5rem 0; }
      .doc blockquote { margin: 1em 0; padding-left: 1rem; border-left: 3px solid #d8dfdc; color: #5c6863; }
      .doc .doc-meta { font-size: 0.85rem; color: #5c6863; margin: 0 0 1.5rem; }
      .doc .doc-meta a { color: inherit; }
      @media (prefers-color-scheme: dark) {
        .doc pre { background: #171b1a; }
        .doc th, .doc td, .doc hr, .doc blockquote { border-color: #2a302e; }
      }
    </style>
    <script type="application/ld+json">
${jsonLd(url, pageTitle, description, file)}
    </script>
  </head>
  <body>
${nav}

    <main class="doc">
      <p class="doc-meta">${section} · <a href="${url}.md">Markdown source</a> · <a href="${GH}/blob/main/${file}">Edit on GitHub</a> · CC0 1.0</p>
      <article>
${body}
      </article>
    </main>
  </body>
</html>
`;
}

export function buildAll() {
  const nav = siteNav();
  return sourceFiles().map((file) => {
    const md = fs.readFileSync(path.join(root, file), "utf8");
    return [outputPathFor(file), renderPage(file, md, nav)];
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  const outputs = buildAll();
  if (process.argv.includes("--check")) {
    let stale = false;
    for (const [rel, expected] of outputs) {
      const p = path.join(root, rel);
      const current = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
      if (current !== expected) {
        console.error(`✗ ${rel} is stale. Run: npm run build-pages`);
        stale = true;
      }
    }
    // A page whose source is gone must go too.
    const expectedSet = new Set(outputs.map(([rel]) => rel));
    for (const dir of SOURCE_DIRS) {
      const base = path.join(root, OUT_DIR, dir);
      if (!fs.existsSync(base)) continue;
      const stack = [base];
      while (stack.length) {
        const d = stack.pop();
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const abs = path.join(d, entry.name);
          if (entry.isDirectory()) stack.push(abs);
          else if (!expectedSet.has(path.relative(root, abs).replace(/\\/g, "/"))) {
            console.error(`✗ ${path.relative(root, abs)} has no Markdown source. Run: npm run build-pages`);
            stale = true;
          }
        }
      }
    }
    if (!stale) console.log(`✓ ${outputs.length} rendered pages are up to date`);
    process.exit(stale ? 1 : 0);
  } else {
    for (const [rel, data] of outputs) {
      const p = path.join(root, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, data);
    }
    console.log(`✓ wrote ${outputs.length} pages under ${OUT_DIR}/`);
  }
}
