# Contributing

VRP is intended to be implementable by independent hosts, booking providers, and agent developers.

## Proposal Process

1. Open an issue describing the problem.
2. Include examples of host-domain discovery, signed offers, or agent behavior when possible.
3. For protocol changes, explain whether the change is backward-compatible with v0.1.
4. Keep HemmaBo-specific implementation details out of the protocol unless they are needed as reference examples.

## Design Principles

- Host-owned domains are the source of truth.
- Verification must be possible without trusting a marketplace mirror.
- Agents must fail closed.
- Pricing, availability, and booking URLs must be quoteable only when signed, fresh, exact, and permitted.

## Licensing

By contributing you agree that your contributions are licensed under the same
terms as the project: specification text under CC0-1.0 (see `LICENSE`) and
reference code under Apache-2.0 (see `LICENSE-CODE`), with the royalty-free
patent non-assertion in `PATENTS.md`. Inbound contributions equal outbound
licensing, and you affirm you have the right to contribute under these terms.

## Governance and conduct

Decisions follow `GOVERNANCE.md`. All participation is subject to
`CODE_OF_CONDUCT.md`. For security issues, follow `SECURITY.md` — do not open a
public issue.
