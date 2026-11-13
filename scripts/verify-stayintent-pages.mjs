#!/usr/bin/env node
// StayIntent pages and endpoint vector (spec/stayintent-discovery-v0.1.md
// §3.1, §4.4, §10; ADR 0019). Offline and deterministic.
//
//   chains    — a chain is a first page and the pages reached by its cursors.
//               Across a chain the nodes are in ascending order of
//               canonical_domain, each at most once; no empty page carries a
//               cursor; the chain ends; match describes the chain; match_count,
//               where given, is the number of nodes in the chain; and every page
//               is priceless and rank-free (§4.1–§4.3). Each negative chain
//               breaks one rule and carries the name of its case.
//   endpoints — values of `endpoints.stayintent` a client accepts (a set of one
//               to ten absolute https URLs without userinfo, on any domain) and
//               rejects (§10).
//
// Run directly or via `npm test`:  node scripts/verify-stayintent-pages.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The same signals scripts/verify-stayintent.mjs scans for (§4.1, §4.2, §4.3).
const MONEY_KEY = /price|total|amount|cost|fee|currency/i;
const RANK_KEY = /score|rank|confidence|rating/i;
export const CURSOR_MAX = 1024;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function scanSignals(obj, path = "") {
  if (obj == null || typeof obj !== "object") return null;
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k;
    if (RANK_KEY.test(k)) return `ranking_signal at ${p}`;
    if (MONEY_KEY.test(k) && (typeof v === "number" || (typeof v === "string" && /\d/.test(v)))) {
      return `monetary_value at ${p}`;
    }
    if (typeof v === "object") {
      const r = scanSignals(v, p);
      if (r) return r;
    }
  }
  return null;
}

const cursorOk = (c) => typeof c === "string" && c.length >= 1 && c.length <= CURSOR_MAX;

/** One page of a response (§4): shape, signals, trust_summary, cursor and count. Returns a reason or null. */
export function checkPage(page) {
  if (!isObject(page) || page.protocol !== "vrp-stayintent" || page.protocol_version !== "0.1") return "not_response";
  if (page.match !== "yes" && page.match !== "no") return "not_response";
  if (!Array.isArray(page.nodes)) return "not_response";
  const signal = scanSignals(page);
  if (signal) return signal.split(" ")[0];
  for (const node of page.nodes) {
    if (!isObject(node) || typeof node.canonical_domain !== "string") return "not_response";
    const ts = node.trust_summary;
    if (ts !== undefined) {
      if (!isObject(ts)) return "trust_summary_not_fact";
      if (Object.values(ts).some((v) => !(typeof v === "boolean" || Array.isArray(v)))) return "trust_summary_not_fact";
    }
  }
  if ("next_cursor" in page && !cursorOk(page.next_cursor)) return "cursor_invalid";
  if ("match_count" in page && !(Number.isInteger(page.match_count) && page.match_count >= 0)) return "match_count_invalid";
  return null;
}

/** §4.4: a chain of pages as a client reads it, first page first. Returns a reason or null. */
export function checkChain(pages) {
  if (!Array.isArray(pages) || pages.length === 0) return "not_chain";
  for (const page of pages) {
    const r = checkPage(page);
    if (r) return r;
  }
  const last = pages.length - 1;
  for (let i = 0; i < last; i++) {
    if (!("next_cursor" in pages[i])) return "cursor_missing";
    if (pages[i].nodes.length === 0) return "empty_page_with_cursor";
  }
  if ("next_cursor" in pages[last]) return "chain_open";
  const domains = pages.flatMap((p) => p.nodes.map((n) => n.canonical_domain));
  for (let i = 1; i < domains.length; i++) {
    if (domains[i] === domains[i - 1]) return "duplicate_node";
    if (!(domains[i - 1] < domains[i])) return "not_ascending";
  }
  const expectedMatch = domains.length > 0 ? "yes" : "no";
  if (pages.some((p) => p.match !== expectedMatch)) return "match_flag_wrong";
  if (pages.some((p) => "match_count" in p && p.match_count !== domains.length)) return "match_count_mismatch";
  return null;
}

export const ENDPOINTS_MAX = 10;

/** §10: one entry of `endpoints.stayintent`. Returns a reason or null. */
export function checkStayintentEndpointEntry(value) {
  if (typeof value !== "string") return "not_string";
  let url;
  try {
    url = new URL(value);
  } catch {
    return "url_invalid";
  }
  if (url.protocol !== "https:") return "url_not_https";
  if (url.username !== "" || url.password !== "") return "url_userinfo";
  return null;
}

/** §10: the whole `endpoints.stayintent` member, a set of one to ten entries. Returns a reason or null. */
export function checkStayintentEndpoints(value) {
  if (!Array.isArray(value)) return "not_array";
  if (value.length === 0) return "empty";
  if (value.length > ENDPOINTS_MAX) return "too_many_entries";
  for (const entry of value) {
    const r = checkStayintentEndpointEntry(entry);
    if (r) return r;
  }
  if (new Set(value).size !== value.length) return "duplicate_entry";
  return null;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const doc = JSON.parse(readFileSync(join(repoRoot, "examples/conformance/stayintent/pages.v0.1.json"), "utf8"));
  const failures = [];
  const check = (name, ok, detail) => {
    if (ok) console.log(`  ok   ${name}`);
    else failures.push(detail ? `${name} (${detail})` : name);
  };
  for (const c of doc.chains) {
    const got = checkChain(c.pages);
    check(`chain ${c.name}`, got === c.expected.reason, `got ${got}`);
  }
  for (const e of doc.endpoints) {
    const got = checkStayintentEndpoints(e.value);
    check(`endpoints ${e.name}`, got === e.expected.reason, `got ${got}`);
  }
  const total = doc.chains.length + doc.endpoints.length;
  if (failures.length > 0) {
    console.error("\nStayIntent pages vector verification failed:");
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }
  console.log(`\nStayIntent pages vectors OK (${total} vectors, spec/stayintent-discovery-v0.1.md §3.1, §4.4, §10).`);
}
