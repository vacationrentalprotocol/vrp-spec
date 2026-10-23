# Maintainers

This file lists the maintainers who steward the Vacation Rental Protocol (VRP)
specification, its schemas and conformance vectors, and its releases. The roles,
decision process, and how maintainers are added or removed are defined in
[GOVERNANCE.md](GOVERNANCE.md). Maintainers are stewards of a neutral standard,
not a trust authority or gatekeeper — see
[docs/adr/0002-no-gatekeeper-trust-and-interop.md](docs/adr/0002-no-gatekeeper-trust-and-interop.md).

| GitHub | Name | Role |
|--------|------|------|
| [@HemmaBo-se](https://github.com/HemmaBo-se) | Rouiada Abbas | Lead maintainer · specification editor · security contact |
| [@hayatabbasjr](https://github.com/hayatabbasjr) | — | Maintainer · project continuity |
| [@viljemd-hub](https://github.com/viljemd-hub) | Viljem Dvojmoč | Maintainer · independent implementer |

The maintainer set is expected to grow; new maintainers are added by consensus
per GOVERNANCE.md §8.

## Disclosure

In the interest of transparency, and consistent with the no-gatekeeper model:
Rouiada Abbas authored the VRP specification and also operates the VRP reference
implementation (HemmaBo) and the reference node `villaakerlyckan.se`. This
affiliation is disclosed openly precisely because VRP must never depend on it —
per ADR 0002, verification resolves to each host's own domain, and neither
HemmaBo nor any other implementation is a gatekeeper for the standard.

[@hayatabbasjr](https://github.com/hayatabbasjr), the maintainer for project
continuity, is Rouiada Abbas's daughter, so the first two maintainers listed
above are not independent of each other.

[@viljemd-hub](https://github.com/viljemd-hub) (Viljem Dvojmoč) builds CM Free,
a self-hosted channel manager, and operates the independent signing node
`apartmamatevz.si` listed in [IMPLEMENTATIONS.md](IMPLEMENTATIONS.md). He has no
affiliation with HemmaBo or with the other maintainers. He was added on
2026-10-23 by consensus of the two maintainers above (GOVERNANCE.md §8), after
his node became the second independent signing node that §5 names as the
condition for 1.0. From this date a substantive change needs approval from two
maintainers (§4).

## Contact

- **Security / vulnerabilities:** follow [SECURITY.md](SECURITY.md). Do not open
  a public issue.
- **Conduct concerns:** see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- **Everything else:** open an issue or pull request.
