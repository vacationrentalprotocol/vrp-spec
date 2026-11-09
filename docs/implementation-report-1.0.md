# Implementation report for VRP 1.0 (Core + Well-Known URI)

**Status:** Draft, measured 2026-11-05; the verifier rows for V1 and V2 re-read 2026-11-08 after the verifier correction (hemmabo-mcp-server 7.0.13, vrp-verify 0.3.0; the notes say what changed); V1's §2:39 and §7:512 set to partial on 2026-11-09 after the independent reviewer reproduced two discovery-document gaps (see the notes). The correction is described in two published advisories: [GHSA-4phj-whvc-8frh](https://github.com/HemmaBo-se/hemmabo-mcp-server/security/advisories/GHSA-4phj-whvc-8frh) (hemmabo-mcp-server 7.0.12 → 7.0.13, published 2026-11-08 21:01 UTC) and [GHSA-6q7g-4q6r-w7g7](https://github.com/vacationrentalprotocol/vrp-verify/security/advisories/GHSA-6q7g-4q6r-w7g7) (`@vacationrentalprotocol/vrp-verify` 0.2.0 → 0.3.0, published 2026-11-08 21:05 UTC); only those versions are confirmed affected, earlier ones were not assessed. One row per normative MUST in
[spec/v0.1.md](../spec/v0.1.md) (55 lines carrying MUST at `e815600`) and
[spec/well-known-uri-v0.1.md](../spec/well-known-uri-v0.1.md) (3). It is the
evidence base for the 1.0 decision record (ADR 0013, revised): a rule with fewer
than two independent implementations on its side (node side or verifier side)
is marked **at risk** there, as W3C Process §6.3.2 and §6.3.7 do. This report
is data; it decides nothing.

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
| V1 | `hemmabo-mcp-server` reference verifier, 7.0.13 | verifier | no | `lib/vrp.ts` and `lib/vrp-offer-rules.ts` at `32cb82f` (2026-11-08; the 2026-11-05 reading was `ed4cc25`, 7.0.12) |
| V2 | `@vacationrentalprotocol/vrp-verify` 0.3.0 | verifier library (no network) | no (written by the reference implementer's editors) | `src/*.js` at `db7b905` (2026-11-08; the 2026-11-05 reading was 0.2.0 at `bd4f92e`) |
| V3 | this repository's scripts (`conformance.mjs`, `verify-offer-rules.mjs`, `verify-host-domain.mjs`, `verify-node-page.mjs`) | test suite | no (the standard's own) | `e815600` |
| V4 | `verify.html` on vacationrentalprotocol.com | verifier (browser) | no (the standard's own) | `e815600` |
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
| §2:39 | discovery `canonical_domain` MUST match the fetched domain | **partial** `lib/vrp.ts:262–267`: a present `canonical_domain` must equal the fetched domain, but an absent one falls back to `domain` and then to the fetched domain itself, so a document without the field passes | – (caller) | ✔ `verify-host-domain.mjs:109` (an absent field fails) | ✔ `verify.html:572` | ✗ | **no** | V1 gap reproduced by the independent reviewer on 2026-11-09 (Node 22, signed test offers): `safe_to_quote_as_official_direct_offer: true` without `canonical_domain`. Correction handled separately, with a regression test |
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
| §7:512 | MUST NOT quote unless all sixteen conditions hold | **partial** (7.0.13): it fetches the discovery document, the JWKS and the offer itself and applies the other conditions, but two pass when the field is absent: §7:514 (`canonical_domain` is the fetched domain) and §7:516 (`protocol_version: "0.1"` declared). `lib/vrp.ts:257–265` accepts the pre-0.1 field `version` in place of `protocol_version` and takes the fetched domain in place of a missing `canonical_domain` | ✔ for the library's part (key, JWS, payload match, §5/§6 lifetime, §5/§7 dates and the stay asked for from `context.request`, availability, exact price, booking URL, permission, §2/§7 domain from `context.domain`); fetching, the discovery document (`protocol`, `protocol_version`, `canonical_domain` of the fetched host) and transport remain the caller's, as its README says | ✔ (across scripts) | ✔ | ✗ (signature, key, payload match, `valid_until` only) | **no** | V1: both gaps reproduced by the independent reviewer on 2026-11-09 (`safe_to_quote_as_official_direct_offer: true` with `version: "0.1"` and no `protocol_version`, and without `canonical_domain`); correction handled separately, with a regression test for each case. V2 alone never decides all sixteen: three conditions need the network it does not have |
| §7:545 | MUST NOT invent discounts, say bookable unless available, quote non-exact, route elsewhere | ✔ `:31–41`, `:813–835`; `price.exact === true` explicitly, `:384–394` (7.0.13; 7.0.12 derived exactness from an amount) | ✔ `quote.js:175–187` | ✔ | ✔ | ✗ | **no** | |
| §8:555 | MUST fail closed | ✔ (throws; a §5–§7 violation is `OfferRuleViolation`, `lib/vrp.ts:125–133`, answered with `signature_valid: true`, `safe_to_quote: false`) | ✔ (`unverifiable`/`invalid`) | ✔ | ✔ | ✔ (`verified:false`) | yes | |
| §9:559/563 | MUST distinguish affirmed / negated / unknown; MUST NOT cite unknown | ✔ | ✔ `Status.UNVERIFIABLE` ≠ `INVALID` | ✔ | ✔ (`pass`/`fail`/`unknown`) | ✗ (binary) | **no** | |
| WK §3:71 | clients MUST ignore unknown fields | ✔ | ✔ | ✔ | ✔ | ✔ | yes | all read named fields only |
| WK §4:83 | MUST NOT treat the discovery document as proof | ✔ | – | ✔ | ✔ | – | yes (V5 n.a.) | |

Lines not carrying a rule: §1.1:20 (BCP 14 boilerplate), §2.1:102 (a statement
about the next MAJOR), §3.1:226 (restates :202). §2:92 is MAY.

## Summary for the 1.0 record

- **Node side:** every MUST has two independent products with `✔`, except
  §3.1:165 (rotation never exercised; C not read) and §5.3:448 (one product
  publishes a schedule). Both **at risk**.
- **Verifier side:** the reference verifier (V1) and the independent verifier
  (V5) together cover: §1, §3.1 `kid`, §5.1 reference id and unknown parameters,
  §5.1 stale, §6 `valid_until`, §8, Well-Known §3. Every other verifier rule has
  one independent organization only (V1), because V5 implements the signature,
  the key, the payload match and `valid_until` and nothing else. Those rules are
  **at risk on the verifier side** until a second organization implements them.
  The gap is one implementation away: V5 adding §2 (host-owned domain, fetched
  domain), §5.1 (booking URL), §6 (`generated_at`), §7 and §9.
- **Rules the shipped verifiers apply since 2026-11-08:** §6:502 and the §5/§7
  lifetime, date, language and request-match rules are enforced by V1 (7.0.13)
  and V2 (0.3.0) as well as by V3 and V4; until that date neither shipped
  verifier applied them (releases v7.0.13 and v0.3.0, 2026-11-08). The
  independence column on those rows is unchanged (**no**): V1 and V2 are one
  organization, and V5 does not apply them. V2's §7:512 is met for the
  library's part only; the discovery document and the transport stay with its
  caller. V1's §7:512 is partial: §7:514 and §7:516 pass when
  `canonical_domain` or `protocol_version` is absent from the discovery document
  (`lib/vrp.ts:257–265` falls back to the pre-0.1 `version` field and to the
  fetched domain), found and reproduced by the independent reviewer on
  2026-11-09; the correction is handled separately, with a regression test for
  each case. §5.3:432 (rounding) is computed by no one.
- **Not checked:** CM PRO key rotation (§3.1:165); whether V5 is still
  maintained.

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
