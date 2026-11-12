# IETF Internet-Draft sources

`draft-abbas-vrp-offer-verification-00` distills the VRP v0.1 specification
(core spec + well-known URI spec) into an IETF Internet-Draft: discovery
document, JWKS with rotation/revocation, the signed verified stay offer,
the verification procedure (safe-to-quote, fail-closed, three-state,
verifiability classes), and the formal IANA registration template for the
`vacation-rental.json` well-known URI suffix.

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
  renders clean; idnits was not run in that session. The `<date>` is
  2026-11-04 and is set to the submission day when the author submits.

## Submission (manual, by the author)

1. Go to <https://datatracker.ietf.org/submit/> and upload the `.xml`.
2. Confirm the author email when the datatracker asks
   (hello@vacationrentalprotocol.com).
3. The draft publishes at a permanent datatracker URL within minutes.

## Discipline (do not relax)

- An Internet-Draft is **"work in progress"** — never describe it as an
  "IETF standard" or "IETF-approved". Press-safe phrasing: *"an IETF
  Internet-Draft has been submitted — work in progress."* Same precision
  rule as tamper-evident vs immutable.
- Drafts **expire after six months** from the `<date>` in the XML. `-00`
  has not been submitted (datatracker 404 on 2026-11-04); it keeps the
  `-00` name until it is. Submit `-01` before a submitted `-00` expires
  (bump `docName` + `seriesInfo`
  value and the `date` element, then re-render and re-validate).
- Empirical findings (three-state failure data, iCal taxonomy, gap
  analysis) intentionally stay **out** of the I-D — spec text only. They
  belong in a separate research paper.
- The IANA Considerations section is the stable specification anchor for
  the registration: the `vacation-rental.json` well-known URI suffix is
  registered in the IANA Well-Known URIs registry (provisional, 2026-08-19).
  Registration history:
  [protocol-registries/well-known-uris#93](https://github.com/protocol-registries/well-known-uris/issues/93)
  (closed). `-01` should update the IANA Considerations wording from
  "IANA is requested to register" to reflect the existing registration.
