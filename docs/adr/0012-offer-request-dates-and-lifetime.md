# ADR 0012: The Stay Asked For, Real Dates, Echoed Fields and Offer Lifetime

**Status:** Proposed
**Date:** 2026-10-17 (proposed)

## Context

A signed offer proves that the host domain's key signed exactly these terms
(§5). On top of ADR 0009 (head `3691630` of its pull request), `spec/v0.1.md`
did not say what those terms must be for in five places:

1. **The stay asked for.** §7 listed what makes an offer safe to quote, but
   nothing tied the signed offer to the dates and guest count the agent asked
   for. A genuine, fresh offer for other dates or another guest count met every
   condition. In the normative sections `request` appears only in §5's list of
   required members and in §5.1, which says the booking URL's `checkIn`,
   `checkOut` and `guests` match it; §15 (informative) says offers echo it.
2. **Dates.** Nothing required `request.check_in` and `request.check_out` to be
   dates that exist, `check_out` to be later than `check_in`, or `check_in` not
   to have passed. The schema's date pattern `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`
   accepts `2026-13-01` and `2026-02-30`, and a JavaScript `Date` turns
   `2027-02-30T00:00:00Z` into 2 March 2027 instead of rejecting it.
3. **Echoed fields.** Everything inside the JWS is signed, so whatever a node
   copies from the request becomes a host-signed value. Nothing limited what may
   be copied. The schema typed `request.language` as any string, so free text
   from a requester could be signed by the host's key.
4. **Lifetime.** §3.1 spoke of "the maximum offer lifetime" without defining
   it. No rule limited `valid_until − generated_at`, and none kept
   `generated_at` from lying in the future, so an offer could stay quotable for
   years. The known production node uses 900 seconds (12 of 12 offers fetched
   2026-10-17 between 10:49 and 16:12 UTC); the repository's examples use 600.
5. **Schema.** The schema did not require `request`, so an offer without one was
   schema-valid although §7 now has to compare it. `node_id` and `property` were
   made optional in the schema on 2026-06-02 (`f79bb14`, #15) while §5 lists
   them as required; that is left to its own decision.

ADR numbers 0010 and 0011 are not used. ADR 0007 and 0008 (#147) replace two
records the reference implementation kept under those numbers, which this
repository cited for months; a record of this repository with the same number
would make those citations ambiguous.

## Decision

**D1. The stay asked for (§7).** A new condition: `request.check_in`,
`request.check_out` and `request.guests` are the dates and the guest count the
agent asked for. A verifier that does not know what was asked for (a pasted
offer, for example) cannot meet it.

**D2. Dates (§5, §7).** `check_in` and `check_out` MUST be dates that exist
(RFC 3339 `full-date`), and `check_out` MUST be later than `check_in`. A node
MUST NOT sign an offer for dates that break this, or whose `check_in` is earlier
than the current date at the property; it answers with an error. A verifier
does not know the property's time zone, so §7 asks it for less: `check_in` not
earlier than the day before its current UTC date. The local date anywhere is at
most one day behind the UTC date, so a `check_in` earlier than that has passed
everywhere.

**D3. Echoed fields (§5, §7).** What `request` holds is the requester's words,
not statements by the host. A node MUST NOT copy into the signed payload any
value from the request other than `check_in`, `check_out`, `guests` and
`language`. `request.language`, when present, MUST be a BCP 47 language tag of
the form language subtag (two or three letters), optional script subtag (four
letters), optional region subtag (two letters or three digits), and SHOULD name
a language the node writes the offer in. Agents MUST NOT present a value from
`request` as something the host stated.

**D4. Lifetime (§5, §6, §3.1).** A node MUST set `generated_at` to the time it
signs. `valid_until` MUST be later than `generated_at` and MUST NOT be more than
900 seconds after it. An agent MUST treat an offer as not quotable when
`generated_at` is missing or malformed, more than 60 seconds later than its own
clock, or when the lifetime is not positive or exceeds 900 seconds. 900 seconds
is the known production node's lifetime. The 60 seconds allow for clocks out of
step: at worst an offer stays quotable for 960 seconds by the verifier's clock.
§3.1's "maximum offer lifetime" now names the 900 seconds.

**D5. Schema.** `offerPayload.required` gains `request`. `$defs/date` admits
months 01–12 and days 01–31 only, `$defs/dateTime` hours 00–23 and minutes and
seconds 00–59; that a date exists (no 30 February) stays a runtime rule.
`request.language` gets the D3 pattern. `node_id` and `property` stay optional in
the schema.

**D6. Conformance vectors and the site verifier.**
`examples/conformance/offer-rules/vectors.v0.1.json` (39 cases: lifetime and
clock 15, dates 10, language 7, the stay asked for 6, plus one offer that meets
every rule), built by `scripts/offer-rules-vectors.mjs` and checked by
`scripts/verify-offer-rules.mjs` in `npm test`. `scripts/validate-artifacts.mjs`
gains three negative schema checks (no `request`, a free-text language, month
13). `verify.html` applies D1–D4 to a live offer, with the dates and guest
count typed into the page as the stay asked for.

## Consequences

- **Version class.** D1–D5 change what a verifier accepts, a MAJOR-class change
  under GOVERNANCE.md §5, made within the v0.1 public draft under its "Before
  1.0" paragraph (ADR 0009 D6). What stops being accepted: offers for another
  stay than the one asked for; dates that do not exist, a `check_out` not later
  than `check_in`, a `check_in` that has passed; a `request.language` that is
  not a language tag; a lifetime that is not positive or exceeds 900 seconds; a
  `generated_at` more than 60 seconds ahead; an offer without `request`.
- **Known nodes affected: the known production node.** Measured 2026-10-17, its
  ordinary offers (a future stay, without a language and with `sv`) meet every
  rule and validate against the changed schema. For some other requests it signs
  offers that these rules refuse. It changes in its own repository; this record
  is accepted only after that change is live and measured.
- **Substantive** under GOVERNANCE.md §4 and §12: this record, seven days of
  review and two approvals while two maintainers are active.
- **Migration path.** A node validates the dates, refuses a past `check_in` by
  the property's own date, copies only the four request members, sends a
  language tag or nothing, and keeps the lifetime at 900 seconds or less with
  `generated_at` at signing time. A verifier passes the stay it asked for to its
  check and applies the date, language and lifetime rules.
  `vacationrentalprotocol/vrp-verify` and the reference implementation follow in
  their own repositories.
- The examples in this repository already meet every rule: their lifetime is
  600 seconds, their stays lie after their clocks, and none carries
  `request.language`. No signed example changes.
- The IETF draft keeps the old wording until its next revision.
- Neutrality: the rules apply to every node and every verifier alike, the
  reference implementation included (ADR 0002).
