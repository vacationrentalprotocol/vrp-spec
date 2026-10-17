// Offer-rules conformance vectors (spec/v0.1.md §5, §6, §7; ADR 0012).
//
// The rules a verifier applies to the signed payload's `request`,
// `generated_at` and `valid_until`, beyond the signature:
//   - the dates exist in the calendar, check_out is later than check_in, and
//     check_in is not earlier than the day before the verifier's UTC date;
//   - request.language, when present, is a language tag of the form §5 gives;
//   - valid_until is later than generated_at and at most 900 seconds after it,
//     generated_at is at most 60 seconds ahead of the verifier's clock, and
//     valid_until has not passed;
//   - request.check_in, check_out and guests are the stay the agent asked for.
//
// Each vector gives the payload members these rules read, the instant `now`
// and the stay asked for, and the reasons the offer is not quotable (none when
// it meets them). The signature is not part of these vectors; the offer and
// host-domain vectors cover it.
//
// Run directly or via `npm test`:  node scripts/verify-offer-rules.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const MAX_LIFETIME_SECONDS = 900;
export const CLOCK_SKEW_SECONDS = 60;
// §5: language subtag (2–3 letters), optional script (4 letters), optional
// region (2 letters or 3 digits). Free text never matches.
export const LANGUAGE_TAG = /^[A-Za-z]{2,3}(-[A-Za-z]{4})?(-([A-Za-z]{2}|[0-9]{3}))?$/;

const DAY_MS = 86400000;

/** A YYYY-MM-DD date that exists in the calendar, as ms at UTC midnight; NaN otherwise. */
export function parseDate(value) {
  const m = typeof value === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return NaN;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? t : NaN;
}

/** A UTC date-time in the schema's form (ending in Z) that exists, as ms; NaN otherwise. */
export function parseDateTime(value) {
  const m =
    typeof value === "string" && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?Z$/.exec(value);
  if (!m) return NaN;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  const d = new Date(t);
  const exists =
    d.getUTCFullYear() === +m[1] &&
    d.getUTCMonth() === +m[2] - 1 &&
    d.getUTCDate() === +m[3] &&
    d.getUTCHours() === +m[4] &&
    d.getUTCMinutes() === +m[5] &&
    d.getUTCSeconds() === +m[6];
  return exists ? t + (m[7] ? Number(m[7]) * 1000 : 0) : NaN;
}

/**
 * The reasons an offer is not quotable under these rules; an empty list when it
 * meets them. `now` is an instant (ms or a date-time string); `asked` is the
 * stay the agent asked for, { check_in, check_out, guests }, or null when the
 * verifier does not know it.
 */
export function checkOfferRules(payload, { now, asked }) {
  const reasons = [];
  const clock = typeof now === "number" ? now : Date.parse(now);

  const generated = parseDateTime(payload?.generated_at);
  const validUntil = parseDateTime(payload?.valid_until);
  if (Number.isNaN(generated)) reasons.push("malformed_generated_at");
  if (Number.isNaN(validUntil)) reasons.push("malformed_valid_until");
  if (!Number.isNaN(generated) && !Number.isNaN(validUntil)) {
    if (validUntil <= generated) reasons.push("lifetime_not_positive");
    else if (validUntil - generated > MAX_LIFETIME_SECONDS * 1000) reasons.push("lifetime_too_long");
  }
  if (!Number.isNaN(generated) && generated > clock + CLOCK_SKEW_SECONDS * 1000) {
    reasons.push("generated_at_in_future");
  }
  if (!Number.isNaN(validUntil) && validUntil <= clock) reasons.push("expired");

  const request = payload?.request;
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    reasons.push("request_missing");
    return reasons;
  }
  const checkIn = parseDate(request.check_in);
  const checkOut = parseDate(request.check_out);
  if (Number.isNaN(checkIn)) reasons.push("invalid_check_in");
  if (Number.isNaN(checkOut)) reasons.push("invalid_check_out");
  if (!Number.isNaN(checkIn) && !Number.isNaN(checkOut) && checkOut <= checkIn) {
    reasons.push("check_out_not_after_check_in");
  }
  // The local date anywhere is at most one day behind the UTC date.
  const dayBefore = Math.floor(clock / DAY_MS) * DAY_MS - DAY_MS;
  if (!Number.isNaN(checkIn) && checkIn < dayBefore) reasons.push("check_in_in_past");
  if ("language" in request && !(typeof request.language === "string" && LANGUAGE_TAG.test(request.language))) {
    reasons.push("invalid_language");
  }

  if (!asked) reasons.push("asked_stay_unknown");
  else if (
    request.check_in !== asked.check_in ||
    request.check_out !== asked.check_out ||
    request.guests !== asked.guests
  ) {
    reasons.push("request_mismatch");
  }
  return reasons;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const doc = JSON.parse(
    readFileSync(join(repoRoot, "examples/conformance/offer-rules/vectors.v0.1.json"), "utf8"),
  );
  const failures = [];
  const check = (name, ok, detail) => {
    if (ok) console.log(`  ok   ${name}`);
    else failures.push(detail ? `${name} (${detail})` : name);
  };

  check("vectors state the same lifetime cap as the checker", doc.max_lifetime_seconds === MAX_LIFETIME_SECONDS);
  check("vectors state the same clock allowance as the checker", doc.clock_skew_seconds === CLOCK_SKEW_SECONDS);
  check("vectors state the same language-tag pattern as the checker", doc.language_tag_pattern === LANGUAGE_TAG.source);
  check("vector set is non-empty", Array.isArray(doc.vectors) && doc.vectors.length > 0);
  const names = new Set();
  for (const v of doc.vectors) {
    check(`${v.name}: name is unique`, !names.has(v.name));
    names.add(v.name);
    const reasons = checkOfferRules(v.offer, { now: doc.now, asked: v.asked });
    check(
      `${v.name}`,
      JSON.stringify(reasons) === JSON.stringify(v.expected.reasons),
      `got ${JSON.stringify(reasons)}`,
    );
  }
  if (failures.length > 0) {
    console.error("\nOffer-rules vector verification failed:");
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }
  console.log(`\nOffer-rules vectors OK (${doc.vectors.length} vectors, spec/v0.1.md §5, §6, §7).`);
}
