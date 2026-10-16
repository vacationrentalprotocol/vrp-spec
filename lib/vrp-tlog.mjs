/**
 * VRP Transparency Log v0.1 — reference verification (inclusion, consistency,
 * signed tree heads). Apache-2.0 — see LICENSE-CODE.
 *
 * Spec: spec/transparency-log-v0.1.md §4 (data model, leaf hashing rule §4.1),
 * §5 (log identity and keys, operator key discovery §5.1), §8 (verification).
 * Merkle semantics are RFC 6962 (leaf = SHA-256(0x00 || entry), inner node =
 * SHA-256(0x01 || left || right), audit path per §2.1.1, consistency per §2.1.2).
 *
 * Entry encoding: the Merkle entry for a leaf is the UTF-8 bytes of its
 * `artifact_hash` string (`sha256:{hex}`), which is what the reference log
 * hashes. The specification defines `artifact_hash` (§4.1) but does not yet
 * state the Merkle entry encoding in normative text; these vectors pin the
 * reference encoding until the spec does. Zero dependencies: Node stdlib only.
 */
import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";
import { verifyCompactJws } from "./vrp-jws.mjs";

const LEAF_PREFIX = Buffer.from([0x00]);
const NODE_PREFIX = Buffer.from([0x01]);

function sha256(...parts) {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest();
}

function b64urlDecode(value) {
  const s = String(value || "");
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

/** `sha256:{hex}` over the exact compact JWS string as issued (§4.1). */
export function artifactHash(compactJws) {
  return `sha256:${createHash("sha256").update(Buffer.from(String(compactJws), "utf8")).digest("hex")}`;
}

/** Merkle entry bytes for a leaf: the UTF-8 bytes of its artifact_hash string. */
export function entryBytes(artifactHashString) {
  return Buffer.from(String(artifactHashString), "utf8");
}

export function hashLeaf(entry) {
  return sha256(LEAF_PREFIX, entry);
}

export function hashChildren(left, right) {
  return sha256(NODE_PREFIX, left, right);
}

function largestPowerOfTwoLessThan(n) {
  let k = 1;
  while (k << 1 < n) k <<= 1;
  return k;
}

/** RFC 6962 Merkle Tree Hash over ordered entries. MTH({}) = SHA-256(""). */
export function merkleTreeHash(entries) {
  const n = entries.length;
  if (n === 0) return sha256(Buffer.alloc(0));
  if (n === 1) return hashLeaf(entries[0]);
  const k = largestPowerOfTwoLessThan(n);
  return hashChildren(merkleTreeHash(entries.slice(0, k)), merkleTreeHash(entries.slice(k)));
}

/** RFC 6962 audit path PATH(m, D[n]) for the entry at index m, bottom-up. */
export function inclusionProof(m, entries) {
  const n = entries.length;
  if (m < 0 || m >= n) throw new Error("inclusionProof: index out of range");
  if (n === 1) return [];
  const k = largestPowerOfTwoLessThan(n);
  if (m < k) return [...inclusionProof(m, entries.slice(0, k)), merkleTreeHash(entries.slice(k))];
  return [...inclusionProof(m - k, entries.slice(k)), merkleTreeHash(entries.slice(0, k))];
}

/** RFC 6962 §2.1.1: recompute the root from leaf hash, index, size and path. */
export function verifyInclusion(leafHash, leafIndex, treeSize, proof, root) {
  if (!Number.isInteger(leafIndex) || !Number.isInteger(treeSize)) return false;
  if (leafIndex < 0 || leafIndex >= treeSize) return false;
  let fn = leafIndex;
  let sn = treeSize - 1;
  let r = leafHash;
  for (const p of proof) {
    if (sn === 0) return false;
    if ((fn & 1) === 1 || fn === sn) {
      r = hashChildren(p, r);
      if ((fn & 1) === 0) {
        do {
          fn >>= 1;
          sn >>= 1;
        } while ((fn & 1) === 0 && fn !== 0);
      }
    } else {
      r = hashChildren(r, p);
    }
    fn >>= 1;
    sn >>= 1;
  }
  return sn === 0 && r.equals(root);
}

/** RFC 6962 consistency proof PROOF(m, D[n]) for 0 < m < n. */
export function consistencyProof(m, entries) {
  const n = entries.length;
  if (m <= 0 || m >= n) throw new Error("consistencyProof: require 0 < m < n");
  return subproof(m, entries, true);
}

function subproof(m, entries, b) {
  const n = entries.length;
  if (m === n) return b ? [] : [merkleTreeHash(entries)];
  const k = largestPowerOfTwoLessThan(n);
  if (m <= k) return [...subproof(m, entries.slice(0, k), b), merkleTreeHash(entries.slice(k))];
  return [...subproof(m - k, entries.slice(k), false), merkleTreeHash(entries.slice(0, k))];
}

/** RFC 6962 §2.1.2: the tree of size n is a consistent append of the tree of size m. */
export function verifyConsistency(m, n, firstRoot, secondRoot, proof) {
  if (!Number.isInteger(m) || !Number.isInteger(n) || m <= 0 || m >= n) return false;
  let path = proof;
  if ((m & (m - 1)) === 0) path = [firstRoot, ...path];
  if (path.length === 0) return false;
  let fn = m - 1;
  let sn = n - 1;
  while ((fn & 1) === 1) {
    fn >>= 1;
    sn >>= 1;
  }
  let fr = path[0];
  let sr = path[0];
  for (let i = 1; i < path.length; i++) {
    const c = path[i];
    if (sn === 0) return false;
    if ((fn & 1) === 1 || fn === sn) {
      fr = hashChildren(c, fr);
      sr = hashChildren(c, sr);
      if ((fn & 1) === 0) {
        do {
          fn >>= 1;
          sn >>= 1;
        } while ((fn & 1) === 0 && fn !== 0);
      }
    } else {
      sr = hashChildren(sr, c);
    }
    fn >>= 1;
    sn >>= 1;
  }
  return sn === 0 && fr.equals(firstRoot) && sr.equals(secondRoot);
}

/** Host part of a `did:web:` identifier (lower-cased, percent-decoded), or "". */
export function didWebHost(did) {
  const m = /^did:web:([^:#?]+)/.exec(String(did || "").trim());
  return m ? decodeURIComponent(m[1]).toLowerCase() : "";
}

/** The Ed25519 keys a DID document publishes, as a JWKS (§5.1 key discovery). */
export function jwksFromDidDocument(didDocument) {
  const methods = Array.isArray(didDocument?.verificationMethod) ? didDocument.verificationMethod : [];
  const keys = [];
  for (const vm of methods) {
    const jwk = vm?.publicKeyJwk;
    if (!jwk || jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || typeof jwk.x !== "string") continue;
    const id = typeof vm.id === "string" ? vm.id : "";
    const kid = jwk.kid || (id.includes("#") ? id.slice(id.indexOf("#") + 1) : undefined);
    keys.push({ kty: "OKP", crv: "Ed25519", x: jwk.x, kid });
  }
  return { keys };
}

/** The issuing node must not be its own anchor (§5.1): same domain, or one inside the other. */
export function sameOperator(logHost, issuerDomain) {
  const a = String(logHost || "").replace(/^www\./, "");
  const b = String(issuerDomain || "").replace(/^www\./, "");
  if (!a || !b) return false;
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

const STH_FIELDS = ["log_id", "tree_size", "root_hash", "timestamp"];

/**
 * Verify a signed tree head against the log operator's published keys (§5, §5.1).
 * `signed` is `{ signed_tree_head, signature: { jws } }` as a log serves it.
 * Returns `{ valid, reason, payload }` with reason one of
 * `sth_valid`, `sth_unsigned`, `sth_key_not_published`, `sth_signature_invalid`,
 * `sth_payload_mismatch`.
 */
export function verifySignedTreeHead(signed, logOperatorDidDocument) {
  const sth = signed?.signed_tree_head;
  const jws = signed?.signature?.jws;
  if (!sth || typeof sth !== "object") return { valid: false, reason: "sth_unsigned", payload: null };
  if (typeof jws !== "string" || !jws) return { valid: false, reason: "sth_unsigned", payload: null };
  let payload;
  try {
    ({ payload } = verifyCompactJws(jws, jwksFromDidDocument(logOperatorDidDocument)));
  } catch (err) {
    const reason = /No matching Ed25519 key/.test(String(err?.message)) ? "sth_key_not_published" : "sth_signature_invalid";
    return { valid: false, reason, payload: null };
  }
  for (const f of STH_FIELDS) {
    if (payload[f] !== sth[f]) return { valid: false, reason: "sth_payload_mismatch", payload };
  }
  return { valid: true, reason: "sth_valid", payload };
}

/**
 * Decide whether an artifact is anchored in a log (receipt-v1 §16 steps 3–6,
 * transparency-log §8). `vector` carries:
 *   artifact_jws | artifact_hash   — the artifact (hash computed over exact bytes, §4.1)
 *   proof                           — `{ signed_tree_head, signature, inclusion }` or null
 *   log_operator_did_document       — the operator's DID document (§5.1)
 *   issuer_domain (optional)        — the issuing node's domain, for the §5.1 self-anchor rule
 * Returns `{ anchored, reason, artifact_hash, log_id }`. "anchored" requires all of:
 * an inclusion proof that recomputes to the tree head, a tree head signed by the
 * operator named in its own log_id, and that operator not being the issuer.
 * A missing proof is `no_inclusion_proof`, which is signature-only verification,
 * never a failure (§3 principle 1).
 */
export function verifyAnchoring(vector) {
  const hash = vector.artifact_hash ?? (vector.artifact_jws != null ? artifactHash(vector.artifact_jws) : null);
  const proof = vector.proof;
  const result = (anchored, reason, logId) => ({ anchored, reason, artifact_hash: hash, log_id: logId ?? null });
  if (!hash) return result(false, "no_artifact", null);
  if (!proof || !proof.inclusion || !proof.signed_tree_head) return result(false, "no_inclusion_proof", null);

  const sth = proof.signed_tree_head;
  const logId = typeof sth.log_id === "string" ? sth.log_id : "";
  const inclusionOk = verifyInclusion(
    hashLeaf(entryBytes(hash)),
    proof.inclusion.leaf_index,
    proof.inclusion.tree_size,
    (Array.isArray(proof.inclusion.audit_path) ? proof.inclusion.audit_path : []).map(b64urlDecode),
    b64urlDecode(sth.root_hash),
  );

  if (!(proof.signature && typeof proof.signature.jws === "string")) return result(false, "sth_unsigned", logId);
  if (!/^did:web:/.test(logId)) return result(false, "log_id_not_did_web", logId);
  if (sameOperator(didWebHost(logId), vector.issuer_domain)) return result(false, "log_operated_by_issuer", logId);

  const sthCheck = verifySignedTreeHead({ signed_tree_head: sth, signature: proof.signature }, vector.log_operator_did_document);
  if (!sthCheck.valid) return result(false, sthCheck.reason, logId);
  if (sthCheck.payload.log_id !== logId) return result(false, "sth_payload_mismatch", logId);
  if (!inclusionOk) return result(false, "inclusion_proof_invalid", logId);
  return result(true, "anchored", logId);
}

/**
 * Verify that the tree described by `second` is a consistent append of the tree
 * described by `first` (§8, receipt-v1 §16 step 7). `vector` carries
 * `first`, `second` (each `{ signed_tree_head, signature }`), `consistency`
 * (`{ first_size, second_size, proof }`) and `log_operator_did_document`.
 * Returns `{ consistent, reason }`.
 */
export function verifyConsistencyVector(vector) {
  const did = vector.log_operator_did_document;
  const first = verifySignedTreeHead(vector.first, did);
  if (!first.valid) return { consistent: false, reason: `first_${first.reason}` };
  const second = verifySignedTreeHead(vector.second, did);
  if (!second.valid) return { consistent: false, reason: `second_${second.reason}` };
  if (first.payload.log_id !== second.payload.log_id) return { consistent: false, reason: "log_id_mismatch" };
  const c = vector.consistency || {};
  if (c.first_size !== first.payload.tree_size || c.second_size !== second.payload.tree_size) {
    return { consistent: false, reason: "consistency_sizes_mismatch" };
  }
  const ok = verifyConsistency(
    c.first_size,
    c.second_size,
    b64urlDecode(first.payload.root_hash),
    b64urlDecode(second.payload.root_hash),
    (Array.isArray(c.proof) ? c.proof : []).map(b64urlDecode),
  );
  return ok ? { consistent: true, reason: "consistent" } : { consistent: false, reason: "consistency_proof_invalid" };
}

/** Ed25519 public key object from a JWK — exported for callers that sign test tree heads. */
export function publicKeyFromJwk(jwk) {
  return createPublicKey({ key: jwk, format: "jwk" });
}

/** Direct Ed25519 verification over raw bytes (used by tests). */
export function verifyRaw(publicKey, data, signature) {
  return cryptoVerify(null, data, publicKey, signature);
}
