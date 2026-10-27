// Checks that public VRP documentation routes, links, and Vercel rewrites stay
// consistent. This is a repository/publication check, not a runtime tool.

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const canonicalOrigin = "https://vacationrentalprotocol.com";
const live = process.argv.includes("--live") || process.env.VRP_LIVE_ROUTE_CHECK === "1";
const failures = [];

function readText(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

function walk(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".vercel") continue;
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absPath, result);
    } else {
      result.push(path.relative(root, absPath).replace(/\\/g, "/"));
    }
  }
  return result;
}

function fail(message) {
  failures.push(message);
}

function fileExists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function routePathFromUrl(url) {
  const parsed = new URL(url);
  if (parsed.origin !== canonicalOrigin) fail(`${url}: expected origin ${canonicalOrigin}`);
  let pathname = parsed.pathname || "/";
  if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  return pathname;
}

function extractCanonicalUrls(relPath) {
  const text = readText(relPath);
  const matches = text.match(/https:\/\/vacationrentalprotocol\.com[^\s<>"')]+/g) || [];
  return [...new Set(matches.map((url) => url.replace(/[.,;:]+$/, "")))];
}

function htmlFiles() {
  return walk(root).filter((file) => file.endsWith(".html"));
}

// Internal hrefs of a static HTML page: root-relative ("/spec/v0.1") plus
// absolute canonical-origin hrefs. Only href attributes are read, never page
// text (pages/source-pack.html carries an escaped JSON sample ending in
// contexts/v1&quot;]). Fragments and queries are dropped later by
// routePathFromUrl (URL.pathname).
function extractInternalHrefs(relPath) {
  const text = readText(relPath);
  const hrefs = [...text.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  const rootRelative = hrefs
    .filter((href) => href.startsWith("/") && !href.startsWith("//"))
    .map((href) => `${canonicalOrigin}${href}`);
  const absolute = hrefs.filter((href) => href === canonicalOrigin || href.startsWith(`${canonicalOrigin}/`));
  return [...new Set([...rootRelative, ...absolute])];
}

// Markdown link targets on the canonical origin: only "](https://...)" targets.
// extractCanonicalUrls would also capture backtick-wrapped mentions and CSV
// cells in docs/source-pack.md.
function extractMarkdownLinkUrls(relPath) {
  const text = readText(relPath);
  const matches = [...text.matchAll(/\]\((https:\/\/vacationrentalprotocol\.com[^)\s]*)\)/g)].map((match) => match[1]);
  return [...new Set(matches)];
}

function sitemapUrls() {
  return [...readText("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function requiredCanonicalUrls() {
  return [
    `${canonicalOrigin}/contexts/v1.jsonld`,
    `${canonicalOrigin}/llms.txt`,
    `${canonicalOrigin}/robots.txt`,
    `${canonicalOrigin}/sitemap.xml`,
  ];
}

function markdownFiles() {
  return walk(root).filter((file) => file.endsWith(".md"));
}

function normalizeMarkdownTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith("<") && target.includes(">")) {
    target = target.slice(1, target.indexOf(">"));
  } else {
    target = target.split(/\s+/)[0];
  }
  return target;
}

function checkMarkdownLinks() {
  const localLinkPattern = /!?\[[^\]]*]\(([^)]+)\)/g;

  for (const file of markdownFiles()) {
    const text = readText(file);
    let match;
    while ((match = localLinkPattern.exec(text)) !== null) {
      const target = normalizeMarkdownTarget(match[1]);
      if (!target || target.startsWith("#")) continue;
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;

      const withoutFragment = target.split("#")[0].split("?")[0];
      if (!withoutFragment) continue;

      const absTarget = path.resolve(root, path.dirname(file), decodeURIComponent(withoutFragment));
      const relTarget = path.relative(root, absTarget).replace(/\\/g, "/");
      if (relTarget.startsWith("..") || path.isAbsolute(relTarget)) {
        fail(`${file}: local link escapes repository: ${target}`);
        continue;
      }
      if (!fs.existsSync(absTarget)) fail(`${file}: broken local link: ${target}`);
    }
  }
}

const vercel = readJson("vercel.json");

function stripLeadingSlash(value) {
  return value.replace(/^\//, "");
}

// Mirror Vercel's header `source` matching (path-to-regexp): text outside
// parentheses is literal, a parenthesised group is a regular expression
// (`(.*)`, or a group with a negative lookahead such as `((?!.*\.md$).*)`,
// the form Vercel documents for rewrites), and the whole pattern is anchored.
function sourceToRegExp(source) {
  let pattern = "";
  let i = 0;
  while (i < source.length) {
    if (source[i] !== "(") {
      pattern += source[i].replace(/[.+?^${}|[\]\\]/g, "\\$&");
      i++;
      continue;
    }
    let depth = 0;
    const start = i;
    do {
      if (source[i] === "(") depth++;
      else if (source[i] === ")") depth--;
      i++;
    } while (i < source.length && depth > 0);
    if (depth !== 0) throw new Error(`vercel.json: unbalanced parentheses in header source ${source}`);
    pattern += source.slice(start, i);
  }
  return new RegExp(`^${pattern}$`);
}

function routeMatchesSource(route, source) {
  if (!source.includes("(")) return route === source;
  return sourceToRegExp(source).test(route);
}

// Mirror Vercel's rewrite matching: `source` is a path-to-regexp pattern in
// which ":name" matches one path segment and ":name*" a path of one or more
// segments (no ":name*" source exists today); the first matching entry wins
// and its parameters are substituted into `destination`. Rewrite sources are
// plain paths or ":name" segments — no regex groups — so every other
// character is escaped as a literal.
function rewriteDestination(route) {
  for (const item of vercel.rewrites || []) {
    const pattern = item.source
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/:([A-Za-z0-9_]+)\*/g, "(?<$1>.+)")
      .replace(/:([A-Za-z0-9_]+)/g, "(?<$1>[^/]+)");
    const match = route.match(new RegExp(`^${pattern}$`));
    if (!match) continue;
    return item.destination.replace(/:([A-Za-z0-9_]+)\*?/g, (m, name) => match.groups?.[name] ?? m);
  }
  return null;
}

// Resolve a repo-relative candidate to a file that actually ships. Vercel's
// cleanUrls strips the extension of HTML files (and functions) only, so an
// extensionless Markdown route is served solely through a vercel.json rewrite.
// This applies to rewrite destinations too — with cleanUrls a destination like
// "/pages/source-pack" is served from pages/source-pack.html, and a
// destination ending in ".html" is 308-redirected to the clean form (so
// extensionless is the correct destination to author).
function resolveExisting(relPath) {
  if (fileExists(relPath)) return relPath;
  if (vercel.cleanUrls && fileExists(`${relPath}.html`)) return `${relPath}.html`;
  return null;
}

function resolveRoute(route) {
  if (route === "/") return "index.html";

  // Vercel: "precedence is given to the filesystem prior to rewrites being
  // applied", so a request for an existing file (/spec/v0.1.md) is served
  // before any rewrite pattern (/spec/:slug) is consulted.
  const direct = resolveExisting(stripLeadingSlash(route));
  if (direct) return direct;

  const destination = rewriteDestination(route);
  if (destination) return resolveExisting(stripLeadingSlash(destination));

  return null;
}

function headerContentType(route) {
  const values = [];
  for (const entry of vercel.headers || []) {
    if (!routeMatchesSource(route, entry.source)) continue;
    const contentType = entry.headers?.find((header) => header.key.toLowerCase() === "content-type");
    if (contentType) values.push(contentType.value);
  }
  // Two rules that set different Content-Type values on one route would make
  // the served type depend on rule order; keep header rules disjoint instead.
  if (new Set(values).size > 1) fail(`vercel.json: conflicting Content-Type rules for ${route}: ${values.join(" | ")}`);
  return values.at(-1) || null;
}

function linkHeaderFor(route) {
  for (const entry of vercel.headers || []) {
    if (!routeMatchesSource(route, entry.source)) continue;
    const link = entry.headers?.find((header) => header.key.toLowerCase() === "link");
    if (link) return link.value;
  }
  return null;
}

// Exact-path header rules that set a Link header (the .md twins of the
// sitemap's Markdown documents).
function linkHeaderRoutes() {
  return (vercel.headers || [])
    .filter((entry) => entry.headers?.some((header) => header.key.toLowerCase() === "link"))
    .map((entry) => entry.source)
    .filter((source) => !/[(:*]/.test(source));
}

function expectedContentType(route, resolvedPath) {
  if (route === "/") return null;
  if (route === "/contexts/v1" || route.endsWith(".jsonld")) return "application/ld+json";
  if (route === "/terms" || resolvedPath?.endsWith(".html")) return "text/html";
  if (route === "/sitemap.xml") return "application/xml";
  if (route === "/llms.txt" || route === "/robots.txt") return "text/plain";
  if (route.startsWith("/schemas/")) return "application/schema+json";
  if (route.startsWith("/examples/") && route.endsWith(".json")) return "application/json";
  if (route.startsWith("/spec/") || route.startsWith("/docs/")) return "text/markdown";
  return null;
}

function checkPublicRoutes() {
  const urls = new Set([
    ...requiredCanonicalUrls(),
    ...sitemapUrls(),
    ...extractCanonicalUrls("README.md"),
    ...extractCanonicalUrls("llms.txt"),
    ...extractMarkdownLinkUrls("docs/source-pack.md"),
    ...htmlFiles().flatMap(extractInternalHrefs),
  ]);

  const sitemapRoutes = new Set(sitemapUrls().map(routePathFromUrl));
  const llmsRoutes = new Set(extractCanonicalUrls("llms.txt").map(routePathFromUrl));

  for (const route of llmsRoutes) {
    if (!sitemapRoutes.has(route)) fail(`llms.txt: canonical route missing from sitemap.xml: ${route}`);
  }
  for (const route of sitemapRoutes) {
    if (!llmsRoutes.has(route)) fail(`sitemap.xml: route missing from llms.txt: ${route}`);
  }

  for (const source of linkHeaderRoutes()) {
    if (!fileExists(stripLeadingSlash(source))) fail(`vercel.json: Link header source is not a file: ${source}`);
    const canonical = linkHeaderFor(source).match(/^<([^>]+)>; rel="canonical"$/)?.[1];
    if (!canonical) fail(`vercel.json: Link header for ${source} is not <url>; rel="canonical"`);
    else if (!sitemapRoutes.has(routePathFromUrl(canonical))) fail(`vercel.json: canonical ${canonical} for ${source} is not a sitemap route`);
  }

  for (const url of urls) {
    const route = routePathFromUrl(url);
    const resolvedPath = resolveRoute(route);
    if (!resolvedPath) {
      fail(`${url}: no local file or Vercel rewrite resolves route ${route}`);
      continue;
    }
    if (!fileExists(resolvedPath)) fail(`${url}: resolved file does not exist: ${resolvedPath}`);

    const expectedType = expectedContentType(route, resolvedPath);
    if (!expectedType) continue;

    const configuredType = headerContentType(route);
    if (!configuredType) {
      fail(`${url}: missing Vercel Content-Type header for route ${route}`);
    } else if (!configuredType.startsWith(expectedType)) {
      fail(`${url}: expected Content-Type ${expectedType}, got ${configuredType}`);
    }
  }
}

async function checkLiveRoutes() {
  const urls = [...new Set([
    ...requiredCanonicalUrls(),
    ...sitemapUrls(),
    ...extractMarkdownLinkUrls("docs/source-pack.md"),
    ...htmlFiles().flatMap(extractInternalHrefs),
    ...linkHeaderRoutes().map((route) => `${canonicalOrigin}${route}`),
  ])];
  const jsonLdUrl = `${canonicalOrigin}/contexts/v1.jsonld`;
  let jsonLdBody = null;
  const bodyMustMatchRepository = new Map([
    ["/contexts/v1", "contexts/v1.jsonld"],
    ["/contexts/v1.jsonld", "contexts/v1.jsonld"],
    ["/llms.txt", "llms.txt"],
    ["/sitemap.xml", "sitemap.xml"],
    ["/terms", "terms.html"],
  ]);

  for (const url of urls) {
    const route = routePathFromUrl(url);
    const response = await fetch(url, { redirect: "manual" });
    if (response.status !== 200) {
      fail(`${url}: live route returned HTTP ${response.status}`);
      continue;
    }
    if (response.status >= 300 && response.status < 400) {
      fail(`${url}: live route redirected; canonical public routes should answer directly`);
    }

    const expectedType = expectedContentType(route, resolveRoute(route));
    const actualType = response.headers.get("content-type") || "";
    if (expectedType && !actualType.startsWith(expectedType)) {
      fail(`${url}: live Content-Type expected ${expectedType}, got ${actualType || "<missing>"}`);
    }

    // The .md twin must declare its clean canonical; the clean URL carries no
    // Link header, or at most a self-referential one.
    const expectedLink = linkHeaderFor(route);
    const actualLink = response.headers.get("link");
    if (expectedLink && actualLink !== expectedLink) {
      fail(`${url}: live Link header expected ${expectedLink}, got ${actualLink || "<missing>"}`);
    } else if (!expectedLink && actualLink && actualLink !== `<${url}>; rel="canonical"`) {
      fail(`${url}: unexpected live Link header ${actualLink}`);
    }

    let body = null;
    if (bodyMustMatchRepository.has(route) || url === jsonLdUrl || url === `${canonicalOrigin}/contexts/v1`) {
      body = await response.text();
    }

    const repositoryPath = bodyMustMatchRepository.get(route);
    if (repositoryPath) {
      const expectedBody = readText(repositoryPath).replace(/\r\n/g, "\n");
      const actualBody = body.replace(/\r\n/g, "\n");
      if (actualBody !== expectedBody) fail(`${url}: live body does not match repository file ${repositoryPath}`);
    }

    if (url === jsonLdUrl) jsonLdBody = body;
    if (url === `${canonicalOrigin}/contexts/v1`) {
      const contextBody = body;
      if (jsonLdBody !== null && contextBody !== jsonLdBody) {
        fail(`${url}: /contexts/v1 and /contexts/v1.jsonld returned different bodies`);
      }
    }
  }
}

checkMarkdownLinks();
checkPublicRoutes();
if (live) await checkLiveRoutes();

if (failures.length > 0) {
  console.error("VRP public route/link check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`VRP public route/link check passed${live ? " with live route verification" : ""}.`);
