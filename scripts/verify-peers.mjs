#!/usr/bin/env node
// Peers conformance vectors (spec/peers-v0.1.md, experimental; ADR 0018).
//
// Two files, both offline and deterministic:
//   negative.v0.1.json — `peers` members a client must ignore in full (§4 item
//                        1) and entries it must skip (§4 item 2), each with the
//                        name of its case; plus valid controls.
//   positive.v0.1.json — a small network of discovery documents and walks over
//                        it (§5, §6): the set of nodes reached, whether the walk
//                        is complete, and the domains not reached and why. Every
//                        walk runs twice, with each node's entries in the listed
//                        order and reversed: the set reached must not depend on
//                        the order (§6).
//
// The vectors carry the list entries they depend on, as the host-domain vectors
// do; a real client uses the full ICANN section of the Public Suffix List and
// ICANN's gTLD list (Core §2).
//
// Run directly or via `npm test`:  node scripts/verify-peers.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkHostOwned, checkNodeUrl } from "./verify-host-domain.mjs";

export const PEERS_SPEC = "https://vacationrentalprotocol.com/spec/peers-v0.1";
export const MAX_ENTRIES = 100;
const MEMBERS = new Set(["spec", "nodes", "updated_at"]);
// §3.1 item 1: Core §2 item 1's spelling, at least two labels. JavaScript's $
// (no m flag) matches only at the end of the input, so "example.net\n" fails.
const ENTRY = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
const UTC = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?Z$/;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * §4: read a `peers` member as the node `ownDomain` published it.
 * Returns { ignored: <case name> } when the whole member must be ignored, else
 * { ignored: null, entries, skipped } with the entries a client may follow and
 * the entries it must skip, each with its reason.
 */
export function readPeers(member, ownDomain, lists) {
  if (!isObject(member)) return { ignored: "not_object" };
  if (member.spec !== PEERS_SPEC) return { ignored: "unknown_spec" };
  if (Object.keys(member).some((k) => !MEMBERS.has(k))) return { ignored: "unexpected_member" };
  if ("updated_at" in member && !(typeof member.updated_at === "string" && UTC.test(member.updated_at))) {
    return { ignored: "updated_at_invalid" };
  }
  const nodes = member.nodes;
  if (!Array.isArray(nodes)) return { ignored: "nodes_invalid" };
  if (nodes.length > MAX_ENTRIES) return { ignored: "too_many_entries" };
  if (!nodes.every((n) => typeof n === "string" && ENTRY.test(n))) return { ignored: "entry_not_domain" };
  if (new Set(nodes).size !== nodes.length) return { ignored: "duplicate_entry" };
  // §3.2: ascending code-point order. The entries are ASCII, so UTF-16 code
  // unit comparison is code point comparison.
  if (nodes.some((n, i) => i > 0 && !(nodes[i - 1] < n))) return { ignored: "not_sorted" };

  const entries = [];
  const skipped = [];
  for (const domain of nodes) {
    const reason = domain === ownDomain ? "self" : checkHostOwned(domain, lists);
    if (reason) skipped.push({ domain, reason });
    else entries.push(domain);
  }
  return { ignored: null, entries, skipped };
}

/** §5: is `doc`, fetched from https://{domain}/.well-known/vacation-rental.json, a node for this domain under Core §2? */
export function checkReached(domain, doc) {
  if (!isObject(doc)) return "fetch_failed";
  if (doc.protocol !== "vacation-rental-protocol" || doc.protocol_version !== "0.1") return "not_vrp_discovery";
  if (doc.canonical_domain !== domain) return "canonical_domain_mismatch";
  if (checkNodeUrl(doc.jwks_url, domain) || checkNodeUrl(doc.verified_stay_offer_endpoint, domain)) {
    return "not_node_url";
  }
  return null;
}

/**
 * §6: a breadth-first walk from `start`, at most `maxDepth` hops, each domain
 * fetched once. `documents` maps a domain to the discovery document it serves;
 * a domain that is absent or null does not answer. `reverse` processes every
 * node's entries in reverse, to show the result does not depend on the order.
 */
export function walk({ documents, start, maxDepth, lists, reverse = false }) {
  const reached = new Map();
  const notReached = [];
  const seen = new Set([start]);
  let layer = [start];
  let complete = true;
  for (let depth = 0; layer.length > 0; depth++) {
    const next = [];
    for (const domain of layer) {
      const doc = Object.prototype.hasOwnProperty.call(documents, domain) ? documents[domain] : null;
      const reason = checkReached(domain, doc);
      if (reason) {
        notReached.push({ domain, reason });
        continue;
      }
      reached.set(domain, depth);
      if (!("peers" in doc)) continue;
      const read = readPeers(doc.peers, domain, lists);
      if (read.ignored) continue;
      const entries = reverse ? [...read.entries].reverse() : read.entries;
      for (const peer of entries) {
        if (seen.has(peer)) continue;
        // Every domain within maxDepth was scheduled in an earlier layer, so an
        // unseen peer here lies beyond the limit: the walk is partial (§6 item 6).
        if (depth + 1 > maxDepth) {
          complete = false;
          continue;
        }
        seen.add(peer);
        next.push(peer);
      }
    }
    layer = next;
  }
  const byDomain = (a, b) => (a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : 0);
  return { reached: [...reached.keys()].sort(), complete, not_reached: notReached.sort(byDomain) };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const load = (f) => JSON.parse(readFileSync(join(repoRoot, "examples/conformance/peers", f), "utf8"));
  const negative = load("negative.v0.1.json");
  const positive = load("positive.v0.1.json");
  const failures = [];
  const check = (name, ok, detail) => {
    if (ok) console.log(`  ok   ${name}`);
    else failures.push(detail ? `${name} (${detail})` : name);
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const listsOf = (doc) => ({ icannRules: doc.psl_icann_rules, specification13Tlds: doc.icann_specification13_tlds });

  for (const doc of [negative, positive]) {
    check(`${doc.name}: spec identifier`, doc.spec === PEERS_SPEC, `got ${doc.spec}`);
  }

  const nLists = listsOf(negative);
  for (const c of negative.cases) {
    const got = readPeers(c.peers, c.own_domain, nLists);
    check(`negative ${c.name}`, same(got, c.expected), `got ${JSON.stringify(got)}`);
  }

  const pLists = listsOf(positive);
  for (const [domain, doc] of Object.entries(positive.documents)) {
    if (doc && "peers" in doc && doc.canonical_domain === domain) {
      const read = readPeers(doc.peers, domain, pLists);
      check(`positive ${domain}: peers member is read`, read.ignored === null && read.skipped.length === 0, JSON.stringify(read));
    }
  }
  const results = new Map();
  for (const w of positive.walks) {
    const args = { documents: positive.documents, start: w.start, maxDepth: w.max_depth, lists: pLists };
    const got = walk(args);
    const reversed = walk({ ...args, reverse: true });
    results.set(w.name, got);
    check(`walk ${w.name}`, same(got, w.expected), `got ${JSON.stringify(got)}`);
    check(`walk ${w.name}: same result with entries reversed`, same(got, reversed), `got ${JSON.stringify(reversed)}`);
  }
  for (const [a, b] of positive.same_reached_set) {
    check(
      `walks ${a} and ${b} reach the same set from different starts`,
      results.has(a) && results.has(b) && same(results.get(a).reached, results.get(b).reached),
    );
  }

  const total = negative.cases.length + positive.walks.length;
  if (failures.length > 0) {
    console.error("\nPeers vector verification failed:");
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }
  console.log(`\nPeers vectors OK (${total} vectors, spec/peers-v0.1.md §3–§6).`);
}
