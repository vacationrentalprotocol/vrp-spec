# VRP Schemas

This directory contains machine-readable schemas for VRP draft artifacts.

Core VRP v0.1 schemas:

```text
https://vacationrentalprotocol.com/schemas/discovery-v0.1.schema.json
https://vacationrentalprotocol.com/schemas/jwks-v0.1.schema.json
https://vacationrentalprotocol.com/schemas/verified-stay-offer-v0.1.schema.json
https://vacationrentalprotocol.com/schemas/verified-stay-offer-verification-result-v0.1.schema.json
```

Repository copies:

- [`discovery-v0.1.schema.json`](./discovery-v0.1.schema.json)
- [`jwks-v0.1.schema.json`](./jwks-v0.1.schema.json)
- [`verified-stay-offer-v0.1.schema.json`](./verified-stay-offer-v0.1.schema.json)
- [`verified-stay-offer-verification-result-v0.1.schema.json`](./verified-stay-offer-verification-result-v0.1.schema.json)

Portable Attestations v0.1 schema:

```text
https://vacationrentalprotocol.com/schemas/attestations-v0.1.schema.json
```

Repository copy: [`attestations-v0.1.schema.json`](./attestations-v0.1.schema.json)

VRP Receipt v1 schema (ADR 0010 — the receipt envelope that wraps offer + transport attestations):

```text
https://vacationrentalprotocol.com/schemas/vrp-receipt.v1.schema.json
```

Repository copy: [`vrp-receipt.v1.schema.json`](./vrp-receipt.v1.schema.json)

> **Drift contract.** `vrp-receipt.v1.schema.json` in this repository is the authoritative receipt schema; the receipt conformance vectors validate against it, and any implementation's copy MUST match it. It was first authored alongside the reference implementation; the standard's copy now governs.

Conformance report v0.1 schema (score-free record of one verifier run against one corpus; see [`docs/conformance-report.md`](../docs/conformance-report.md)):

```text
https://vacationrentalprotocol.com/schemas/conformance-report-v0.1.schema.json
```

Repository copy: [`conformance-report-v0.1.schema.json`](./conformance-report-v0.1.schema.json)

These schemas are interoperability aids for implementers and examples. They are not a registry, issuer service, certification service, scoring service, OTA, marketplace, or booking intermediary.
