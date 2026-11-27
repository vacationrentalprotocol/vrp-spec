# Implement VRP

A host or provider can implement VRP without becoming a marketplace. The host-owned domain remains the source of truth.

## Minimum Implementation

1. Publish `/.well-known/vacation-rental.json`.
2. Publish `/.well-known/jwks.json` with an Ed25519 public key.
3. Expose a verified stay offer endpoint.
4. Sign verified stay offer payloads with the matching host-domain private key.
   Keep that key out of the web root, in a path the web server never serves
   (an environment variable, a secrets manager, or a file readable only by
   the signing process). Confirm it by requesting the key's path over HTTPS:
   the answer must be 403 or 404. See
   [docs/security/KEY_ROTATION.md](security/KEY_ROTATION.md).
5. Include availability, exact price, currency, `valid_until`, direct booking URL, and agent citation permission.
6. Return explicit signed false values when a request is unavailable.
7. Fail closed when any verification requirement cannot be satisfied.

## Publish and Sign Only What You Know

A node signs statements, and an agent may cite them as the host's own. The one
who produces the data therefore follows the same rule that Core §9 gives the
one who reads it: a missing answer is not a no.

1. **Say yes and no only from a fact.** Publish or sign `true`, `false`,
   "allowed" or "not allowed" only where the host has said so or the system
   holds the value. A question the host has not answered is not a no. Do not
   let a default in a form or a database stand in for the answer: an empty
   field that turns into "no pets" is a statement the host never made, and
   once it is signed an agent may repeat it as the host's.
2. **An optional value that is missing: leave it out, or write `null` where
   the schema allows it.** In the offer schema `rules` and `terms` are
   optional, every member of `rules` may be `null` (`pets`, `check_in_time`
   and the others), and `terms.policy_claims` lists what is affirmed and what
   is negated; what is in neither list is unknown.
3. **A required value that is missing: do not make one up so that the offer
   validates.** Use what the schema gives for the case. A stay that cannot be
   booked is `availability.available: false`. A total that is not exact is
   `price.exact: false`, with `null` for the amounts you do not have; see
   [the not-quoteable example](../examples/verified-stay-offer.not-quoteable.v0.1.json).
   Where the node cannot state the offer at all, it answers with an error, as
   Core §5 says for dates that are not a stay. An invented value in a required
   field puts a valid signature on something that is not true.

An agent that meets `null`, an absent member or an error treats the value as
unknown (Core §9) and may say that it could not be verified. That is the
correct outcome: it keeps the host's yes and the host's no worth citing.

This is guidance for the one who produces the data. The rule for the one who
reads it is normative: Core §8 and §9.

## Readable in a Browser

A verifier can run in a web page, as the one at
[vacationrentalprotocol.com/verify](https://vacationrentalprotocol.com/verify)
does. A browser lets a page on another domain read a response only when the
response carries the header `Access-Control-Allow-Origin`. Send it on all three
responses:

- `/.well-known/vacation-rental.json`
- `/.well-known/jwks.json`
- the verified stay offer endpoint

```text
Access-Control-Allow-Origin: *
```

The three responses are public and are read without credentials, so `*` fits.
Set the header where each endpoint is served, not for one directory: a rule
scoped to `/.well-known/` leaves an offer endpoint at another path without it.
The verifier in the browser then reads the discovery document and the keys and
is stopped at the offer, although the signature is valid.

To check, open `https://vacationrentalprotocol.com/verify?host=<your-domain>`
and press "Fetch & verify", or read the response headers of each of the three
URLs.

This is guidance. The Core specification does not require the header, and a
verifier that does not run in a browser does not need it.

## Discovery Checklist

Your discovery document should include:

- `protocol`
- `protocol_version`
- `canonical_domain`
- `node_id`
- `jwks_url`
- `verified_stay_offer_endpoint`
- `capabilities`

## Offer Checklist

Your signed offer should include:

- stay request
- property identity
- availability status
- price object with currency and exactness
- direct booking URL
- validity window
- agent permission
- compact JWS signature

## Interoperability

VRP implementers should keep field names stable and machine-readable. Agents should be able to verify the offer without relying on page text, screenshots, cached listing data, or marketplace mirrors.

If a value cannot be verified, agents must treat it as unknown. A missing endpoint, failed fetch, invalid JSON response, failed signature, or stale `valid_until` must never be interpreted as a confirmed negative or a confirmed positive.
