#!/usr/bin/env node
// Review-period gate (GOVERNANCE.md §4).
//
// GOVERNANCE.md §4 says a substantive change needs "a review period of at
// least seven days" and, once two maintainers are active, "approval from two
// maintainers". Nothing enforced it: on 2026-11-27 pull request 214, which put
// a SHOULD in Core §4, was merged 2 hours 44 minutes after it was opened, with
// no review. This check keeps such a pull request red until both conditions
// hold, so the merge button stays closed.
//
// What counts as substantive here is decided by the files, never by what the
// pull request says about itself: a pull request that changes a file under
// spec/, schemas/, contexts/ or docs/adr/, or GOVERNANCE.md. (§4 requires an
// ADR for every substantive change, so docs/adr/ catches the rest.) A typo fix
// in one of those files waits too; they change a few times a month.
//
// The rule:
//   - the pull request is at least seven days old (from the time it was
//     opened, drafts included), and
//   - two maintainers listed in MAINTAINERS.md approve it, and
//   - no maintainer's latest review asks for changes ("no maintainer objects").
//
// GitHub does not let an author approve their own pull request. A maintainer
// who opens the pull request therefore counts as one of the two approvals; the
// other must be an approving review from another maintainer. With one
// maintainer listed, one approval is enough (§4, "a single active maintainer").
//
// The maintainer list is read from the base branch, so a pull request cannot
// add a name and count it.
//
// Usage
//   CI:      node scripts/check-review-period.mjs <base-ref>
//            (pull request from GITHUB_EVENT_PATH, files from git, reviews
//            from the GitHub API with GITHUB_TOKEN)
//   By hand: node scripts/check-review-period.mjs --pr <number>
//            (everything from the GitHub API; GITHUB_REPOSITORY or the
//            default below names the repository)
// Exit 0: may merge as far as this rule goes. Exit 1: not yet. Exit 2: the
// check could not read what it needs; it does not guess.

import { execSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const REVIEW_DAYS = 7;
export const APPROVALS_NEEDED = 2;
export const SUBSTANTIVE = /^(spec\/|schemas\/|contexts\/|docs\/adr\/|GOVERNANCE\.md$)/;

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REPOSITORY = "vacationrentalprotocol/vrp-spec";

// The logins in the MAINTAINERS.md table: rows that start with a link to a
// GitHub account.
export function maintainersFrom(markdown) {
  const logins = [];
  for (const line of markdown.split("\n")) {
    const m = line.match(/^\|\s*\[@([A-Za-z0-9-]+)\]\(https:\/\/github\.com\/[^)]+\)/);
    if (m) logins.push(m[1]);
  }
  return logins;
}

// files:       paths the pull request changes
// createdAt:   when it was opened (ISO 8601)
// now:         the time to judge at (ISO 8601 or Date)
// author:      login of the account that opened it
// reviews:     [{ user, state, submitted_at }] as the GitHub API lists them
// maintainers: logins from MAINTAINERS.md
export function judge({ files, createdAt, now, author, reviews, maintainers }) {
  const touched = files.filter((f) => SUBSTANTIVE.test(f));
  if (touched.length === 0) {
    return { substantive: false, ok: true, touched, reasons: [] };
  }

  const lower = (s) => String(s || "").toLowerCase();
  const listed = new Set(maintainers.map(lower));
  const needed = Math.min(APPROVALS_NEEDED, listed.size);

  // A maintainer's latest approval or request for changes is the one that
  // stands. Comments and dismissed reviews decide nothing.
  const latest = new Map();
  const ordered = [...reviews].sort(
    (a, b) => new Date(a.submitted_at) - new Date(b.submitted_at),
  );
  for (const r of ordered) {
    const who = lower(r.user);
    if (!listed.has(who)) continue;
    if (r.state === "APPROVED" || r.state === "CHANGES_REQUESTED") latest.set(who, r.state);
  }

  const approvers = new Set();
  if (listed.has(lower(author))) approvers.add(lower(author));
  const objectors = [];
  for (const [who, state] of latest) {
    if (state === "APPROVED") approvers.add(who);
    else objectors.push(who);
  }

  const earliest = new Date(new Date(createdAt).getTime() + REVIEW_DAYS * DAY_MS);
  const at = new Date(now);
  const reasons = [];
  if (Number.isNaN(earliest.getTime()) || Number.isNaN(at.getTime())) {
    reasons.push("the time the pull request was opened could not be read");
  } else if (at < earliest) {
    reasons.push(
      `the review period of ${REVIEW_DAYS} days ends ${stamp(earliest)}`,
    );
  }
  if (listed.size === 0) {
    reasons.push("no maintainer could be read from MAINTAINERS.md");
  } else if (approvers.size < needed) {
    reasons.push(
      `${approvers.size} of ${needed} maintainer approvals` +
        (approvers.size ? ` (${[...approvers].join(", ")})` : ""),
    );
  }
  if (objectors.length) {
    reasons.push(`a maintainer asks for changes (${objectors.join(", ")})`);
  }

  return {
    substantive: true,
    ok: reasons.length === 0,
    touched,
    reasons,
    earliest: Number.isNaN(earliest.getTime()) ? null : earliest.toISOString(),
    approvers: [...approvers],
    objectors,
    needed,
  };
}

function stamp(date) {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function report(verdict) {
  if (!verdict.substantive) {
    return "review period: no file under spec/, schemas/, contexts/ or docs/adr/ and not GOVERNANCE.md; GOVERNANCE.md §4 asks for no waiting time.";
  }
  const files = `${verdict.touched.length} file(s), first: ${verdict.touched[0]}`;
  if (verdict.ok) {
    return `review period: substantive change (${files}). ${REVIEW_DAYS} days have passed and ${verdict.approvers.length} maintainers approve (${verdict.approvers.join(", ")}). GOVERNANCE.md §4 is met.`;
  }
  return `review period: substantive change (${files}). Not to be merged yet under GOVERNANCE.md §4: ${verdict.reasons.join("; ")}.`;
}

// ---------------------------------------------------------------- command line

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

async function api(path) {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "vrp-spec-review-period",
  };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const root = process.env.GITHUB_API_URL || "https://api.github.com";
  const res = await fetch(`${root}${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`);
  return res.json();
}

async function apiPages(path) {
  const all = [];
  for (let page = 1; page <= 30; page += 1) {
    const sep = path.includes("?") ? "&" : "?";
    const rows = await api(`${path}${sep}per_page=100&page=${page}`);
    all.push(...rows);
    if (rows.length < 100) break;
  }
  return all;
}

async function main() {
  const args = process.argv.slice(2);
  const repository = process.env.GITHUB_REPOSITORY || DEFAULT_REPOSITORY;
  let pull;
  let files;
  let maintainersText;

  if (args[0] === "--pr") {
    const number = Number(args[1]);
    if (!Number.isInteger(number) || number < 1) {
      console.error("usage: check-review-period.mjs --pr <number>");
      process.exit(2);
    }
    const pr = await api(`/repos/${repository}/pulls/${number}`);
    pull = { number, createdAt: pr.created_at, author: pr.user.login };
    const rows = await apiPages(`/repos/${repository}/pulls/${number}/files`);
    files = rows.flatMap((f) => [f.filename, f.previous_filename].filter(Boolean));
    maintainersText = readFileSync(new URL("../MAINTAINERS.md", import.meta.url), "utf8");
  } else {
    const base = args[0] || "origin/main";
    if (!process.env.GITHUB_EVENT_PATH) {
      console.log("review period: not a pull request run; nothing to check.");
      return;
    }
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    if (!event.pull_request) {
      console.log("review period: not a pull request run; nothing to check.");
      return;
    }
    pull = {
      number: event.pull_request.number,
      createdAt: event.pull_request.created_at,
      author: event.pull_request.user.login,
    };
    const mergeBase = sh(`git merge-base ${base} HEAD`);
    files = sh(`git diff --no-renames --name-only ${mergeBase}..HEAD`).split("\n").filter(Boolean);
    try {
      maintainersText = sh(`git show ${base}:MAINTAINERS.md`);
    } catch {
      maintainersText = readFileSync(new URL("../MAINTAINERS.md", import.meta.url), "utf8");
    }
  }

  // Reviews are read only when the answer depends on them.
  let reviews = [];
  if (files.some((f) => SUBSTANTIVE.test(f))) {
    const rows = await apiPages(`/repos/${repository}/pulls/${pull.number}/reviews`);
    reviews = rows.map((r) => ({
      user: r.user && r.user.login,
      state: r.state,
      submitted_at: r.submitted_at,
    }));
  }

  const verdict = judge({
    files,
    createdAt: pull.createdAt,
    now: new Date(),
    author: pull.author,
    reviews,
    maintainers: maintainersFrom(maintainersText),
  });
  const text = report(verdict);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  }
  if (verdict.ok) {
    console.log(text);
    return;
  }
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::error title=Review period (GOVERNANCE.md §4)::${text}`);
  } else {
    console.error(text);
  }
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((err) => {
    console.error(`review period: could not decide (${err.message}).`);
    process.exit(2);
  });
}
