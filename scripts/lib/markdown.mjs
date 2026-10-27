// Shared, dependency-free Markdown helpers for the repository's generators
// (scripts/build-source-pack.mjs, scripts/build-pages.mjs).
//
// The repository declares no npm dependencies (see AGENTS.md), so there is no
// Markdown library. This renderer intentionally covers only the constructs the
// specification and docs actually use — headings, paragraphs, ordered and
// unordered lists (with nesting), tables, blockquotes, fenced code, thematic
// breaks (--- and the ===== section rules), and inline code / bold / links /
// autolinks. Anything unrecognized falls through to an escaped paragraph, so
// no text is ever dropped. It is not a general Markdown engine.

import path from "node:path";

export const ORIGIN = "https://vacationrentalprotocol.com";
export const GH = "https://github.com/vacationrentalprotocol/vrp-spec";

export const slug = (p) => p.replace(/\.md$/, "");

// Map a repo-relative path to a public URL: docs/ and spec/ → canonical clean
// URL; anything else → GitHub blob (file) or tree (directory).
export function repoPathToUrl(repoPath) {
  const clean = repoPath.replace(/^\.\//, "");
  if (/^docs\/.+\.md$/.test(clean) || /^spec\/.+\.md$/.test(clean)) {
    return `${ORIGIN}/${slug(clean)}`;
  }
  if (clean.endsWith("/")) return `${GH}/tree/main/${clean.replace(/\/$/, "")}`;
  return `${GH}/blob/main/${clean}`;
}

// Resolve a link target found in `srcFile` to an absolute URL (or return it
// unchanged if already absolute / an in-page anchor).
export function resolveTarget(target, srcFile) {
  const raw = target.trim();
  if (!raw || raw.startsWith("#")) return target;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return target; // http:, https:, mailto:, ...

  const hashIndex = raw.search(/[#?]/);
  const pathPart = hashIndex === -1 ? raw : raw.slice(0, hashIndex);
  const suffix = hashIndex === -1 ? "" : raw.slice(hashIndex);
  if (!pathPart) return target;

  let repoPath;
  if (pathPart.startsWith("/")) {
    repoPath = pathPart.replace(/^\/+/, "");
  } else {
    repoPath = path.posix.normalize(path.posix.join(path.posix.dirname(srcFile), pathPart));
  }
  const url = repoPathToUrl(repoPath);
  // Keep the fragment only for canonical doc/spec pages (same rendered page).
  return url.startsWith(`${ORIGIN}/`) ? url + suffix : url;
}

export const LINK_RE = /(!?\[[^\]]*\])\(([^)\s]+)((?:\s+"[^"]*")?)\)/g;

// Rewrite every relative link in `body` to an absolute URL, skipping fenced
// code blocks. Headings are left as they are.
export function rewriteLinks(body, srcFile) {
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
      return line.replace(LINK_RE, (m, label, tgt, title) => `${label}(${resolveTarget(tgt, srcFile)}${title})`);
    })
    .join("\n");
}

export function escHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function mdInline(s) {
  let t = escHtml(s);
  t = t.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Autolinks <https://...> (angle brackets are now &lt; / &gt; after escaping)
  t = t.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (m, u) => `<a href="${u}">${u}</a>`);
  // [text](url)
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, u) => `<a href="${u}">${txt}</a>`);
  return t;
}

// Plain text of a Markdown inline run: code marks, bold marks and link syntax
// removed, HTML not escaped. Used for <title> and meta description.
export function mdPlain(s) {
  let t = s;
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/<(https?:\/\/[^\s>]+)>/g, "$1");
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1");
  return t.replace(/\s+/g, " ").trim();
}

// GitHub-style heading id: lowercase, punctuation dropped, spaces to hyphens.
export function headingId(text) {
  return mdPlain(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function splitTableRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function listItemMatch(line) {
  const u = line.match(/^(\s*)[-*]\s+(.*)$/);
  if (u) return { indent: u[1].length, tag: "ul", text: u[2] };
  const o = line.match(/^(\s*)\d+\.\s+(.*)$/);
  if (o) return { indent: o[1].length, tag: "ol", text: o[2] };
  return null;
}

function renderList(block) {
  const first = listItemMatch(block[0]);
  const base = first.indent;
  const tag = first.tag;
  const items = [];
  let cur = null;
  for (const l of block) {
    const m = listItemMatch(l);
    if (m && m.indent <= base) {
      if (cur) items.push(cur);
      cur = { text: m.text, children: [] };
    } else if (m && m.indent > base) {
      cur.children.push(l);
    } else if (cur) {
      cur.text += " " + l.trim(); // wrapped continuation line
    }
  }
  if (cur) items.push(cur);
  let html = `<${tag}>`;
  for (const it of items) {
    html += "<li>" + mdInline(it.text);
    if (it.children.length) html += renderList(it.children);
    html += "</li>";
  }
  return html + `</${tag}>`;
}

// Render Markdown to HTML. With `headingIds: true` every heading carries a
// GitHub-style id so in-page fragment links (#section) resolve; ids are made
// unique by a numeric suffix on repeats.
export function mdToHtml(md, { headingIds = false } = {}) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  const seenIds = new Map();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      const ch = fence[1][0];
      const close = new RegExp("^\\s*" + ch + "{3,}\\s*$");
      const code = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) code.push(lines[i++]);
      i++; // consume closing fence
      out.push("<pre><code>" + escHtml(code.join("\n")) + "</code></pre>");
      continue;
    }

    if (!line.trim()) { i++; continue; }

    if (/^\s*(-{3,}|={3,})\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      let idAttr = "";
      if (headingIds) {
        let id = headingId(text) || "section";
        const n = seenIds.get(id) || 0;
        seenIds.set(id, n + 1);
        if (n > 0) id = `${id}-${n}`;
        idAttr = ` id="${id}"`;
      }
      out.push(`<h${level}${idAttr}>${mdInline(text)}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const bq = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) bq.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push("<blockquote>" + mdInline(bq.join(" ")) + "</blockquote>");
      continue;
    }

    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const header = splitTableRow(line);
      i += 2; // header + separator
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(splitTableRow(lines[i++]));
      let t = "<table><thead><tr>" + header.map((c) => `<th>${mdInline(c)}</th>`).join("") + "</tr></thead><tbody>";
      for (const r of rows) t += "<tr>" + r.map((c) => `<td>${mdInline(c)}</td>`).join("") + "</tr>";
      out.push(t + "</tbody></table>");
      continue;
    }

    if (listItemMatch(line)) {
      const block = [];
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) break;
        if (listItemMatch(l) || /^\s+\S/.test(l)) { block.push(l); i++; }
        else break;
      }
      out.push(renderList(block));
      continue;
    }

    const para = [];
    while (
      i < lines.length && lines[i].trim() &&
      !/^\s*(`{3,}|~{3,})/.test(lines[i]) &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*(-{3,}|={3,})\s*$/.test(lines[i]) &&
      !/^\s*\|/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !listItemMatch(lines[i])
    ) {
      para.push(lines[i]); i++;
    }
    out.push("<p>" + mdInline(para.join(" ")) + "</p>");
  }
  return out.join("\n");
}

// First H1 text and the first paragraph after it, as plain text: the page's
// title and description. Falls back to the file name when a document has no H1.
export function summarize(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let title = "";
  let i = 0;
  for (; i < lines.length; i++) {
    const h = lines[i].match(/^#\s+(.*)$/);
    if (h) { title = mdPlain(h[1]); i++; break; }
  }
  // Paragraphs after the H1, fence-aware; the first one that is prose (not a
  // "Label: value" metadata line such as **Status:** or Canonical URL:) is the
  // description. Blank lines separate paragraphs.
  const paragraphs = [];
  let cur = [];
  let inFence = false;
  const flush = () => { if (cur.length) paragraphs.push(cur); cur = []; };
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(`{3,}|~{3,})/.test(l)) { flush(); inFence = !inFence; continue; }
    if (inFence) continue;
    if (!l.trim()) { flush(); continue; }
    if (/^#{1,6}\s/.test(l) || /^\s*(-{3,}|={3,})\s*$/.test(l) || /^\s*\|/.test(l)) { flush(); continue; }
    cur.push(l.replace(/^\s*>\s?/, "").replace(/^\s*[-*]\s+|^\s*\d+\.\s+/, ""));
    if (paragraphs.length >= 8) break;
  }
  flush();
  // Metadata: "**Status:** …", "*Status: …*", "Date: …" (a label of at most
  // three words). Boilerplate: the BCP 14 key-words paragraph.
  const isMetadata = (para) =>
    /^(\*\*[^*]{1,40}(:\*\*|\*\*:)|\*[^*]{1,60}:[^*]*\*\s*$|[A-Z][A-Za-z()&/-]*( [A-Za-z()&/-]+){0,2}:\s)/.test(para[0]);
  const isBoilerplate = (para) => /^The key words /.test(para[0]);
  const chosen = paragraphs.find((para) => !isMetadata(para) && !isBoilerplate(para)) || paragraphs[0] || [];
  let description = mdPlain(chosen.join(" "));
  description = description.replace(/\s+/g, " ").trim();
  if (description.length > 300) {
    const cut = description.slice(0, 300);
    description = cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "") + "…";
  }
  return { title, description };
}
