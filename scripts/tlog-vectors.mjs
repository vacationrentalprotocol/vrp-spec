// Builds the transparency-log conformance vectors (spec/transparency-log-v0.1.md
// §11) as plain objects. generate-conformance-vectors.mjs writes them; every
// value is deterministic (derived keys, fixed timestamps), so `git diff` stays
// empty unless an input changed.
//
// The test log holds four leaves. Leaf 0 is the committed signed offer vector,
// so an implementation can tie the log vectors to an artifact it already
// verifies. Leaves 1–3 stand in for other artifacts: their artifact_hash is
// SHA-256 over a documented placeholder string (the Merkle math only sees the
// hash string, never the artifact).

import { createHash } from "node:crypto";
import {
  artifactHash,
  consistencyProof,
  entryBytes,
  inclusionProof,
  merkleTreeHash,
} from "../lib/vrp-tlog.mjs";
import {
  ATTESTATION_KID,
  attestationDidWebDocument,
  attestationPrivateKey,
  CANONICAL_DOMAIN,
  LOG_ID,
  LOG_UNPUBLISHED_KID,
  logDidWebDocument,
  logUnpublishedPrivateKey,
  signTreeHead,
  signedOfferEnvelope,
} from "./conformance.mjs";

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const placeholderHash = (n) =>
  `sha256:${createHash("sha256").update(`VRP transparency-log conformance placeholder leaf ${n}`).digest("hex")}`;

export function buildTlogVectors() {
  const offerJws = signedOfferEnvelope().signature.jws;
  const leaves = [artifactHash(offerJws), placeholderHash(1), placeholderHash(2), placeholderHash(3)];
  const entries = leaves.map(entryBytes);
  const didDocument = logDidWebDocument();

  const sthAt = (size, timestamp) => ({
    kind: "vrp_tlog_sth",
    log_id: LOG_ID,
    tree_size: size,
    root_hash: b64url(merkleTreeHash(entries.slice(0, size))),
    timestamp,
  });
  const sth2 = sthAt(2, "2026-10-16T00:00:02Z");
  const sth4 = sthAt(4, "2026-10-16T00:00:04Z");
  const signed2 = signTreeHead(sth2);
  const signed4 = signTreeHead(sth4);
  const inclusion0 = { leaf_index: 0, tree_size: 4, audit_path: inclusionProof(0, entries).map(b64url) };

  const base = (name, description, overrides) => ({
    name,
    description,
    spec: "spec/transparency-log-v0.1.md",
    log_operator_did_document: didDocument,
    issuer_domain: CANONICAL_DOMAIN,
    artifact_jws: offerJws,
    proof: { ...signed4, inclusion: inclusion0 },
    ...overrides,
  });
  const expect = (anchored, reason, extra = {}) => ({
    anchored,
    reason,
    artifact_hash: leaves[0],
    log_id: LOG_ID,
    ...extra,
  });

  // --- inclusion / anchoring vectors -------------------------------------
  const tamperedPath = inclusion0.audit_path.slice();
  tamperedPath[0] = b64url(createHash("sha256").update("tampered audit path element").digest());
  const mutatedJws = `${offerJws} `; // one trailing space: different bytes, different hash (§4.1)

  const inclusion = [
    base(
      "01-anchored",
      "Leaf 0 (the committed signed offer) with a correct audit path and a tree head signed by the published log key → anchored (§8 steps 1–3, §5.1).",
      { expected: expect(true, "anchored") },
    ),
    base(
      "02-sth-unsigned",
      "Same proof, but the tree head carries no signature → not anchored (§5: an STH MUST be signed by the log's Ed25519 key).",
      { proof: { signed_tree_head: sth4, inclusion: inclusion0 }, expected: expect(false, "sth_unsigned") },
    ),
    base(
      "03-sth-key-not-published",
      "Tree head signed with a kid the log operator's DID document does not publish → not anchored (§5.1: verify against the key published on the operator's own domain).",
      {
        proof: { ...signTreeHead(sth4, { key: logUnpublishedPrivateKey, kid: LOG_UNPUBLISHED_KID }), inclusion: inclusion0 },
        expected: expect(false, "sth_key_not_published"),
      },
    ),
    base(
      "04-sth-wrong-key",
      "Tree head signed with the published kid but a different private key → not anchored (§5.1).",
      {
        proof: { ...signTreeHead(sth4, { key: logUnpublishedPrivateKey }), inclusion: inclusion0 },
        expected: expect(false, "sth_signature_invalid"),
      },
    ),
    base(
      "05-inclusion-path-tampered",
      "Valid signed tree head, but one audit-path element altered → the root does not recompute → not anchored (§8 step 3, RFC 6962 §2.1.1).",
      {
        proof: { ...signed4, inclusion: { ...inclusion0, audit_path: tamperedPath } },
        expected: expect(false, "inclusion_proof_invalid"),
      },
    ),
    base(
      "06-sth-payload-mismatch",
      "A genuine operator signature over the tree head at size 2, presented with the size-4 tree head → the signed payload does not match → not anchored (§5, §8 step 2).",
      {
        proof: { signed_tree_head: sth4, signature: signed2.signature, inclusion: inclusion0 },
        expected: expect(false, "sth_payload_mismatch"),
      },
    ),
    base(
      "07-artifact-bytes-mutated",
      "The artifact string gained one trailing space in transport. Its hash is no longer the logged leaf, so the proof does not recompute → not anchored (§4.1: there is exactly one hashable form, the bytes as issued).",
      {
        artifact_jws: mutatedJws,
        expected: expect(false, "inclusion_proof_invalid", { artifact_hash: artifactHash(mutatedJws) }),
      },
    ),
    base(
      "08-log-operated-by-issuer",
      "A tree head whose log_id is the issuing node's own domain, signed with that node's key → not an independent anchor (§5.1: never a key published by a host node; §7.2: a node cannot make its own history provable).",
      {
        log_operator_did_document: attestationDidWebDocument(),
        proof: {
          ...signTreeHead({ ...sth4, log_id: `did:web:${CANONICAL_DOMAIN}` }, { key: attestationPrivateKey, kid: ATTESTATION_KID }),
          inclusion: inclusion0,
        },
        expected: expect(false, "log_operated_by_issuer", { log_id: `did:web:${CANONICAL_DOMAIN}` }),
      },
    ),
    base(
      "09-no-inclusion-proof",
      "No proof at all → not anchored, and NOT a verification failure: log inclusion MUST NOT be a precondition for verification (§3 principle 1; receipt-v1 §5).",
      { proof: null, expected: expect(false, "no_inclusion_proof", { log_id: null }) },
    ),
    base(
      "10-log-id-not-did-web",
      "A tree head whose log_id is not a did:web identifier → the operator key cannot be discovered on an operator domain → not anchored (§5, §5.1).",
      {
        proof: { ...signTreeHead({ ...sth4, log_id: "urn:vrp:log:1" }), inclusion: inclusion0 },
        expected: expect(false, "log_id_not_did_web", { log_id: "urn:vrp:log:1" }),
      },
    ),
  ];

  // --- consistency vectors ---------------------------------------------
  const consistencyBase = (name, description, overrides) => ({
    name,
    description,
    spec: "spec/transparency-log-v0.1.md",
    log_operator_did_document: didDocument,
    first: signed2,
    second: signed4,
    consistency: { first_size: 2, second_size: 4, proof: consistencyProof(2, entries).map(b64url) },
    ...overrides,
  });

  // A dishonest operator rewrites leaf 1 after publishing the size-2 tree head,
  // then signs the new size-4 head and serves a proof computed over the
  // rewritten tree. Detection, not prevention, is the guarantee (§8.1).
  const rewrittenEntries = entries.slice();
  rewrittenEntries[1] = entryBytes(placeholderHash("1-rewritten"));
  const rewrittenSth4 = {
    ...sth4,
    root_hash: b64url(merkleTreeHash(rewrittenEntries)),
    timestamp: "2026-10-16T00:00:05Z",
  };

  const consistency = [
    consistencyBase(
      "01-consistent",
      "Tree head at size 2 and at size 4 from the same append-only log, with the RFC 6962 consistency proof → consistent (§8; receipt-v1 §16 step 7).",
      { expected: { consistent: true, reason: "consistent" } },
    ),
    consistencyBase(
      "02-rewritten-history",
      "After publishing the size-2 tree head the operator replaced leaf 1, signed a new size-4 tree head and serves a proof over the rewritten tree → the proof does not connect the two heads → inconsistent; the rewrite is detected (§8.1).",
      {
        second: signTreeHead(rewrittenSth4),
        consistency: { first_size: 2, second_size: 4, proof: consistencyProof(2, rewrittenEntries).map(b64url) },
        expected: { consistent: false, reason: "consistency_proof_invalid" },
      },
    ),
    consistencyBase(
      "03-second-sth-unsigned",
      "The later tree head carries no operator signature → it proves nothing about append-only growth (§5).",
      {
        second: { signed_tree_head: sth4 },
        expected: { consistent: false, reason: "second_sth_unsigned" },
      },
    ),
  ];

  return {
    didDocument,
    signedSth: signed4,
    leaves,
    inclusion,
    consistency,
  };
}
