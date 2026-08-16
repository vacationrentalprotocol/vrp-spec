# Security Policy

The Vacation Rental Protocol (VRP) is an open protocol for host-domain-signed
vacation-rental offers. This repository holds the specification text, the JSON
schemas and JSON-LD contexts, the conformance test vectors, and the reference
verification scripts. This policy covers **the protocol and the artifacts in this
repository** — not any particular product, host, or deployment built on top of it.

VRP has **no central gatekeeper**: the host-owned domain is the source of truth,
and verification never depends on HemmaBo or any registry (see
[ADR 0002](./docs/adr/0002-no-gatekeeper-trust-and-interop.md)). A security issue
here is therefore a weakness in the *protocol's reasoning* or its *reference code*,
not a permission any authority can grant or revoke.

## Reporting a vulnerability

Please report privately — do **not** open a public issue for a suspected
vulnerability.

- **Preferred:** GitHub **[Report a vulnerability](https://github.com/HemmaBo-se/vrp-spec/security/advisories/new)**
  (Security → Advisories → Report a vulnerability). This opens a private advisory
  visible only to you and the maintainers.
- **Alternative:** email **info@hemmabo.se** with `VRP SECURITY` in the subject.

Please include, as far as you can:

- which artifact is affected (a spec section, a schema, a script, a conformance
  vector, or a protocol rule);
- a concrete way it fails — for example, a signed offer or JWKS that a *conforming*
  verifier would trust when it should not, or vice versa;
- steps to reproduce, ideally as a small vector we can add to
  [`examples/conformance/`](./examples/conformance/).

VRP is maintained by a small team, so we handle reports on a best-effort basis and
practice **coordinated disclosure**: we will confirm receipt, work with you on a
fix, and credit you if you wish. There is no paid bug-bounty program.

## Scope

**In scope** — the protocol and this repository:

- **Signing** — Ed25519 / compact JWS over verified stay offers ([spec §5](./spec/v0.1.md)).
- **JWKS** — key publication and discovery at `/.well-known/jwks.json`, and the
  rotation/revocation rules ([spec §3](./spec/v0.1.md)).
- **Discovery** — the `/.well-known/vacation-rental.json` document ([spec §2](./spec/v0.1.md)).
- **Signed verified stay offers** — envelope, payload, freshness (`valid_until`),
  the direct booking URL constraint, and the safe-to-quote / fail-closed rules
  ([spec §4–§9](./spec/v0.1.md)).
- **Reference code** — the verification scripts in [`scripts/`](./scripts/) and the
  conformance vectors in [`examples/conformance/`](./examples/conformance/).

Weaknesses in the spec's own security reasoning are in scope — for instance a way
to make a conforming agent quote a stale, unavailable, or unsigned offer as
official, or a rotation/revocation gap that lets a removed key still verify.

**Out of scope** — not the protocol:

- The **HemmaBo product** (the app, booking flows, dashboard, `hemmabo.com`) and
  any payment/Stripe behaviour. Report those to HemmaBo directly, not here.
- The **security of an individual host domain** — its DNS, TLS, hosting, and
  server configuration. The protocol's root of trust is domain control; if the
  domain itself is compromised, no key-level mechanism can help. Domain-level
  security is the operator's responsibility ([spec §3.1](./spec/v0.1.md)).
- Availability / denial-of-service against the static specification site.
- The content of third-party deployments, directories, crawlers, or agents that
  index or consume VRP nodes.

## Supported versions

VRP is a **public draft (v0.1)**. Security fixes are applied to the current draft
on `main`. Earlier drafts are not separately maintained.

## Dependency and supply-chain hygiene

VRP keeps its supply-chain surface deliberately small; there is no build step and
no published package to compromise:

- **Zero runtime dependencies.** `package.json` declares no `dependencies` or
  `devDependencies`, and there is **no lockfile**. The validation and verification
  scripts use only the Node.js standard library.
- **Not published.** The package is marked `private: true`; nothing is pushed to a
  registry.
- **Offline, deterministic checks.** `npm test` runs the full validation suite
  (schema validation, conformance-vector verification, three-state fixtures, route
  and license checks) entirely against local fixtures with **no network access**,
  and runs on every pull request in CI.
- **Least-privilege CI.** The GitHub Actions workflow pins actions to major
  versions and grants `permissions: contents: read`.
- **Signed artifacts.** All signatures in the spec and vectors are Ed25519 / EdDSA;
  keys are discovered only from the host domain's JWKS, never from a bundled trust
  store.

Because the dependency graph is effectively empty, a machine-readable SBOM would
list only Node.js itself; if a reviewer needs one in a specific format (e.g.
CycloneDX or SPDX) we will generate it on request.

## Security documentation

- [Threat model](./docs/security/THREAT_MODEL.md) — STRIDE-oriented, focused on
  Ed25519 signing, JWKS, host-domain-as-source-of-truth, and a compromised host key.
- [Key rotation](./docs/security/KEY_ROTATION.md) — what the spec requires for
  additive rotation, and the current verified live-node key posture.
- [Incident response](./docs/security/INCIDENT_RESPONSE.md) — handling a compromised
  host key or JWKS, host-domain-centred.
