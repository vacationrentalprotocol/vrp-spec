// Cases for the review-period gate (scripts/check-review-period.mjs,
// GOVERNANCE.md §4). Offline: no network, no git. Part of `npm test`.

import { readFileSync } from "node:fs";
import { judge, maintainersFrom, report } from "./check-review-period.mjs";

const M = ["HemmaBo-se", "hayatabbasjr", "viljemd-hub"];
const OPENED = "2026-11-27T01:39:12Z";
const after = (days, hours = 0) =>
  new Date(new Date(OPENED).getTime() + (days * 24 + hours) * 3600 * 1000).toISOString();
const review = (user, state, at) => ({ user, state, submitted_at: at });

const SPEC = ["spec/v0.1.md", "docs/adr/0020-readable-from-a-browser.md", "implement.html"];

const cases = [
  {
    name: "a film page and a guide: no waiting time",
    input: { files: ["film.html", "docs/implement-vrp.md", "sitemap.xml"], createdAt: OPENED, now: after(0, 1), author: "HemmaBo-se", reviews: [] },
    expect: { substantive: false, ok: true },
  },
  {
    name: "pull request 214 as it was merged: 2 h 44 min old, no review",
    input: { files: SPEC, createdAt: OPENED, now: "2026-11-27T04:22:36Z", author: "HemmaBo-se", reviews: [] },
    expect: { substantive: true, ok: false, reasons: 2 },
  },
  {
    name: "seven days passed, only the author approves",
    input: { files: SPEC, createdAt: OPENED, now: after(8), author: "HemmaBo-se", reviews: [] },
    expect: { substantive: true, ok: false, reasons: 1 },
  },
  {
    name: "seven days passed, the author and a second maintainer approve",
    input: { files: SPEC, createdAt: OPENED, now: after(8), author: "HemmaBo-se", reviews: [review("viljemd-hub", "APPROVED", after(3))] },
    expect: { substantive: true, ok: true },
  },
  {
    name: "two approvals, one hour short of seven days",
    input: { files: SPEC, createdAt: OPENED, now: after(6, 23), author: "HemmaBo-se", reviews: [review("viljemd-hub", "APPROVED", after(1))] },
    expect: { substantive: true, ok: false, reasons: 1 },
  },
  {
    name: "exactly seven days, two approvals",
    input: { files: SPEC, createdAt: OPENED, now: after(7), author: "HemmaBo-se", reviews: [review("viljemd-hub", "APPROVED", after(1))] },
    expect: { substantive: true, ok: true },
  },
  {
    name: "an approval from someone who is not a maintainer does not count",
    input: { files: SPEC, createdAt: OPENED, now: after(8), author: "HemmaBo-se", reviews: [review("someone-else", "APPROVED", after(2))] },
    expect: { substantive: true, ok: false, reasons: 1 },
  },
  {
    name: "a maintainer approved and then asked for changes",
    input: { files: SPEC, createdAt: OPENED, now: after(8), author: "HemmaBo-se", reviews: [review("viljemd-hub", "APPROVED", after(2)), review("viljemd-hub", "CHANGES_REQUESTED", after(4))] },
    expect: { substantive: true, ok: false, reasons: 2 },
  },
  {
    name: "a maintainer asked for changes and then approved",
    input: { files: SPEC, createdAt: OPENED, now: after(8), author: "HemmaBo-se", reviews: [review("viljemd-hub", "CHANGES_REQUESTED", after(2)), review("viljemd-hub", "APPROVED", after(4))] },
    expect: { substantive: true, ok: true },
  },
  {
    name: "two approve, a third maintainer objects: no consensus",
    input: { files: SPEC, createdAt: OPENED, now: after(8), author: "HemmaBo-se", reviews: [review("viljemd-hub", "APPROVED", after(2)), review("hayatabbasjr", "CHANGES_REQUESTED", after(3))] },
    expect: { substantive: true, ok: false, reasons: 1 },
  },
  {
    name: "a comment after an approval leaves the approval standing",
    input: { files: SPEC, createdAt: OPENED, now: after(8), author: "HemmaBo-se", reviews: [review("viljemd-hub", "APPROVED", after(2)), review("viljemd-hub", "COMMENTED", after(3))] },
    expect: { substantive: true, ok: true },
  },
  {
    name: "a dismissed review decides nothing",
    input: { files: SPEC, createdAt: OPENED, now: after(8), author: "HemmaBo-se", reviews: [review("viljemd-hub", "DISMISSED", after(2))] },
    expect: { substantive: true, ok: false, reasons: 1 },
  },
  {
    name: "an outside author needs two maintainer reviews: one is not enough",
    input: { files: ["schemas/verified-stay-offer-v0.1.schema.json"], createdAt: OPENED, now: after(8), author: "contributor", reviews: [review("HemmaBo-se", "APPROVED", after(2))] },
    expect: { substantive: true, ok: false, reasons: 1 },
  },
  {
    name: "an outside author with two maintainer approvals",
    input: { files: ["schemas/verified-stay-offer-v0.1.schema.json"], createdAt: OPENED, now: after(8), author: "contributor", reviews: [review("HemmaBo-se", "APPROVED", after(2)), review("Viljemd-Hub", "APPROVED", after(5))] },
    expect: { substantive: true, ok: true },
  },
  {
    name: "GOVERNANCE.md alone is substantive",
    input: { files: ["GOVERNANCE.md"], createdAt: OPENED, now: after(1), author: "HemmaBo-se", reviews: [] },
    expect: { substantive: true, ok: false, reasons: 2 },
  },
  {
    name: "a decision record alone is substantive",
    input: { files: ["docs/adr/0021-something.md"], createdAt: OPENED, now: after(1), author: "viljemd-hub", reviews: [] },
    expect: { substantive: true, ok: false, reasons: 2 },
  },
  {
    name: "contexts/ is substantive; a file that only looks alike is not",
    input: { files: ["docs/adr-notes.md", "specimen/x.md", "docs/GOVERNANCE.md"], createdAt: OPENED, now: after(0, 1), author: "contributor", reviews: [] },
    expect: { substantive: false, ok: true },
  },
  {
    name: "with one maintainer listed, that maintainer approves",
    maintainers: ["HemmaBo-se"],
    input: { files: SPEC, createdAt: OPENED, now: after(8), author: "HemmaBo-se", reviews: [] },
    expect: { substantive: true, ok: true },
  },
  {
    name: "no maintainer readable: closed",
    maintainers: [],
    input: { files: SPEC, createdAt: OPENED, now: after(8), author: "HemmaBo-se", reviews: [] },
    expect: { substantive: true, ok: false, reasons: 1 },
  },
];

let failed = 0;
for (const c of cases) {
  const verdict = judge({ ...c.input, maintainers: c.maintainers || M });
  const problems = [];
  if (verdict.substantive !== c.expect.substantive) problems.push(`substantive=${verdict.substantive}`);
  if (verdict.ok !== c.expect.ok) problems.push(`ok=${verdict.ok}`);
  if (c.expect.reasons !== undefined && verdict.reasons.length !== c.expect.reasons) {
    problems.push(`reasons=${JSON.stringify(verdict.reasons)}`);
  }
  if (typeof report(verdict) !== "string" || report(verdict).length < 20) problems.push("no report text");
  if (problems.length) {
    failed += 1;
    console.error(`FAIL ${c.name}: ${problems.join(", ")}`);
  }
}

// The list the gate reads is the table in MAINTAINERS.md as it stands.
const listed = maintainersFrom(
  readFileSync(new URL("../MAINTAINERS.md", import.meta.url), "utf8"),
);
if (listed.length < 1 || !listed.every((l) => /^[A-Za-z0-9-]+$/.test(l))) {
  failed += 1;
  console.error(`FAIL MAINTAINERS.md: no maintainer login could be read (${JSON.stringify(listed)})`);
}

if (failed) {
  console.error(`verify-review-period: ${failed} failed`);
  process.exit(1);
}
console.log(
  `verify-review-period: ${cases.length} cases pass; MAINTAINERS.md lists ${listed.length} maintainers (${listed.join(", ")}).`,
);
