import crypto from "node:crypto";

export function verifyOffer(vector) {
    const { input, jwks, clock } = vector;

    const { offer, signature } = input;

    // 1. Find the signing key by kid
    const key = jwks.keys.find(
        (key) => key.kid === signature.kid
    );

    if (!key) {
        return {
            verified: false,
            reason: "kid_not_in_jwks",
            fresh: null,
        };
    }

    // 2. Check that the signature uses EdDSA / Ed25519
    if (
        signature.alg !== "EdDSA" ||
        key.alg !== "EdDSA" ||
        key.crv !== "Ed25519"
    ) {
        return {
            verified: false,
            reason: "wrong_key",
            fresh: false,
        };
    }

    // 3. Split compact JWS
    const parts = signature.jws.split(".");

    if (parts.length !== 3) {
        return {
            verified: false,
            reason: "invalid_signature",
            fresh: false,
        };
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // 4. Decode the payload
    const payload = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString("utf8")
    );

    // 5. Make sure the signed payload matches the offer
    if (JSON.stringify(payload) !== JSON.stringify(offer)) {
        return {
            verified: false,
            reason: "payload_mismatch",
            fresh: false,
        };
    }

    // 6. Decode the public Ed25519 key
    const publicKey = crypto.createPublicKey({
        key: Buffer.concat([
            Buffer.from("302a300506032b6570032100", "hex"),
            Buffer.from(key.x, "base64url"),
        ]),
        format: "der",
        type: "spki",
    });

    // 7. Verify the JWS signature
    const signingInput = Buffer.from(
        `${encodedHeader}.${encodedPayload}`
    );

    const validSignature = crypto.verify(
        null,
        signingInput,
        publicKey,
        Buffer.from(encodedSignature, "base64url")
    );

    if (!validSignature) {
        return {
            verified: false,
            reason: "signature_mismatch",
            fresh: null,
        };
    }

    // 8. Check freshness
    const now = new Date(clock);
    const validUntil = new Date(offer.valid_until);

    const fresh = now < validUntil;

    if (!fresh) {
        return {
            verified: true,
            reason: null,
            fresh: false,
        };
    }

    // 9. The offer is valid and fresh
    return {
        verified: true,
        reason: null,
        fresh: true,
    };
}