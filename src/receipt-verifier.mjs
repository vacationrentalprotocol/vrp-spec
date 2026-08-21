import crypto from "node:crypto";

function getKey(jwks, kid) {
    return jwks.keys.find((key) => key.kid === kid);
}

function verifyJws(jws, jwks) {
    const parts = jws.split(".");

    if (parts.length !== 3) {
        return {
            status: "invalid",
            error: "sig_invalid",
            kid: null,
        };
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    let header;

    try {
        header = JSON.parse(
            Buffer.from(encodedHeader, "base64url").toString("utf8")
        );
    } catch {
        return {
            status: "invalid",
            error: "sig_invalid",
            kid: null,
        };
    }

    const kid = header.kid;
    const key = getKey(jwks, kid);

    if (!key) {
        return {
            status: "invalid",
            error: "kid_not_in_jwks",
            kid: null,
        };
    }

    if (
        header.alg !== "EdDSA" ||
        key.alg !== "EdDSA" ||
        key.crv !== "Ed25519"
    ) {
        return {
            status: "invalid",
            error: "sig_invalid",
            kid: null,
        };
    }

    try {
        const publicKey = crypto.createPublicKey({
            key: Buffer.concat([
                Buffer.from("302a300506032b6570032100", "hex"),
                Buffer.from(key.x, "base64url"),
            ]),
            format: "der",
            type: "spki",
        });

        const valid = crypto.verify(
            null,
            Buffer.from(`${encodedHeader}.${encodedPayload}`),
            publicKey,
            Buffer.from(encodedSignature, "base64url")
        );

        if (!valid) {
            return {
                status: "invalid",
                error: "sig_invalid",
                kid: null,
            };
        }

        return {
            status: "verified",
            error: null,
            kid,
        };
    } catch {
        return {
            status: "invalid",
            error: "sig_invalid",
            kid: null,
        };
    }
}

export function verifyReceipt(vector) {
    const { receipt, jwks, now } = vector;

    // 1. Envelope validation
    if (receipt.vrp_receipt_version !== "1.0") {
        return {
            receipt_valid: false,
            fully_verified: false,
            errors: ["unsupported_version"],
            attestations: [],
        };
    }

    if (
        !Array.isArray(receipt.attestations) ||
        receipt.attestations.length === 0
    ) {
        return {
            receipt_valid: false,
            fully_verified: false,
            errors: ["malformed_receipt"],
            attestations: [],
        };
    }

    const results = [];

    for (let index = 0; index < receipt.attestations.length; index++) {
        const attestation = receipt.attestations[index];

        // Unsigned layers are valid receipt data,
        // but cannot be verified.
        if (!attestation.signature) {
            results.push({
                index,
                layer: attestation.layer,
                status: "unverifiable",
                error: "layer_unverifiable",
                kid: null,
            });

            continue;
        }

        const result = verifyJws(attestation.signature, jwks);

        if (result.status === "invalid") {
            results.push({
                index,
                layer: attestation.layer,
                status: "invalid",
                error: result.error,
                kid: result.kid,
            });

            continue;
        }

        const currentTime = new Date(now);
        const validFrom = new Date(attestation.valid_from);
        const validUntil = new Date(attestation.valid_until);

        if (currentTime >= validUntil) {
            results.push({
                index,
                layer: attestation.layer,
                status: "expired",
                error: "sig_expired",
                kid: result.kid,
            });

            continue;
        }

        if (currentTime < validFrom) {
            results.push({
                index,
                layer: attestation.layer,
                status: "invalid",
                error: "sig_invalid",
                kid: null,
            });

            continue;
        }

        results.push({
            index,
            layer: attestation.layer,
            status: "verified",
            error: null,
            kid: result.kid,
        });
    }

    const fullyVerified =
        results.length > 0 &&
        results.every((result) => result.status === "verified");

    return {
        receipt_valid: true,
        fully_verified: fullyVerified,
        errors: [],
        attestations: results,
    };
}