# Key Rotation

How a VRP node changes its Ed25519 signing key without breaking verification.
[Spec §3.1](../../spec/v0.1.md) is normative; this document restates the
requirement plainly and records the current, verified behaviour of the reference
node.

## The one rule everything follows

A node's signing authority is the set of keys published at its
`/.well-known/jwks.json`. Because there is no central issuer, **the JWKS is the
only revocation authority**: a key is valid exactly while it appears in the JWKS,
and not one moment longer. Rotation and revocation are both just *edits to that
published set*.

## What the spec requires (§3.1)

Rotation is **additive** — you add the new key before you remove the old one, so
there is always a window in which both verify:

1. **Generate** a new Ed25519 key with a fresh `kid`. A `kid` that encodes a date
   and sequence (e.g. `example.com-2026-05-18-01`) helps operators order keys — but
   a verifier treats `kid` as opaque and infers nothing (trust, recency, status)
   from it.
2. **Publish** the new key **alongside** the old one in the JWKS.
3. **Switch signing** to the new key: new offers are signed with the new `kid`.
4. **Keep the old key** in the JWKS until **every offer signed with it has passed
   its `valid_until`**. The retention window therefore equals the maximum offer
   lifetime — while it lasts, offers already issued under the old key still verify.
5. **Remove** the old key from the JWKS.

Because the old key is retained until its last offer has expired, no live offer
breaks.

### Two independent numbers — do not conflate

The spec is explicit that these are separate controls ([§3.1](../../spec/v0.1.md)):

- **Retention window (rotation).** Keep the old key until the offers it signed have
  passed `valid_until`. This is set by *offer lifetime*, not by a fixed clock.
- **JWKS cache cap = 5 minutes (revocation latency).** A conforming verifier MUST
  NOT cache a JWKS for longer than 5 minutes. This bounds how long a *removed* key
  is still accepted, so a node SHOULD serve `jwks.json` with `Cache-Control:
  max-age=300` (5 minutes) or less. The node may only *shorten* this window, never
  lengthen it. **This 5-minute figure is the verifier cache limit — it is not a
  rotation overlap.**
- **Refresh on miss.** An offer bearing a `kid` the verifier does not hold forces an
  immediate JWKS re-fetch, so a newly published key is picked up on first use.

## Verified live behaviour (reference node)

Fetched directly from the reference node
(`https://villaakerlyckan.se/.well-known/jwks.json`), the current state is a normal
steady state — **one active key, no rotation in progress**:

- The JWKS serves a **single** Ed25519 key, `kid: villaakerlyckan.se-2026-05-18-01`
  (`kty: OKP`, `crv: Ed25519`, `alg: EdDSA`, `use: sig`).
- It is served with **`Cache-Control: public, max-age=300`** — the recommended
  ≤ 5-minute cache window.

A single key is the expected steady state; a second key appears in the JWKS only
*transiently during a rotation*, for exactly as long as the old key's outstanding
offers remain fresh (step 4 above). This document does **not** assert any fixed
overlap schedule — the overlap lasts as long as the offer-lifetime rule requires.

| Phase | JWKS contains | Signing with | A verifier can trust offers signed by |
| --- | --- | --- | --- |
| steady state (now) | one key | that key | that key |
| rotation start | old **+ new** | new | old **and** new |
| overlap (until old key's last offer passes `valid_until`) | old + new | new | old and new |
| after retire | new | new | new only |

After the old key is removed, any offer still bearing its `kid` becomes **Unknown**
and MUST NOT be quoted — the agent should fetch a fresh offer
([spec §6, §9](../../spec/v0.1.md)).

## What an implementer must do

- **Publish before you sign.** Add the new key to the JWKS *before* signing any
  offer with it (an unknown `kid` also triggers an immediate JWKS refresh).
- **Serve a short `Cache-Control`.** Use `max-age=300` (5 minutes) or less on
  `jwks.json`; never longer. The reference node already does this.
- **Retain the old key through the overlap.** Keep it until the last offer it signed
  has passed `valid_until`, so no still-fresh offer is stranded.
- **Never reuse a `kid`.** Give every key a distinct, stable identifier.
- **Optionally log the event.** A node MAY record `key added` / `key removed` (with
  `kid` and timestamp) in its
  [transparency log](../../spec/transparency-log-v0.1.md) for a tamper-evident
  history of which key was valid when.

## Rotation is not revocation

Routine rotation retires the old key by *timing* — you remove it only after its
offers have expired, so nothing breaks. **Compromise** is different: the old key
must be removed **immediately**, even though that also invalidates the operator's
own legitimate offers signed with it. See
[INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md).
