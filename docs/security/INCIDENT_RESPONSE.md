# Incident Response — Compromised Host Key or JWKS

What to do when a VRP node's **private signing key leaks** (or its JWKS is suspected
to have served the wrong keys), while the host domain itself is still under the
operator's control. This is the case VRP's key controls are designed for.

Because VRP has **no central gatekeeper**, there is no incident authority to call:
the operator who controls the host domain both detects and resolves the incident by
editing what the domain serves. The steps below are host-domain-centred by design.

> If the **domain itself** is compromised (DNS, TLS, or hosting takeover), key
> rotation cannot help — the attacker controls the source of truth. That is a
> domain-security incident, out of scope for the protocol; regain control of the
> domain first, then rotate keys.

## The core fact

An attacker holding the leaked private key can mint **fresh, well-formed offers**
with a future `valid_until`. Offer freshness does **not** contain them. The only
thing that de-trusts them is **removing the key from the JWKS** — a key is valid
exactly while it is present there ([spec §3.1](../../spec/v0.1.md)).

Removing the key also invalidates the operator's *own* legitimate offers signed
with it. That is intentional and unavoidable: a verifier cannot tell the attacker's
signatures from the host's, because they share the same key.

## Steps: detection → rotation → revocation signal → communication

### 1. Detection

Treat as a possible key compromise any of:

- private-key material exposed (leaked secret, committed file, stolen backup, breach
  of the signing environment);
- offers verifying under your `kid` that your node did not issue;
- unexpected `key added` / `key removed` entries if you keep a
  [transparency log](../../spec/transparency-log-v0.1.md);
- a JWKS that served a key you did not publish.

When in doubt, treat it as a compromise and rotate — the cost of rotating is low.

### 2. Rotation (revoke the bad key, stand up a new one)

1. **Generate** a new Ed25519 key with a new `kid`.
2. **Remove the compromised key from the JWKS immediately** and publish the new
   key. Unlike routine rotation, there is **no overlap** for the compromised key —
   it goes now, even though this breaks offers legitimately signed with it.
3. **Re-sign** current legitimate stays with the new key so guests and agents can
   re-fetch valid offers.
4. **Keep the cache window tight.** Serve `jwks.json` with `Cache-Control:
   max-age=300` or less — the reference node already does. This is the
   **revocation latency**: a conforming verifier fully de-trusts the removed key
   within the cache window (≤ 5 minutes) of it leaving the JWKS
   ([spec §3.1](../../spec/v0.1.md)). Publishing the updated `jwks.json` is a normal
   deploy of the host domain's static well-known files; see
   [KEY_ROTATION.md](./KEY_ROTATION.md).

### 3. Revocation signal

The revocation signal in VRP is simply **the key's absence from the JWKS** — there
is no separate revocation list or endpoint to update. Strengthen and preserve that
signal:

- Confirm the compromised `kid` no longer appears at `/.well-known/jwks.json` from a
  fresh fetch (not a cached copy).
- If you keep a transparency log, record the `key removed` event (with `kid` and
  timestamp) so there is a tamper-evident record of when the key stopped being
  valid — useful for later disputes about whether a given offer was signed by a
  then-valid key.

### 4. Communication

- **Contact for this repository:** report protocol-level weaknesses per
  [SECURITY.md](../../SECURITY.md). A leak of one node's key is an operational
  incident for that host, not a protocol vulnerability — but if the incident reveals
  a *gap in the protocol* (a way a removed key could still verify), report that.
- **Notify affected parties** — guests with open bookings and any agents you know
  integrate with the node — that offers must be re-fetched, and that any offer
  bearing the old `kid` is no longer valid.
- **Do not** re-issue trust for the old key. Once removed, it stays removed; move
  forward on the new key only.

## What VRP can and cannot promise

- **Can:** bound how long a removed key is still accepted (the 5-minute cache cap)
  and make every offer signed with a removed key unverifiable to conforming
  verifiers.
- **Cannot:** force a *non-conforming* verifier to stop caching a revoked key, nor
  protect against compromise of the domain itself. Treat the cache bound as a
  conformance requirement, not a guarantee the protocol can enforce
  ([spec §3.1](../../spec/v0.1.md)).

## Related

- [Key rotation](./KEY_ROTATION.md) — routine (non-compromise) rotation and the
  additive overlap the spec requires.
- [Threat model](./THREAT_MODEL.md) — the compromised-key scenario in context.
- [Spec §3.1 — Key Rotation and Revocation](../../spec/v0.1.md) — the normative rules.
