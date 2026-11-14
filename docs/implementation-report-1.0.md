# Implementation report for VRP 1.0 (Core + Well-Known URI)

**Status:** Draft, measured 2026-11-05; the verifier rows for V1 and V2 re-read 2026-11-08 after the verifier correction (hemmabo-mcp-server 7.0.13, vrp-verify 0.3.0; the notes say what changed); V1's §2:39 and §7:512 set to partial on 2026-11-09 after the independent reviewer reproduced two discovery-document gaps (see the notes). The correction is described in two published advisories: [GHSA-4phj-whvc-8frh](https://github.com/HemmaBo-se/hemmabo-mcp-server/security/advisories/GHSA-4phj-whvc-8frh) (hemmabo-mcp-server 7.0.12 → 7.0.13, published 2026-11-08 21:01 UTC) and [GHSA-6q7g-4q6r-w7g7](https://github.com/vacationrentalprotocol/vrp-verify/security/advisories/GHSA-6q7g-4q6r-w7g7) (`@vacationrentalprotocol/vrp-verify` 0.2.0 → 0.3.0, published 2026-11-08 21:05 UTC); only those versions are confirmed affected, earlier ones were not assessed. On 2026-11-13: V1 re-read and run at 7.1.0 (`7199356`), where the two discovery-document gaps are closed since 7.0.14 (`2f29ba7`); the three nodes measured again; and a new section, «Requirements 1.0 adds or changes», with a run of every verifier over the fifteen offer vectors of the candidate. One row per normative MUST in
[spec/v0.1.md](../spec/v0.1.md) (55 lines carrying MUST at `e815600`) and
[spec/well-known-uri-v0.1.md](../spec/well-known-uri-v0.1.md) (3), and one
entry per requirement that [spec/v1.0.md](../spec/v1.0.md) adds or changes. It
is the evidence base for the 1.0 decision record (ADR 0013, revised).

**Two different things, two different words.** ADR 0013 D5 marks exactly two
parts **at risk**: §3.1 rotation and §5.3 `rules.refund_schedule`. At risk
means the maintainers may remove the part before acceptance. A rule with fewer
than two independent implementations is not at risk for that reason: this
report says how many organizations implement it, and where no shipped
implementation exists it says **evidence outstanding**. Several products of
one organization count once. This report is data; it decides nothing.

**How to read it.** `✔` the implementation does what the rule says, with the
evidence in the notes (a live measurement with UTC, or a file and line at a
commit); `✗` it does not; `–` the rule does not address that implementation's
role; `?` not checked. Every claim below is one of those four.

## Implementations

| Id | Implementation | Role | Independent of the reference implementer? | Evidence read at |
| --- | --- | --- | --- | --- |
| A | `villaakerlyckan.se` (HemmaBo, `key_custody: platform`) | node | no | live 2026-11-05T14:46:42–14:46:57Z; `hemmabo-smart-stays` `879ff1e` |
| B | `lakeviewhome.se` (HemmaBo, `key_custody: platform`) | node | no (same software as A) | live 2026-11-05T14:47:48–14:48:03Z |
| C | `apartmamatevz.si` (CM PRO, `key_custody: self`) | node | **yes** | live 2026-11-05T14:48:04–14:48:15Z; `viljemd-hub/channel-manager` `public/api/vrp_offer.php` read 2026-11-05T14:46:59Z |
| V1 | `hemmabo-mcp-server` reference verifier, 7.1.0 | verifier | no | §2:39, §7:514, §7:516 and the new 1.0 requirements: `lib/vrp.ts` at `7199356` (7.1.0, read and run 2026-11-13). Every other row: `lib/vrp.ts` and `lib/vrp-offer-rules.ts` at `32cb82f` (7.0.13, 2026-11-08; the 2026-11-05 reading was `ed4cc25`, 7.0.12); those line numbers are 7.0.13's and were not re-read at 7.1.0 |
| V2 | `@vacationrentalprotocol/vrp-verify` 0.3.0 | verifier library (no network) | no (written by the reference implementer's editors) | `src/*.js` at `db7b905` (2026-11-08; the 2026-11-05 reading was 0.2.0 at `bd4f92e`) |
| V3 | this repository's scripts (`conformance.mjs`, `verify-offer-rules.mjs`, `verify-host-domain.mjs`, `verify-node-page.mjs`) | test suite | no (the standard's own) | `e815600`; the new 1.0 requirements at the commit that carries this text (`scripts/conformance.mjs`, `verify-offer-vectors.mjs`, `verify-version-vectors.mjs`) |
| V4 | `verify.html` on vacationrentalprotocol.com | verifier (browser) | no (the standard's own) | `e815600`; the new 1.0 requirements at the commit that carries this text (`verify.html`, run by `scripts/verify-web-verifier.mjs`) |
| V5 | `vrp-independent-verifier` (Swarnabha Nandi, MIT) | verifier | **yes** | `src/verifier.mjs` at `bc959ba` (last commit 2026-08-22) |

Node side: two software products (HemmaBo, CM PRO) → two independent
implementations where both have `✔`. Verifier side: the reference verifier and
V5 are the two organizations; V2–V4 are the standard's own artifacts and do not
count toward independence (W3C §6.3.2: implementations by others than the
authors).

## Node measurements (live, GET only)

| Check | A | B | C |
| --- | --- | --- | --- |
| discovery `protocol`, `protocol_version` | `vacation-rental-protocol`, `0.1` | same | same |
| `canonical_domain` equals the fetched host | ✔ | ✔ | ✔ |
| `jwks_url`, `verified_stay_offer_endpoint` are node URLs | ✔ | ✔ | ✔ |
| `canonical_domain` host-owned (§2 steps 1–3, vrp-verify 0.2.0 lists) | ✔ (2026-11-04 08:48Z) | ✔ | ✔ |
| JWKS key `kty OKP`, `crv Ed25519`, `alg EdDSA`, `kid` present, no private part | ✔ | ✔ | ✔ |
| JWKS `Cache-Control` | `public, max-age=300` | same | same |
| offer: 12 required payload fields | ✔ | ✔ | ✔ |
| offer: signed payload equals returned offer | ✔ | ✔ | ✔ |
| offer: `valid_until − generated_at` | 900 s | 900 s | 600 s |
| offer: request echo limited to the four fields (+ computed weekday/nights) | ✔ | ✔ | ✔ (no `language` echo) |
| offer: `language=not-a-tag-xx` is left out of the signed payload | ✔ | ✔ | ✔ (never echoed) |
| offer: `check_in` in the past → `400 checkin_in_past` | ✔ | ✔ | ✔ |
| offer: `check_out` before `check_in` → `400` | ✔ `checkout_must_be_after_checkin` | ✔ | ✔ `invalid_range` |
| `direct_booking_url` absolute https node URL of `canonical_domain` | ✔ | ✔ | ✔ |
| `booking.payment_options` absent | ✔ | ✔ | ✔ |
| `rules.refund_schedule` | 1 row | 2 rows | absent |
| `availability.available`, `price.exact`, `may_quote_as_official_direct_offer` | true, true, true | same | same |
| `http://` discovery → redirect to the https node URL | 308 ✔ | 308 ✔ | 301 ✔ |
| `www.` discovery | 308 → apex ✔ | 308 → apex ✔ | 200 served (www is a node URL) ✔ |
| §2.1 (a) `<link rel="protocol">`, (b) visible `rel="protocol"` link with «VRP», (d) `additionalType`, (e) term in own language | ✔ (2026-11-05T05:42:48Z) | ✔ (05:52:26Z) | ✔ (2026-11-04T08:49:14Z) |

## Rules addressed to nodes

| Core line | Rule (short) | A | B | C | Independent (≥ 2 products) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| §2:37 | `protocol` MUST be `vacation-rental-protocol` | ✔ | ✔ | ✔ | yes | measured |
| §2:38 | `protocol_version` MUST be `0.1` | ✔ | ✔ | ✔ | yes | measured; 1.0 changes this rule (ADR 0013 rev.) |
| §2:39 | `canonical_domain` MUST match the fetched domain | ✔ | ✔ | ✔ | yes | measured |
| §2:41 | `jwks_url` MUST be the host-domain JWKS and a node URL | ✔ | ✔ | ✔ | yes | measured |
| §2:42–43 | offer endpoint MUST be a node URL | ✔ | ✔ | ✔ | yes | measured |
| §2:46 | `canonical_domain` MUST be host-owned (steps 1–3) | ✔ | ✔ | ✔ | yes | measured with vrp-verify 0.2.0 and the 53 vectors |
| §2.1:121 | `rel="protocol"` href MUST NOT point to an implementation or operator | ✔ | ✔ | ✔ | yes | measured: all three link vacationrentalprotocol.com |
| §3:142 | signing keys MUST use OKP/Ed25519 | ✔ | ✔ | ✔ | yes | measured |
| §3.1:165 | rotation: MUST publish the new key alongside the old | ✔ (read) | ✔ (read) | ? | **no** | A/B: `api/_lib/vrp-node-key.js:93` serves `active`, `next`, `retired`; never exercised live (1 key each). C: not read |
| §5:250 | payload MUST include the 12 fields | ✔ | ✔ | ✔ | yes | measured |
| §5:269–271 | dates MUST exist, `check_out` later than `check_in` | ✔ | ✔ | ✔ | yes | measured (backwards → 400) |
| §5:272 | MUST NOT sign past or invalid dates | ✔ | ✔ | ✔ | yes | measured (past → 400); C: `vrp_offer.php` property-date check read |
| §5:278 | MUST NOT copy other request values into the payload | ✔ | ✔ | ✔ | yes | measured: bad language dropped; request keys limited |
| §5:280 | `request.language` MUST be a BCP 47 tag of the given form | ✔ | ✔ | – | yes (A/B) / n.a. (C) | A/B: `api/verified-stay-offer.ts:82–86`; C never echoes language |
| §5:288–289 | `generated_at` MUST be signing time; `valid_until` MUST be later and ≤ 900 s | ✔ | ✔ | ✔ | yes | measured 900 s / 900 s / 600 s; A/B `verified-stay-offer.ts:133`; C `vrp_offer.php` `+10 minutes` |
| §5.1:324 | `booking` MUST include `direct_booking_url` | ✔ | ✔ | ✔ | yes | measured |
| §5.1:334 | MUST be an absolute https URL | ✔ | ✔ | ✔ | yes | measured |
| §5.1:335–337 | MUST be a node URL of `canonical_domain`, MUST NOT point elsewhere | ✔ | ✔ | ✔ | yes | measured |
| §5.2:418 | rails MUST NOT gate discovery, verification or offer retrieval | ✔ | ✔ | ✔ | yes | no `payment_options`; all three serve offers without payment context |
| §5.3:448 | nodes MUST relay refund rows verbatim (not tiers) | ✔ | ✔ | – | **no** (one product) | A/B: rows signed in the offer; C publishes no schedule. **At risk** (optional field, one product) |
| WK §5:89 | discovery MUST NOT contain secrets | ✔ | ✔ | ✔ | yes | read: public metadata only; JWKS carries no private part |

## Rules addressed to verifiers and agents

| Core line | Rule (short) | V1 | V2 | V3 | V4 | V5 | Independent (V1 + V5) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| §1:14 | verification MUST NOT require HemmaBo, a registry or an index | ✔ | ✔ | ✔ | ✔ | ✔ | yes | V1 fetches only the node's domain; V2/V3/V5 run offline |
| §2:39 | discovery `canonical_domain` MUST match the fetched domain | ✔ `lib/vrp.ts:279–289` at `7199356` (since 7.0.14, `2f29ba7`): the document itself must declare `canonical_domain`, a string equal to the fetched domain as written; neither the pre-0.1 member `domain` nor the fetched domain stands in | – (caller) | ✔ `verify-host-domain.mjs:109` (an absent field fails) | ✔ `verify.html:572` | ✗ | **no** | V1 was **partial** until 7.0.13: an absent `canonical_domain` passed (reproduced by the independent reviewer on 2026-11-09). Closed in 7.0.14; V1's own test `src/vrp-discovery-document.contract.test.ts` run at `7199356` on 2026-11-13 10:34:45 UTC: 19 of 19 pass |
| §2:46/70 | host-owned check; no lists → `unknown` | ✔ `:240–249` | ✔ `quote.js:77` (`hostDomainFailures`) | ✔ | ✔ `verify.html:465–474` | ✗ | **no** | |
| §2:82 | MUST NOT follow a redirect off node URLs | ✔ `:193–224` (`fetchJson`, `redirect: "manual"`, `:215`) | – (caller) | ✔ `checkRedirects` (vectors) | ✔ `verify.html:508–513` (no redirect followed) | ✗ | **no** | |
| §2.1:121 | checker for (a)/(b) href | – | – | ✔ `verify-node-page.mjs:52` | – | – | n.a. | a page checker, not a verifier rule |
| §3.1:170 | `kid` MUST be opaque; MUST NOT infer from it | ✔ | ✔ | ✔ | ✔ `:395–403` | ✔ | yes | all select the key by `kid` and read nothing else into it |
| §3.1:174 | refresh-on-miss | ✔ (no cache: `:200` `no-store`) | – | – | ✔ (`no-store`) | – | yes (trivially) | neither caches |
| §3.1:202 | JWKS cache MUST NOT exceed 5 min | ✔ (no cache) | – | – | ✔ (no cache) | – | yes (trivially) | |
| §5.1:334–341 | booking URL MUST be https node URL; else `unknown`, MUST NOT route | ✔ `isNodeUrl` `:797` | ✔ `quote.js:104` (`bookingUrlFailure`) | ✔ `checkNodeUrl` | ✔ `:497` | ✗ | **no** | |
| §5.1:351–352 | reference id MUST NOT be required nor substitute the signature | ✔ | ✔ | ✔ | ✔ | ✔ | yes | none reads `offer_id` |
| §5.1:355 | MUST ignore unknown query parameters | ✔ | ✔ | ✔ | ✔ | ✔ | yes | none parses them |
| §5.1:362–364 | MUST NOT accept a URL outside, or modified after, the JWS | ✔ `:783` (from payload) | ✔ (payload) | ✔ | ✔ (payload) | – | yes (V5 n.a.) | |
| §5.1:371–372 | stale → `unknown`, MUST NOT present its price | ✔ `lib/vrp-offer-rules.ts:121–136`, refused in `lib/vrp.ts:1047–1051` | ✔ `Status.EXPIRED` (`offer.js:143–144`) | ✔ `verify-offer-rules.mjs:84` | ✔ | ✔ `fresh:false` | yes | |
| §5.2:402 | MUST NOT treat `payment_options` as a payment path | ✔ (routes only `direct_booking_url`) | – | – | – | – | n.a. for libraries | |
| §5.3:432 | refund rounding: MUST NOT substitute other rounding | – (passes rows through, computes nothing) | – | – | – | – | n.a. | no implementation computes `H` |
| §5.3:442 | MUST NOT invent a refund promise when absent | ✔ `:654–666` (null = unknown) | – | – | – | – | **no** (one) | |
| §5.3:448 | agents MUST relay rows verbatim | ✔ `:896` | – | – | – | – | **no** (one) | |
| §5.4:455/481/494 | class rules (verifiable / attested / reputational) | ✔ `:930` rule text | – | – | – | – | **no** (one) | a renderer rule; only V1 renders |
| §6:500 | non-quoteable if `valid_until` missing/malformed/expired | ✔ `lib/vrp-offer-rules.ts:121–136` (UTC form with `Z`), `lib/vrp.ts:1047–1051` | ✔ `VALID_UNTIL_UNUSABLE`, `offer.js:143–144` | ✔ `:76,84` | ✔ | ✔ (missing → not fresh) | yes | |
| §6:502 | non-quoteable if `generated_at` missing or > 60 s ahead | ✔ `lib/vrp-offer-rules.ts:121–136`, refused in `lib/vrp.ts:1047–1051` (7.0.13) | ✔ `src/offer-rules.js:104–119`, `src/offer.js:143–144` (0.3.0) | ✔ `:82` | ✔ (`:553–561`) | ✗ | **no** | V1 and V2 apply it since 2026-11-08 (releases v7.0.13 and v0.3.0); until then neither read `generated_at`. V5 does not; V1 and V2 are one organization |
| §5:269–289, §7:512 | lifetime ≤ 900 s, dates exist and are not past, language form, request match | ✔ `lib/vrp-offer-rules.ts:121–172` (the stay asked for = the tool's arguments, `lib/vrp.ts:1047–1051`) | ✔ `src/offer-rules.js:104–156`, `src/quote.js:138–143` (the stay asked for = `context.request`; without it `asked_stay_unknown`) | ✔ `verify-offer-rules.mjs` | ✔ | ✗ | **no** | the offer-rules vectors (44) pass in V1 (`src/vrp-offer-rules.unit.test.ts`, and through the tool handler in `src/vrp-offer-rules.contract.test.ts`), V2 (`test/offer-rules.test.mjs`: parity, and through `verifyOffer` and `quoteChecks`), V3 and V4; since 2026-11-08 |
| §7:512 | MUST NOT quote unless all sixteen conditions hold | ✔ for §7:514 and §7:516 at `7199356` (since 7.0.14): `lib/vrp.ts:262–270` requires `protocol_version` in the document and compares it as written, `:279–289` does the same for `canonical_domain`. The other conditions as read at `32cb82f` (7.0.13); not re-read at 7.1.0 | ✔ for the library's part (key, JWS, payload match, §5/§6 lifetime, §5/§7 dates and the stay asked for from `context.request`, availability, exact price, booking URL, permission, §2/§7 domain from `context.domain`); fetching, the discovery document (`protocol`, `protocol_version`, `canonical_domain` of the fetched host) and transport remain the caller's, as its README says | ✔ (across scripts) | ✔ | ✗ (signature, key, payload match, `valid_until` only) | **no** | V1 was **partial** until 7.0.13: both gaps were reproduced by the independent reviewer on 2026-11-09 (`safe_to_quote_as_official_direct_offer: true` with `version: "0.1"` and no `protocol_version`, and without `canonical_domain`). Closed in 7.0.14 (`2f29ba7`), with a regression test for each case (19 of 19 pass at `7199356`, 2026-11-13). V2 alone never decides all sixteen: three conditions need the network it does not have |
| §7:545 | MUST NOT invent discounts, say bookable unless available, quote non-exact, route elsewhere | ✔ `:31–41`, `:813–835`; `price.exact === true` explicitly, `:384–394` (7.0.13; 7.0.12 derived exactness from an amount) | ✔ `quote.js:175–187` | ✔ | ✔ | ✗ | **no** | |
| §8:555 | MUST fail closed | ✔ (throws; a §5–§7 violation is `OfferRuleViolation`, `lib/vrp.ts:125–133`, answered with `signature_valid: true`, `safe_to_quote: false`) | ✔ (`unverifiable`/`invalid`) | ✔ | ✔ | ✔ (`verified:false`) | yes | |
| §9:559/563 | MUST distinguish affirmed / negated / unknown; MUST NOT cite unknown | ✔ | ✔ `Status.UNVERIFIABLE` ≠ `INVALID` | ✔ | ✔ (`pass`/`fail`/`unknown`) | ✗ (binary) | **no** | |
| WK §3:71 | clients MUST ignore unknown fields | ✔ | ✔ | ✔ | ✔ | ✔ | yes | all read named fields only |
| WK §4:83 | MUST NOT treat the discovery document as proof | ✔ | – | ✔ | ✔ | – | yes (V5 n.a.) | |

Lines not carrying a rule: §1.1:20 (BCP 14 boilerplate), §2.1:102 (a statement
about the next MAJOR), §3.1:226 (restates :202). §2:92 is MAY.

## Requirements 1.0 adds or changes

[spec/v1.0.md](../spec/v1.0.md) carries 61 lines with MUST where
[spec/v0.1.md](../spec/v0.1.md) carries 55. The requirements below are the ones
that are new or changed; every other rule is a v0.1 rule and has its row above.
Each is reported separately: the implementation, its organization, the exact
commit or the UTC instant of a live measurement, and the result of a run.
Measured 2026-11-13.

**Organizations.** Four, and several products of one count once:

| Organization | Implementations |
| --- | --- |
| HemmaBo, the reference implementer | A, B (nodes), V1 (verifier) |
| The standard's own maintainers, who are the reference implementer's editors | V2, V3, V4. Together with HemmaBo they are one organization for the purpose of independence |
| CM PRO (Viljem Dvojmoč) | C (node) |
| Swarnabha Nandi | V5 (verifier) |

### Node requirements

Live, `GET` only, one request per second per host: the start page, the
discovery document, the JWKS and one signed offer
(`check_in=2027-03-10&check_out=2027-03-13&guests=2`).

| Requirement | A `villaakerlyckan.se` (HemmaBo) | B `lakeviewhome.se` (HemmaBo) | C `apartmamatevz.si` (CM PRO) | Organizations with `✔` |
| --- | --- | --- | --- | --- |
| Measured (UTC) | 10:26:10–10:26:17 | 10:26:20–10:26:26 | 10:26:29–10:26:34 | |
| §2: `protocol_version` MUST be `1.0` or `0.1` | ✔ declares `"0.1"` | ✔ declares `"0.1"` | ✔ declares `"0.1"` | two |
| §2.1 (a): the head MUST contain `<link rel="protocol" href="https://vacationrentalprotocol.com/">` | ✔ present | ✔ present | ✔ present | two |
| §2.1 (b): the body MUST contain a visible `rel="protocol"` link to `/verify?host=…` whose text contains `VRP` | ✔ «VRP-verifierad» | ✔ «VRP verified» | ✔ «Verified VRP vacation rental» | two |

What no node does, and 1.0 does not require: no node declares `"1.0"` (the
discovery document, the offer envelope and the signed payload all say `"0.1"`
on all three), and no node signs with the name `Ed25519` (JWS header
`alg: EdDSA` and JWKS key `alg: EdDSA` on all three). Both are MAY in 1.0;
ADR 0013 D9 puts nodes after verifiers.

### Verifier requirements

Run: every verifier over the fifteen signed-offer vectors in
`examples/conformance/offer/`, each with the vector's own JWKS and clock.
«accept» and «refuse» are the decision; the engine's own reason is quoted
where it differs from the vector's.

| Implementation | Organization | Commit | How it was run |
| --- | --- | --- | --- |
| V1 `hemmabo-mcp-server` 7.1.0 | HemmaBo | `7199356` | `verifyCompactJws` in `lib/vrp.ts`, the function its tools call for the signature (the complete tool flow fetches the node and cannot take a vector); and its own test `src/vrp-discovery-document.contract.test.ts`, 19 of 19 pass, 10:34:45 UTC |
| V2 `@vacationrentalprotocol/vrp-verify` 0.3.0 | the standard's own | `db7b905` | `verifyOffer`; published as a conformance report (below) |
| V3 this repository's `scripts/conformance.mjs` | the standard's own | the commit the conformance report names | `verifyOfferVector`; `npm test`; published as a conformance report |
| V4 `verify.html` | the standard's own | the commit that carries this text, not the commit the conformance reports name: `scripts/verify-web-verifier.mjs` does not exist before it | the page's own script, evaluated as served: its `verifyJws` over every offer vector and over the valid vector's key under other labels, and its `checkDiscovery` over the discovery documents (`npm run verify-web-verifier`). What the page decides when it renders (the offer's version, lifetime, dates) is read, not run |
| V5 `vrp-independent-verifier` 1.0.0 | Swarnabha Nandi | `bc959ba` (read from a checkout of that commit) | `verifyOffer(vector)`; published as a conformance report |

| Vector | Expected | V3 | V2 | V5 | V1 (signature function) |
| --- | --- | --- | --- | --- | --- |
| 01 `0.1`, `EdDSA`, fresh | accept | accept | accept | accept | signature verifies |
| 02 `0.1`, `EdDSA`, expired | accept, not fresh | accept, not fresh | accept, not fresh | accept, not fresh | signature verifies |
| 03 tampered signature | refuse | refuse | refuse | refuse | refuse |
| 04 unknown `kid` | refuse | refuse | refuse | refuse | refuse |
| 05 wrong key | refuse | refuse | refuse | refuse | refuse |
| 06 `1.0`, header `Ed25519` | accept | accept | **refuse** (`unexpected_alg`) | **refuse** (`wrong_key`) | **refuse** («Unsupported JWS alg: Ed25519») |
| 07 header `ES256` | refuse `unexpected_alg` | refuse | refuse | refuse, as `wrong_key` | refuse |
| 08 `1.0`, `EdDSA` | accept | accept | accept (version not read) | accept (version not read) | signature verifies (version not read) |
| 09 version `0.2` | refuse `unsupported_version` | refuse | **accept** | **accept** | **signature verifies; the version is not read** |
| 10 `0.1`, header `Ed25519` | accept | accept | **refuse** (`unexpected_alg`) | **refuse** (`wrong_key`) | **refuse** |
| 11 header `Ed25519`, key `alg` `Ed25519` | accept | accept | **refuse** (`unexpected_alg`) | **refuse** (`wrong_key`) | **refuse** |
| 12 header `EdDSA`, key `alg` `Ed25519` | accept | accept | accept | **refuse** (`wrong_key`) | signature verifies |
| 13 header `none`, no signature | refuse `unexpected_alg` | refuse | refuse | refuse, as `wrong_key` | refuse |
| 14 header `ed25519` (lower case) | refuse `unexpected_alg` | refuse | refuse | refuse, as `wrong_key` | refuse |
| 15 no version in the signed payload | refuse `missing_protocol_version` | refuse | **accept** | **accept** | **signature verifies; the version is not read** |

**§2, §7: a verifier accepts a discovery document declaring `"1.0"` or `"0.1"`
and refuses any other value, or none.**

| Implementation | Result | Evidence |
| --- | --- | --- |
| V1 | not implemented: `"1.0"` is refused | `lib/vrp.ts:16` (`VRP_PROTOCOL_VERSION = "0.1"`) and `:262–270` at `7199356`: an absent version is refused, and every value but `"0.1"` is refused as «Unsupported VRP version». Its own test «still refuses a protocol_version other than 0.1» passes |
| V2 | does not read the discovery document | `src/quote.js:38–41` at `db7b905`: the discovery document, and that it declares `protocol_version`, is the caller's responsibility |
| V3 | implemented | `checkDiscoveryVersion` in `scripts/conformance.mjs`; `npm run verify-version-vectors`: 15 discovery documents and 8 pairs pass |
| V4 | implemented | `verify.html`: `d.protocol_version === "1.0" \|\| d.protocol_version === "0.1"`; `npm run verify-web-verifier`: 15 discovery documents pass |
| V5 | does not read the discovery document | `src/verifier.mjs` at `bc959ba` takes a vector and nothing else |

Organizations with a shipped implementation: none. **Evidence outstanding.**

**§3, §5: a verifier accepts `Ed25519` and `EdDSA` in the JWS header and on
the key, and refuses any other `alg`.** Vectors 06, 10, 11, 12 (accept) and 07,
13, 14 (refuse). What these seven vectors show is limited, and the rows below
claim no more than that: in 07, 13 and 14 the name in the JWS header and the
unsigned `signature.alg` beside it change together, and no vector carries a
name other than the two on the key. A refusal of those three therefore shows
that the engine refused the offer; it does not show which of the two values
the engine read, and the vectors say nothing about a key labelled with another
name.

| Implementation | Result | Evidence |
| --- | --- | --- |
| V1 | the new name is not implemented: vectors 06, 10 and 11 are refused; 07, 13 and 14 are refused | `lib/vrp.ts:17` (`VRP_JWS_ALG = "EdDSA"`) and `:333` at `7199356`, which compares the JWS header; run above |
| V2 | the new name is not implemented: vectors 06, 10 and 11 are refused; 07, 13 and 14 are refused | `src/jws.js:50` at `db7b905`, which compares the JWS header; run above |
| V3 | the seven vectors come out as expected | `SIGNATURE_ALGS` and `verifyCompactJws` in `scripts/conformance.mjs`, which compares the JWS header; run above |
| V4 | implemented | `verify.html`: `header.alg !== "Ed25519" && header.alg !== "EdDSA"`, and the same two names on the key; `npm run verify-web-verifier`: the fifteen offer vectors and twelve key labels pass |
| V5 | the new name is not implemented: vectors 06, 10, 11 and 12 are refused; 07, 13 and 14 are refused, with the reason `wrong_key` | run above |

Organizations with a shipped implementation of the new name: none. **Evidence
outstanding.** No count of organizations is given for the refusal of other
names: the seven vectors do not separate the header from the unsigned field
beside it, and none tests the key's label, so they cannot carry that
conclusion. Vectors that do are outstanding as well.

**§5, §9: a verifier refuses an offer whose signed payload declares an unknown
version, or none.** Vectors 08 (accept), 09 and 15 (refuse).

| Implementation | Result | Evidence |
| --- | --- | --- |
| V1 | not implemented: the signed payload's version is not read | `protocol_version` occurs in `lib/` at `7199356` only for the discovery document (`lib/vrp.ts:262`) and in the tool's own output (`:1047`); run above |
| V2 | not implemented: the version is not read | run above: 09 and 15 are accepted as `verified` |
| V3 | implemented | `checkOfferVersion` in `scripts/conformance.mjs`; vectors 08, 09, 15 and the eight pairs as expected |
| V4 | implemented, read only | `verify.html`: an offer whose `protocol_version` is neither value is «unknown (VRP §9)» and is not presented as safe to quote |
| V5 | not implemented: the version is not read | run above: 09 and 15 are accepted |

Organizations with a shipped implementation: none. **Evidence outstanding.**
That V1, V2 and V5 accept vector 08 is not evidence of support for `"1.0"`:
each accepts `"0.2"` in the same way.

**Conformance reports of these runs** (one run, one engine, one corpus;
[format](conformance-report.md)), each bound to the corpus digest and the
engine's commit:

- V3: [`offer.reference-verifier.v1.0-candidate.json`](../examples/conformance/reports/offer.reference-verifier.v1.0-candidate.json)
- V2: [`offer.vrp-verify.v1.0-candidate.json`](../examples/conformance/reports/offer.vrp-verify.v1.0-candidate.json)
- V5: [`offer.vrp-independent-verifier.v1.0-candidate.json`](../examples/conformance/reports/offer.vrp-independent-verifier.v1.0-candidate.json)

The v0.1 report,
[`offer.reference-verifier.v0.1.json`](../examples/conformance/reports/offer.reference-verifier.v0.1.json),
is kept unchanged: it binds to the five-vector corpus at its own commit.

## Summary for the 1.0 record

- **Node side:** every MUST has two independent products with `✔`, except
  §3.1:165 (rotation never exercised; C not read) and §5.3:448 (one product
  publishes a schedule). Both are marked **at risk** in ADR 0013 D5, and they
  are the only two parts so marked. The node requirements 1.0 adds or changes
  (§2 version, §2.1 (a) and (b)) are met by all three nodes, two
  organizations.
- **Verifier side:** the reference verifier (V1) and the independent verifier
  (V5) together cover: §1, §3.1 `kid`, §5.1 reference id and unknown parameters,
  §5.1 stale, §6 `valid_until`, §8, Well-Known §3. Every other verifier rule has
  one organization only (V1), because V5 implements the signature, the key,
  the payload match and `valid_until` and nothing else. ADR 0013 does not mark
  those rules at risk: they stay in 1.0, with one organization behind them
  until a second implements them. The gap is one implementation away: V5
  adding §2 (host-owned domain, fetched domain), §5.1 (booking URL), §6
  (`generated_at`), §7 and §9.
- **Verifier requirements 1.0 adds: evidence outstanding.** No shipped
  verifier implements any of the three (a discovery document declaring `"1.0"`;
  the name `Ed25519`; an unknown or absent version in the signed offer). Only
  the standard's own script (V3) and page (V4) do. What ADR 0013 D6 asks for
  before acceptance, and what is missing on 2026-11-13:
  1. V2 (`vrp-verify`): code at a named commit that passes all fifteen offer
     vectors. Today 06, 09, 10, 11 and 15 fail.
  2. V1 (`hemmabo-mcp-server`): code at a named commit that accepts a
     discovery document declaring `"1.0"`, accepts `Ed25519`, and refuses an
     unknown or absent version in the signed offer. Today it refuses `"1.0"`
     and `Ed25519` and does not read the offer's version.
  3. V1 and V2 are one organization. A second organization for these three
     requirements would be V5, or another verifier, passing the same vectors
     and the discovery-document vectors. Today V5 fails 06, 09, 10, 11, 12 and
     15 and reports `wrong_key` where the vectors say `unexpected_alg` (07,
     13, 14). ADR 0013 D6 proposes that acceptance waits for it; that is a
     proposal for the review, not a decision taken.
  4. Vectors that test the name in the JWS header apart from the unsigned
     field beside it, and the key's label apart from both. The fifteen offer
     vectors do neither.
- **Rules the shipped verifiers apply since 2026-11-08:** §6:502 and the §5/§7
  lifetime, date, language and request-match rules are enforced by V1 (7.0.13)
  and V2 (0.3.0) as well as by V3 and V4; until that date neither shipped
  verifier applied them (releases v7.0.13 and v0.3.0, 2026-11-08). The
  independence column on those rows is unchanged (**no**): V1 and V2 are one
  organization, and V5 does not apply them. V2's §7:512 is met for the
  library's part only; the discovery document and the transport stay with its
  caller. V1's §7:514 and §7:516 were partial until 7.0.13 (an absent
  `canonical_domain` or `protocol_version` passed; found and reproduced by the
  independent reviewer on 2026-11-09) and are closed since 7.0.14 (`2f29ba7`),
  read and run at 7.1.0 (`7199356`) on 2026-11-13. §5.3:432 (rounding) is
  computed by no one.
- **Not checked:** CM PRO key rotation (§3.1:165); whether V5 is still
  maintained; V1's rows other than §2:39, §7:514 and §7:516 at 7.1.0 (they
  stand as read at 7.0.13); what `verify.html` (V4) decides when it renders
  (the offer's version, lifetime, dates), which no automatic run covers.

## Reproduce

Nodes: `GET` the three documents and four offer requests listed under
«Node measurements» (`check_in=2027-03-10&check_out=2027-03-13&guests=2`, a
past `check_in`, a `check_out` before `check_in`, and `language=not-a-tag-xx`),
one request per second per host. Verifiers: the file and line references above
at the commits given; `npm run verify-offer-rules`, `verify-host-domain`,
`verify-offer-vectors`, `verify-node-page` in this repository. V1: `npm test`
in hemmabo-mcp-server at `32cb82f` (`src/vrp-offer-rules.unit.test.ts`,
`src/vrp-offer-rules.contract.test.ts`); V2: `node --test` in vrp-verify at
`db7b905` (`test/offer-rules.test.mjs`).

Requirements 1.0 adds or changes: in this repository, `npm test` (it runs
`verify-offer-vectors`, `verify-version-vectors`, `verify-web-verifier` and
`validate`, which reads the four 1.0 schemas). The conformance reports:

```bash
node scripts/conformance-report.mjs --engine reference --revision <commit> --run-at <UTC> --out <file>
```

```bash
node scripts/conformance-report.mjs --engine scripts/report-adapters/vrp-verify.mjs --engine-dir <vrp-verify at db7b905> --revision <commit> --run-at <UTC> --out <file>
```

```bash
node scripts/conformance-report.mjs --engine scripts/report-adapters/vrp-independent-verifier.mjs --engine-dir <vrp-independent-verifier at bc959ba> --revision <commit> --run-at <UTC> --out <file>
```

V1: in hemmabo-mcp-server at `7199356`, `npx tsx --test
src/vrp-discovery-document.contract.test.ts`, and `verifyCompactJws` from
`lib/vrp.ts` called with each vector's `input.signature.jws` and `jwks`.
Nodes: the four `GET` requests named under «Node requirements».
