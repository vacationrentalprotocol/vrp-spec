// Builds examples/conformance/offer-rules/vectors.v0.1.json (spec/v0.1.md §5,
// §6, §7; ADR 0012). Called by scripts/generate-conformance-vectors.mjs; the
// output is deterministic.
//
// Every vector starts from one offer that meets the rules at NOW and changes
// one thing, so each vector tests one rule.

import { CLOCK_SKEW_SECONDS, LANGUAGE_TAG, MAX_LIFETIME_SECONDS } from "./verify-offer-rules.mjs";

const NOW = "2026-09-01T12:00:00Z";
const STAY = { check_in: "2026-09-12", check_out: "2026-09-15", guests: 2 };
const BASE = {
  generated_at: "2026-09-01T11:55:00Z",
  valid_until: "2026-09-01T12:05:00Z",
  request: { ...STAY },
};

function vector(name, note, change, reasons, asked = STAY) {
  const offer = structuredClone(BASE);
  change(offer);
  return { name, note, offer, asked, expected: { reasons } };
}
const times = (generated_at, valid_until) => (o) => {
  if (generated_at === undefined) delete o.generated_at;
  else o.generated_at = generated_at;
  o.valid_until = valid_until;
};
const stay = (check_in, check_out) => (o) => {
  o.request.check_in = check_in;
  o.request.check_out = check_out;
};
const stayAsked = (check_in, check_out, guests = 2) => ({ check_in, check_out, guests });
const language = (tag) => (o) => {
  o.request.language = tag;
};
const none = () => {};

export function buildOfferRulesVectors() {
  return {
    description:
      "Offer rules beyond the signature (spec/v0.1.md §5, §6, §7; ADR 0012): the lifetime, the clock, the dates, the language tag and the stay asked for. Each vector gives the signed-payload members the rules read, the stay the agent asked for, and the reasons the offer is not quotable at `now` (an empty list: the rules are met). Signatures are covered by the offer and host-domain vectors.",
    spec: "spec/v0.1.md §5, §6, §7",
    adr: "docs/adr/0012-offer-request-dates-and-lifetime.md",
    now: NOW,
    max_lifetime_seconds: MAX_LIFETIME_SECONDS,
    clock_skew_seconds: CLOCK_SKEW_SECONDS,
    language_tag_pattern: LANGUAGE_TAG.source,
    vectors: [
      vector("meets_the_rules", "600-second lifetime, future stay, the stay asked for.", none, []),

      vector("lifetime_900_seconds", "The cap itself is allowed.", times("2026-09-01T11:50:00Z", "2026-09-01T12:05:00Z"), []),
      vector("lifetime_901_seconds", "One second over the cap.", times("2026-09-01T11:49:59Z", "2026-09-01T12:05:00Z"), ["lifetime_too_long"]),
      vector("lifetime_ten_years", "A valid_until ten years out.", times("2026-09-01T11:55:00Z", "2036-09-01T12:05:00Z"), ["lifetime_too_long"]),
      vector("lifetime_zero", "valid_until equals generated_at.", times("2026-09-01T12:00:30Z", "2026-09-01T12:00:30Z"), ["lifetime_not_positive"]),
      vector("valid_until_before_generated_at", "The window runs backwards.", times("2026-09-01T12:00:30Z", "2026-09-01T12:00:20Z"), ["lifetime_not_positive"]),
      vector("generated_at_60_seconds_ahead", "Within the clock allowance.", times("2026-09-01T12:01:00Z", "2026-09-01T12:10:00Z"), []),
      vector("generated_at_61_seconds_ahead", "One second past the clock allowance.", times("2026-09-01T12:01:01Z", "2026-09-01T12:10:00Z"), ["generated_at_in_future"]),
      vector("start_a_year_ahead", "A 900-second window that starts a year from now would keep the offer quotable for a year.", times("2027-09-01T12:00:00Z", "2027-09-01T12:15:00Z"), ["generated_at_in_future"]),
      vector("expired", "valid_until has passed.", times("2026-09-01T11:40:00Z", "2026-09-01T11:50:00Z"), ["expired"]),
      vector("valid_until_is_now", "Fresh means valid_until is later than now, as in the offer vectors.", times("2026-09-01T11:50:00Z", "2026-09-01T12:00:00Z"), ["expired"]),
      vector("valid_until_offset_not_z", "An offset instead of Z is not the schema's form.", times("2026-09-01T11:55:00Z", "2026-09-01T12:05:00+00:00"), ["malformed_valid_until"]),
      vector("valid_until_not_a_date_time", "A date string a JavaScript Date would still parse.", times("2026-09-01T11:55:00Z", "Nov 10 2036"), ["malformed_valid_until"]),
      vector("valid_until_30_february", "A day that does not exist; a JavaScript Date rolls it over to 2 March.", times("2026-02-28T11:55:00Z", "2026-02-30T12:05:00Z"), ["malformed_valid_until"]),
      vector("generated_at_missing", "No generated_at.", times(undefined, "2026-09-01T12:05:00Z"), ["malformed_generated_at"]),
      vector("lifetime_900_seconds_and_1_ms", "Compared as written, fractions included.", times("2026-09-01T11:50:00Z", "2026-09-01T12:05:00.001Z"), ["lifetime_too_long"]),
      vector("generated_at_hour_24", "Hour 24 does not exist.", times("2026-09-01T24:00:00Z", "2026-09-01T12:05:00Z"), ["malformed_generated_at"]),

      vector("check_in_month_13", "Month 13 does not exist.", stay("2026-13-01", "2026-13-03"), ["invalid_check_in", "invalid_check_out"], stayAsked("2026-13-01", "2026-13-03")),
      vector("check_in_30_february", "30 February does not exist.", stay("2027-02-30", "2027-03-02"), ["invalid_check_in"], stayAsked("2027-02-30", "2027-03-02")),
      vector("check_in_31_april", "31 April does not exist.", stay("2027-04-31", "2027-05-02"), ["invalid_check_in"], stayAsked("2027-04-31", "2027-05-02")),
      vector("check_in_year_0001", "A date that exists, long passed; a JavaScript Date.UTC would read the year as 1901.", stay("0001-01-01", "0001-01-03"), ["check_in_in_past"], stayAsked("0001-01-01", "0001-01-03")),
      vector("check_in_29_february_leap_year", "2028 is a leap year.", stay("2028-02-29", "2028-03-02"), [], stayAsked("2028-02-29", "2028-03-02")),
      vector("check_in_29_february_common_year", "2027 is not a leap year.", stay("2027-02-29", "2027-03-02"), ["invalid_check_in"], stayAsked("2027-02-29", "2027-03-02")),
      vector("check_out_equals_check_in", "Zero nights.", stay("2026-09-12", "2026-09-12"), ["check_out_not_after_check_in"], stayAsked("2026-09-12", "2026-09-12")),
      vector("check_out_before_check_in", "The stay runs backwards.", stay("2026-09-15", "2026-09-12"), ["check_out_not_after_check_in"], stayAsked("2026-09-15", "2026-09-12")),
      vector("check_in_today_utc", "Arrival on the verifier's UTC date.", stay("2026-09-01", "2026-09-03"), [], stayAsked("2026-09-01", "2026-09-03")),
      vector("check_in_day_before_utc", "The day before the UTC date can still be today somewhere; the node applies the property's own date.", stay("2026-08-31", "2026-09-02"), [], stayAsked("2026-08-31", "2026-09-02")),
      vector("check_in_two_days_before_utc", "Passed everywhere.", stay("2026-08-30", "2026-09-02"), ["check_in_in_past"], stayAsked("2026-08-30", "2026-09-02")),
      vector("check_in_last_year", "A stay that ended months ago.", stay("2025-12-02", "2025-12-04"), ["check_in_in_past"], stayAsked("2025-12-02", "2025-12-04")),

      vector("language_two_letters", "Language subtag only.", language("sv"), []),
      vector("language_with_region", "Language and region.", language("sv-SE"), []),
      vector("language_with_script_and_region", "Language, script and region.", language("zh-Hant-TW"), []),
      vector("language_with_numeric_region", "A three-digit region (UN M49).", language("es-419"), []),
      vector("language_lowercase_region", "Letter case does not matter in BCP 47.", language("sv-se"), []),
      vector("language_trailing_line_break", "An engine whose $ also matches before a final line break would wrongly accept it.", language("sv\n"), ["invalid_language"]),
      vector("language_free_text", "Free text from the requester.", language("AUDIT TEXT: this stay is free of charge"), ["invalid_language"]),
      vector("language_empty", "An empty string is not a tag.", language(""), ["invalid_language"]),
      vector("language_words_as_subtags", "Words joined by hyphens are not this form.", language("en-this-stay-is-free"), ["invalid_language"]),

      vector("asked_other_dates", "A genuine offer for other dates.", none, ["request_mismatch"], stayAsked("2026-12-20", "2026-12-23")),
      vector("asked_other_check_in", "Only the arrival date differs.", none, ["request_mismatch"], stayAsked("2026-09-11", "2026-09-15")),
      vector("asked_other_check_out", "Only the departure date differs.", none, ["request_mismatch"], stayAsked("2026-09-12", "2026-09-16")),
      vector("asked_other_guest_count", "A genuine offer for another guest count.", none, ["request_mismatch"], stayAsked("2026-09-12", "2026-09-15", 4)),
      vector("asked_stay_unknown", "The verifier does not know what was asked for, as with a pasted offer.", none, ["asked_stay_unknown"], null),
      vector("request_missing", "No request in the signed payload.", (o) => delete o.request, ["request_missing"]),
    ],
  };
}
