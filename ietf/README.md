# IETF Internet-Draft sources

`draft-abbas-vrp-offer-verification-00` distills the VRP v0.1 specification
(core spec + well-known URI spec) into an IETF Internet-Draft: discovery
document, JWKS with rotation/revocation, the signed verified stay offer,
the verification procedure (safe-to-quote, fail-closed, three-state,
verifiability classes), and a description of the existing IANA registration
of the `vacation-rental.json` well-known URI suffix.

- **Source:** `draft-abbas-vrp-offer-verification-00.xml` (RFCXML v3 — the
  submission artifact)
- **Rendered:** `draft-abbas-vrp-offer-verification-00.txt` (generated;
  regenerate with `xml2rfc --v3 <file>.xml --text`)
- **Validated 2026-07-30:** xml2rfc 3.34.0 renders clean; idnits 2.17.1 =
  0 errors, 0 flaws (the single remaining warning is the standard
  pre-submission "couldn't figure out when first submitted" artifact).
- **Rewritten 2026-11-04 from `spec/v0.1.md` as it reads on `main`** (ADR
  0009 host-owned domain, node URL and fetching; ADR 0006 node page
  identification as SHOULD; ADR 0012 the stay asked for, dates, echoed
  fields and lifetime; `price.minor_unit`; the sixteen Safe-to-Quote
  conditions; Security and Privacy Considerations). Every MUST in Core §2,
  §5, §6 and §7 has a counterpart; the draft adds none. xml2rfc 3.35.0
  renders clean; idnits was not run in that session.
- **Corrected 2026-11-13, editorial; no normative rule changed** (the
  `<bcp14>` keywords are the same, count by count): the Abstract says what
  verification proves (a key the domain publishes signed these terms, they
  are unaltered and within their lifetime; a valid signature does not
  guarantee that the stay is in fact available); the Introduction no longer
  compares VRP with other protocols; IANA Considerations describes the
  existing registration and requests no action. The draft still describes
  VRP v0.1 and keeps the name `-00`.
- **Validated 2026-11-13 on the corrected files:** xml2rfc 3.35.0 renders
  with no warning; idnits 2.17.1 (on the `.txt`) = 0 errors, 0 flaws,
  2 warnings, 1 comment; idnits 3.3.0 (on the `.xml`, submission mode) = no
  nit. The two warnings are `example.co.uk` on the line that mirrors Core
  §2's example of a host-owned domain, and the standard pre-submission
  "couldn't figure out when first submitted"; the comment is the informative
  reference RFC 6962 (obsoleted by RFC 9162). None was silenced by changing
  a rule or a reference.
- **Corrected 2026-11-14, first round, editorial** (the `<bcp14>` keywords
  were the same after it, count by count: 111 in all, before the second round
  below). Four places: the Introduction says what the checks show (a key the
  host domain publishes signed these terms, the price among them, unaltered;
  separate checks tie the offer and the booking URL to that domain; a valid
  signature does not guarantee that the stay is in fact available) and no
  longer says a client checks "the exact amount the guest will pay"; the
  `price.minor_unit` entry carries Core §5's sentence again ("The schema
  requires the flag"); Implementation Status names the kinds of
  implementation the repository lists (a reference implementation, an
  independent signing node, an independent verifier) and points to the
  implementation report, and no longer says "One implementation is live ...
  exercising every normative requirement"; the Acknowledgements no longer
  say "every failure mode".
- **Corrected 2026-11-14, second round; two rules brought back to Core.**
  Direct Booking URL no longer says that the query-parameter names are exact
  names that implementations are forbidden to normalize: Core §5.1 only
  recommends the names. The SHOULD, the RECOMMENDED names and the integrity
  rule (a verifier does not accept a `direct_booking_url` delivered outside,
  or modified after, the signed payload) are unchanged. Privacy
  Considerations applies the rule against guest personal data and secrets to
  the discovery document only, as Well-Known §5 does, and says, as Core §15
  does, that the JWKS carries public keys only and has no separate rule.
  Implementation Status no longer says that the implementation report takes
  each mandatory requirement in turn: the report assesses mandatory
  requirements, not all of them (it has no row for the rule in Core §2 that
  a verifier does not assume self-custody when `key_custody` is absent), and
  no recommendations. The `<bcp14>` keywords: MUST NOT 31 to 30, the rest
  unchanged; 110 in all. Core, the schemas and the implementation report are
  not changed.
- **Validated 2026-11-14 on the files of the second round:** xml2rfc 3.35.0
  renders with no warning; idnits 3.3.0 (on the `.xml`, submission mode) = no
  nit; idnits 2.17.1 (on the `.txt`) = 0 errors, 0 flaws, 2 warnings,
  1 comment, the same three items as on 2026-11-13. idnits 3.3.0 in normal
  mode gives three warnings, the same on the files before the corrections:
  the two domain names in running text in Sections 3.2 and 3.8, and RFC 6962.
- **Compared with Core 2026-11-14, keyword by keyword** (all 111 `<bcp14>`
  elements of the first-round file against `spec/v0.1.md` and
  `spec/well-known-uri-v0.1.md` on `main`). The two requirements the draft
  had added are removed in the second round; the comparison found no other
  MUST or MUST NOT that Core does not state, so "the draft adds none" above
  now holds for those two keywords as far as this comparison goes. Not
  changed here, and under review, are these differences in level, reach or
  wording:
  - "A node SHOULD also publish" where Core §2 says "Recommended fields".
  - "any specific vendor" where Core §1 names one vendor, and "cross-channel
    comparisons" where Core §7 says "OTA comparisons": both wider.
  - A MAY for recording hashes of signed artifacts in a public log, where
    Core §3.1 states a MAY for key-rotation events only.
  - A verifier that "cannot confirm that the URL host is" the node's, where
    Core §5.1 says "cannot confirm that it is a node URL" (which also covers
    userinfo and port): narrower.
  - "A node SHOULD omit it" without Core §5.2's "and rely on
    `direct_booking_url`"; the example list in Section 6.5 without
    "frontmatter"; the description of the attested class in other words
    than Core §5.4.
  - "the document is advisory metadata only" without the keyword that
    Well-Known §3 gives it ("MUST treat the document as advisory metadata
    only"); "rate-limited per domain" where Core §14 says "rate-limit or
    coalesce".
- **The `<date>` is 2026-11-15, the planned submission day.** Check it on the
  day of submission: if that day is another one, set the `<date>` to it,
  re-render the `.txt` and run the three tools again (xml2rfc warns when the
  date is more than 3 days from the day it runs).

## Submission (manual, by the author)

The submission tool is closed around IETF meetings. Read on
<https://datatracker.ietf.org/submit/> on 2026-11-12: "The I-D submission
tool will be reopened after 2026-11-14 23:59 PST (IETF-meeting local time)",
which is 2026-11-15 07:59 UTC.

1. Before submitting, read the Note Well and BCP 78, as the tool's
   instructions ask (<https://datatracker.ietf.org/submit/tool-instructions/>),
   and check the `<date>` (above).
2. Go to <https://datatracker.ietf.org/submit/> and upload the `.xml` (the
   tool's instructions: "A single v3 .xml source file is preferred").
3. Confirm the author email when the datatracker asks
   (hello@vacationrentalprotocol.com).
4. The draft publishes at a permanent datatracker URL within minutes.

## Discipline (do not relax)

- An Internet-Draft is **"work in progress"** — never describe it as an
  "IETF standard" or "IETF-approved". Press-safe phrasing: *"an IETF
  Internet-Draft has been submitted — work in progress."* Same precision
  rule as tamper-evident vs immutable.
- Drafts **expire after six months** from the `<date>` in the XML. `-00`
  has not been submitted (datatracker 404 on 2026-11-04 and again on
  2026-11-13); it keeps the
  `-00` name until it is. Submit `-01` before a submitted `-00` expires
  (bump `docName` + `seriesInfo`
  value and the `date` element, then re-render and re-validate).
- Empirical findings (three-state failure data, iCal taxonomy, gap
  analysis) intentionally stay **out** of the I-D — spec text only. They
  belong in a separate research paper.
- The `vacation-rental.json` well-known URI suffix is registered in the IANA
  Well-Known URIs registry (provisional, 2026-08-19; read in the registry on
  2026-11-13, reference `https://vacationrentalprotocol.com/spec/well-known-uri-v0.1`).
  The IANA Considerations section describes that entry and requests no
  action; it no longer says "IANA is requested to register", so nothing is
  left for `-01` on that point. The registration request:
  [protocol-registries/well-known-uris#93](https://github.com/protocol-registries/well-known-uris/issues/93)
  (closed as completed 2026-08-20).
