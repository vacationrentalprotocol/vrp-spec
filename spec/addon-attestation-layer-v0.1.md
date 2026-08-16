# VRP Addon Attestation Layer — Specification v0.1

**Status:** Public draft — **proposal for discussion** (tracks
[issue #63](https://github.com/vacationrentalprotocol/vrp-spec/issues/63)). Additive by
construction: `addon` rides the open layer vocabulary of
[Receipt Envelope v1 §3](./receipt-v1.md) ("a new trust layer = a new
`attestations[]` entry — no central approval is required"). Nothing in this
document changes what a receipt-v1 verifier MUST do today.

**Published:** 2026-08-01

**Repository:** https://github.com/vacationrentalprotocol/vrp-spec

**Builds on:** [Receipt Envelope v1](./receipt-v1.md) (layer vocabulary §3,
per-attestation freshness D2, signature input rule D5, key lifecycle §10),
[Core VRP v0.1](./v0.1.md) (signed offers, host JWKS),
[Booking Proof Chain v0.1](./proof-chain-v0.1.md) (supersession semantics).

## 1. Scope

This document defines the semantics of one attestation layer, **`addon`**,
for add-on services a host sells against an existing offer or stay:
late checkout, early check-in, stay extensions, and comparable extras.

The gap it closes: these sales already land in the payment rail and in the
booking record, but they are not part of the host-signed, independently
verifiable trust chain the way the `offer`, `transport`, and `payment`
layers are. An agent that can verify *"this stay costs X"* today cannot
verify *"and the 2-hour late checkout the guest bought belongs to that same
stay, priced by the same host key."*

## 2. Layer semantics

| Property | Rule |
| --- | --- |
| `layer` | Exactly `"addon"` |
| Cardinality | One attestation per sold add-on. Multiple add-ons on one stay = multiple `addon` entries in the flat `attestations[]` array (receipt-v1 §3) |
| `valid_from` / `valid_until` | MUST be present; evaluated per attestation (D2) |
| `signature` | Compact JWS over the addon artifact (D5), signed by a key published in the **same host-node JWKS** as the `offer` layer. Per-layer key separation is permitted (§10 K5) |
| `source` | SHOULD point at the host JWKS used for verification |
| `ref` | MUST carry the correlator of the base subject the add-on attaches to (offer id or booking correlator) |

The host is the merchant of record for the add-on; that is why the addon
artifact is signed by the host-node key lineage and not by any platform key.

## 3. Addon artifact (the signed payload)

| Field | Requirement | Description |
| --- | --- | --- |
| `addon_type` | MUST | Open vocabulary string: `late_checkout`, `early_checkin`, `extension`, … New types need no central approval |
| `description` | SHOULD | Short human-readable label, guest language |
| `quantity` | SHOULD | Number + `unit` (e.g. `{ "value": 2, "unit": "hours" }`, `{ "value": 1, "unit": "nights" }`) |
| `price` | MUST | `{ "amount": …, "currency": ISO-4217 }` — the amount representation MUST match the one used by the receipt's `payment` layer for the same stay |
| `payment_ref` | SHOULD | Correlator that reconciles this add-on with the `payment` layer entry (or PSP object) that charged it |
| `issued_at` | MUST | ISO 8601 date-time of sale |

## 4. Verification

- A v1 verifier that does not recognize `addon` MUST treat it like any other
  unknown layer: the JWS is verifiable, the semantics are opaque, and the
  presence of the entry MUST NOT fail the receipt.
- An addon-aware verifier verifies the JWS per D5, evaluates freshness per
  D2, and correlates `ref` against the receipt subject before presenting the
  add-on as belonging to the stay.

## 5. Relationship to stay extensions and the proof chain

An `extension` add-on attests the **sale**. The resulting change to the stay
window itself is a booking-level event and follows
[Booking Proof Chain v0.1](./proof-chain-v0.1.md) supersession semantics.
When a superseding booking artifact exists, the `addon` attestation SHOULD
reference the same booking correlator so the two chains reconcile. An addon
attestation is never mutated; corrections are expressed as new attestations,
consistent with the append-only spirit of the flat array.

## 6. Non-goals

- No new endpoint and no new runtime requirement for nodes or agents.
- No central registry of `addon_type` values (open vocabulary per §3).
- No pricing or policy semantics: how a host prices add-ons stays
  node-internal and is out of scope here.
- No change to refund mechanics; a refunded add-on is a payment-layer fact.

## 7. Worked example (non-normative)

```json
{
  "layer": "addon",
  "valid_from": "2026-08-01T10:00:00Z",
  "valid_until": "2026-08-02T10:00:00Z",
  "ref": "booking_9f2c…",
  "source": "https://example-host.example/.well-known/jwks.json",
  "signature": "eyJhbGciOiJFZERTQSIsImtpZCI6Im5vZGUtb2ZmZXItMSJ9…",
  "artifact": {
    "addon_type": "late_checkout",
    "description": "Late checkout until 14:00",
    "quantity": { "value": 3, "unit": "hours" },
    "price": { "amount": "350.00", "currency": "SEK" },
    "payment_ref": "pi_3Qx…",
    "issued_at": "2026-08-01T09:58:12Z"
  }
}
```

## 8. Open questions (for discussion in #63)

1. Amount representation: pin minor units, or inherit the node's declared
   convention from the base offer? (Draft above says: match the `payment`
   layer.)
2. Should receipt-v2 fold well-known `addon_type` values into a
   non-normative appendix for interop hints?
3. Refund expression: is a payment-layer fact enough, or does a
   `superseded_by`-style pointer between addon attestations earn its place?

## 9. Neutrality

The spec is vendor-neutral. HemmaBo is a reference implementer, not an
approval authority. Any node, on any stack, can sign and any party can
verify an addon attestation without permission from anyone.

## 10. License

Specification text: dedicated to the public domain under [CC0 1.0](../LICENSE).
