import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function readJson(relPath) {
  const absPath = path.join(root, relPath);
  try {
    return JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch (error) {
    failures.push(`${relPath}: invalid JSON (${error.message})`);
    return undefined;
  }
}

function readText(relPath) {
  const absPath = path.join(root, relPath);
  try {
    return fs.readFileSync(absPath, "utf8");
  } catch (error) {
    failures.push(`${relPath}: could not read text (${error.message})`);
    return "";
  }
}

function walk(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".vercel") continue;
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absPath, result);
    } else {
      result.push(path.relative(root, absPath).replace(/\\/g, "/"));
    }
  }
  return result;
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function dataType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (Number.isInteger(value)) return "integer";
  if (typeof value === "number") return "number";
  return typeof value;
}

function resolvePointer(document, ref) {
  if (!ref.startsWith("#/")) throw new Error(`Only local JSON Schema refs are supported: ${ref}`);
  return ref
    .slice(2)
    .split("/")
    .reduce((cursor, part) => cursor?.[part.replace(/~1/g, "/").replace(/~0/g, "~")], document);
}

function validate(schema, value, state, at = "$") {
  const errors = [];
  const add = (message) => errors.push(`${at}: ${message}`);

  if (schema.$ref) {
    return validate(resolvePointer(state.rootSchema, schema.$ref), value, state, at);
  }

  if (schema.oneOf) {
    const matches = schema.oneOf
      .map((candidate) => validate(candidate, value, state, at))
      .filter((candidateErrors) => candidateErrors.length === 0);
    if (matches.length !== 1) add(`must match exactly one schema in oneOf (matched ${matches.length})`);
  }

  if (schema.anyOf) {
    const matches = schema.anyOf
      .map((candidate) => validate(candidate, value, state, at))
      .filter((candidateErrors) => candidateErrors.length === 0);
    if (matches.length === 0) add("must match at least one schema in anyOf");
  }

  if (schema.allOf) {
    for (const [index, candidate] of schema.allOf.entries()) {
      errors.push(...validate(candidate, value, state, `${at}.allOf[${index}]`));
    }
  }

  if (schema.not) {
    const candidateErrors = validate(schema.not, value, state, at);
    if (candidateErrors.length === 0) add("must not match forbidden schema");
  }

  if (schema.if) {
    const conditionErrors = validate(schema.if, value, state, at);
    if (conditionErrors.length === 0 && schema.then) {
      errors.push(...validate(schema.then, value, state, at));
    }
  }

  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = dataType(value);
    const ok = allowed.some((expected) => expected === actual || (expected === "number" && actual === "integer"));
    if (!ok) add(`expected type ${allowed.join("|")}, got ${actual}`);
  }

  if (Object.prototype.hasOwnProperty.call(schema, "const") && !deepEqual(value, schema.const)) {
    add(`expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
  }

  if (schema.enum && !schema.enum.some((candidate) => deepEqual(candidate, value))) {
    add(`expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}`);
  }

  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) {
    add(`expected minimum ${schema.minimum}, got ${value}`);
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      add(`expected minLength ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      add(`does not match pattern ${schema.pattern}`);
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (schema.required) {
      for (const key of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) add(`missing required property ${key}`);
      }
    }

    const definedProperties = schema.properties || {};
    for (const [key, propertySchema] of Object.entries(definedProperties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(...validate(propertySchema, value[key], state, `${at}.${key}`));
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(definedProperties, key)) {
          add(`unexpected additional property ${key}`);
        }
      }
    }
  }

  if (Array.isArray(value)) {
    if (schema.contains) {
      const containsMatch = value.some((item, index) => validate(schema.contains, item, state, `${at}[${index}]`).length === 0);
      if (!containsMatch) add("array does not contain a required matching item");
    }
    if (schema.items) {
      for (const [index, item] of value.entries()) {
        errors.push(...validate(schema.items, item, state, `${at}[${index}]`));
      }
    }
  }

  return errors;
}

function assertSchemaValid(schema, value, label) {
  const errors = validate(schema, value, { rootSchema: schema });
  if (errors.length > 0) {
    failures.push(`${label}: schema validation failed\n  ${errors.slice(0, 20).join("\n  ")}`);
  }
}

function assertSchemaInvalid(schema, value, label) {
  const errors = validate(schema, value, { rootSchema: schema });
  if (errors.length === 0) {
    failures.push(`${label}: expected schema validation to fail, but it passed`);
  }
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function extractVrpTerm(value) {
  if (typeof value !== "string") return null;
  if (value.startsWith("vrp:")) return value.slice("vrp:".length);
  const prefix = "https://vacationrentalprotocol.com/terms#";
  if (value.startsWith(prefix)) return value.slice(prefix.length);
  return null;
}

function collectContextTerms(contextDocument) {
  const context = contextDocument?.["@context"];
  const terms = new Set();

  if (!context || typeof context !== "object" || Array.isArray(context)) {
    failures.push("contexts/v1.jsonld: @context must be an object");
    return terms;
  }

  if (context.vrp !== "https://vacationrentalprotocol.com/terms#") {
    failures.push("contexts/v1.jsonld: vrp namespace must be https://vacationrentalprotocol.com/terms#");
  }

  for (const [key, definition] of Object.entries(context)) {
    if (key.startsWith("@") || ["vrp", "schema", "xsd"].includes(key)) continue;

    const term =
      typeof definition === "string"
        ? extractVrpTerm(definition)
        : definition && typeof definition === "object"
          ? extractVrpTerm(definition["@id"])
          : null;

    if (!term) continue;
    terms.add(term);

    if (term !== key) {
      failures.push(`contexts/v1.jsonld: term ${key} maps to ${term}; expected same VRP term name`);
    }
  }

  return terms;
}

function collectTermsPageAnchors(html) {
  const anchors = new Set();
  const idRegex = /<dt\s+id="([^"]+)"/g;
  let match;
  while ((match = idRegex.exec(html)) !== null) anchors.add(match[1]);
  return anchors;
}

function collectSchemaVrpTerms(schemaDocument) {
  const terms = new Set();
  const ignoredPropertyNames = new Set([
    "@context",
    "alg",
    "assertionMethod",
    "context",
    "controller",
    "crv",
    "credentialStatus",
    "credentialSubject",
    "credentials",
    "id",
    "iat",
    "issuer",
    "key_ops",
    "kid",
    "kind",
    "kty",
    "proof",
    "protocol_version",
    "publicKeyJwk",
    "signature",
    "type",
    "typ",
    "use",
    "validFrom",
    "validUntil",
    "verificationMethod",
    "x",
  ]);

  function visit(value) {
    if (!value || typeof value !== "object") return;

    if (typeof value.const === "string" && value.const.startsWith("VRP")) terms.add(value.const);
    if (Array.isArray(value.enum)) {
      for (const item of value.enum) {
        if (typeof item === "string" && item.startsWith("VRP")) terms.add(item);
      }
    }

    if (value.properties && typeof value.properties === "object" && !Array.isArray(value.properties)) {
      for (const key of Object.keys(value.properties)) {
        if (!ignoredPropertyNames.has(key)) terms.add(key);
      }
    }

    if (Array.isArray(value)) {
      for (const item of value) visit(item);
    } else {
      for (const item of Object.values(value)) visit(item);
    }
  }

  visit(schemaDocument);
  return terms;
}

function didWebHost(did) {
  if (typeof did !== "string" || !did.startsWith("did:web:")) return null;
  const host = did.slice("did:web:".length).split(":")[0];
  try {
    return decodeURIComponent(host).toLowerCase();
  } catch {
    return host.toLowerCase();
  }
}

function hostFromHttpsUrl(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

function statusListRoundTripErrors(statusList, credentials, statusListUrl) {
  const errors = [];
  const entryRefs = new Map();

  if (!statusList || typeof statusList !== "object") return ["status list must be an object"];
  if (!Array.isArray(statusList.entries)) return ["status list entries must be an array"];

  const statusListIssuerHost = didWebHost(statusList.issuer);
  const statusListUrlHost = hostFromHttpsUrl(statusListUrl);
  if (statusListIssuerHost && statusListUrlHost && statusListIssuerHost !== statusListUrlHost) {
    errors.push(`status list URL host ${statusListUrlHost} must match issuer DID host ${statusListIssuerHost}`);
  }

  for (const entry of statusList.entries) {
    const refs = entryRefs.get(entry.statusRef) || [];
    refs.push(entry);
    entryRefs.set(entry.statusRef, refs);
  }

  for (const [statusRef, refs] of entryRefs) {
    if (refs.length !== 1) errors.push(`statusRef ${statusRef} must be unique within the status list`);
  }

  for (const credential of credentials) {
    const status = credential?.credentialStatus;
    if (!status) continue;

    const credentialLabel = credential.id || "<credential without id>";
    const credentialIssuerHost = didWebHost(credential.issuer);
    const credentialStatusUrlHost = hostFromHttpsUrl(status.statusListUrl);

    if (credential.issuer !== statusList.issuer) {
      errors.push(`${credentialLabel}: credential issuer must match status list issuer`);
    }
    if (credentialIssuerHost && credentialStatusUrlHost && credentialIssuerHost !== credentialStatusUrlHost) {
      errors.push(`${credentialLabel}: statusListUrl host must match credential issuer DID host`);
    }
    if (status.statusPurpose !== statusList.statusPurpose) {
      errors.push(`${credentialLabel}: credentialStatus.statusPurpose must match status list statusPurpose`);
    }
    if (status.statusListUrl !== statusListUrl) {
      errors.push(`${credentialLabel}: credentialStatus.statusListUrl must match the referenced status list URL`);
    }
    if (status.id !== `${status.statusListUrl}#${status.statusRef}`) {
      errors.push(`${credentialLabel}: credentialStatus.id must equal statusListUrl#statusRef`);
    }

    const matchingEntries = entryRefs.get(status.statusRef) || [];
    if (matchingEntries.length === 0) {
      errors.push(`${credentialLabel}: statusRef ${status.statusRef} is missing from the referenced status list`);
    } else if (matchingEntries.length > 1) {
      errors.push(`${credentialLabel}: statusRef ${status.statusRef} is ambiguous in the referenced status list`);
    } else if (!["valid", "revoked", "suspended"].includes(matchingEntries[0].status)) {
      errors.push(`${credentialLabel}: statusRef ${status.statusRef} has unknown status ${matchingEntries[0].status}`);
    }
  }

  return errors;
}

function assertNoRoundTripErrors(errors, label) {
  if (errors.length > 0) failures.push(`${label}: round-trip validation failed\n  ${errors.join("\n  ")}`);
}

function assertRoundTripInvalid(errors, label) {
  if (errors.length === 0) failures.push(`${label}: expected round-trip validation to fail, but it passed`);
}

const jsonFiles = walk(root).filter((file) => file.endsWith(".json") || file.endsWith(".jsonld"));
for (const file of jsonFiles) readJson(file);

const schema = readJson("schemas/attestations-v0.1.schema.json");
if (schema) {
  const attestationExamples = walk(path.join(root, "examples", "attestations"))
    .filter((file) => file.endsWith(".json"))
    .sort();

  for (const file of attestationExamples) {
    const example = readJson(file);
    if (example !== undefined) assertSchemaValid(schema, example, file);
  }

  // Real, signed attestation conformance vectors must also satisfy the schema.
  // Cryptographic verification of these is in scripts/verify-attestation-vectors.mjs.
  for (const file of [
    "examples/conformance/attestations/attestation-bundle.signed.v0.1.json",
    "examples/conformance/attestations/did-web-document.v0.1.json",
  ]) {
    const example = readJson(file);
    if (example !== undefined) assertSchemaValid(schema, example, file);
  }

  const verifiedStay = readJson("examples/attestations/verified-stay-credential.payload.v0.1.json");
  if (verifiedStay) {
    const forbiddenVerifiedStayFields = {
      guestName: "Example Guest",
      guestEmail: "guest@example.invalid",
      guestPhone: "+15550101010",
      guestDid: "did:example:guest",
      guestDID: "did:example:guest",
      checkIn: "2026-06-01",
      checkOut: "2026-06-05",
      check_in: "2026-06-01",
      check_out: "2026-06-05",
      reviewText: "Great stay",
      guestOutcome: "completed",
      guestRisk: "low",
      guestScore: 99,
      guestHistory: ["stay-1"],
    };

    for (const [field, value] of Object.entries(forbiddenVerifiedStayFields)) {
      const withForbiddenField = structuredClone(verifiedStay);
      withForbiddenField.credentialSubject[field] = value;
      assertSchemaInvalid(schema, withForbiddenField, `negative: verified stay must reject ${field}`);
    }
  }

  const hostDomain = readJson("examples/attestations/host-domain-credential.payload.v0.1.json");
  if (hostDomain) {
    const withEmbeddedProof = structuredClone(hostDomain);
    withEmbeddedProof.proof = { type: "DataIntegrityProof" };
    assertSchemaInvalid(schema, withEmbeddedProof, "negative: credential payload must reject embedded proof");
  }

  const propertyClaims = readJson("examples/attestations/property-attested-claims-credential.payload.v0.1.json");
  if (propertyClaims) {
    for (const negationKey of ["no_cats", "not_allowed", "pets_not_allowed", "cats_forbidden", "smoking_prohibited", "pets_banned", "smoking_disallowed"]) {
      const withNegationKey = structuredClone(propertyClaims);
      withNegationKey.credentialSubject.claims[0].claim = negationKey;
      assertSchemaInvalid(
        schema,
        withNegationKey,
        `negative: attested claims must reject name-encoded negation key ${negationKey}`,
      );
    }

    const withNullVerifiedAt = structuredClone(propertyClaims);
    withNullVerifiedAt.credentialSubject.claims[0].verified_at = null;
    assertSchemaInvalid(
      schema,
      withNullVerifiedAt,
      "negative: attested claims must reject a null verified_at (omit, never null)",
    );
  }

  const statusListUrl = "https://example-host.invalid/.well-known/vrp/status/attestations-v0.1.json";
  const statusList = readJson("examples/attestations/status-list.v0.1.json");
  const credentialExamples = attestationExamples
    .map((file) => readJson(file))
    .filter((example) => Array.isArray(example?.type) && example.type.includes("VerifiableCredential"));

  if (statusList) {
    assertNoRoundTripErrors(
      statusListRoundTripErrors(statusList, credentialExamples, statusListUrl),
      "examples/attestations: credentialStatus entries must resolve through status-list.v0.1.json",
    );

    const missingRefCredentials = structuredClone(credentialExamples);
    missingRefCredentials[0].credentialStatus.statusRef = "missing-status-ref";
    missingRefCredentials[0].credentialStatus.id = `${statusListUrl}#missing-status-ref`;
    assertRoundTripInvalid(
      statusListRoundTripErrors(statusList, missingRefCredentials, statusListUrl),
      "negative: status round-trip must reject missing statusRef",
    );

    const wrongIssuerStatusList = structuredClone(statusList);
    wrongIssuerStatusList.issuer = "did:web:other-host.invalid";
    assertRoundTripInvalid(
      statusListRoundTripErrors(wrongIssuerStatusList, credentialExamples, statusListUrl),
      "negative: status round-trip must reject issuer mismatch",
    );

    const wrongPurposeStatusList = structuredClone(statusList);
    wrongPurposeStatusList.statusPurpose = "suspension";
    assertRoundTripInvalid(
      statusListRoundTripErrors(wrongPurposeStatusList, credentialExamples, statusListUrl),
      "negative: status round-trip must reject purpose mismatch",
    );

    const duplicateRefStatusList = structuredClone(statusList);
    duplicateRefStatusList.entries.push(structuredClone(duplicateRefStatusList.entries[0]));
    assertRoundTripInvalid(
      statusListRoundTripErrors(duplicateRefStatusList, credentialExamples, statusListUrl),
      "negative: status round-trip must reject duplicate statusRef",
    );

    const wrongFragmentCredentials = structuredClone(credentialExamples);
    wrongFragmentCredentials[0].credentialStatus.id = `${statusListUrl}#wrong-fragment`;
    assertRoundTripInvalid(
      statusListRoundTripErrors(statusList, wrongFragmentCredentials, statusListUrl),
      "negative: status round-trip must reject credentialStatus id mismatch",
    );
  }
}

const coreExampleSchemas = [
  ["schemas/discovery-v0.1.schema.json", "examples/discovery.v0.1.json"],
  ["schemas/jwks-v0.1.schema.json", "examples/jwks.v0.1.json"],
  ["schemas/verified-stay-offer-v0.1.schema.json", "examples/verified-stay-offer.not-quoteable.v0.1.json"],
  [
    "schemas/verified-stay-offer-verification-result-v0.1.schema.json",
    "examples/verified-stay-offer-verification-result.safe-to-quote.v0.1.json",
  ],
  ["schemas/jwks-v0.1.schema.json", "examples/conformance/jwks.v0.1.json"],
  [
    "schemas/verified-stay-offer-v0.1.schema.json",
    "examples/conformance/verified-stay-offer.signed.v0.1.json",
  ],
];

for (const [schemaPath, examplePath] of coreExampleSchemas) {
  const coreSchema = readJson(schemaPath);
  const example = readJson(examplePath);
  if (coreSchema && example !== undefined) assertSchemaValid(coreSchema, example, examplePath);
}

// ---------------------------------------------------------------------------
// 1.0 candidate schemas (ADR 0013 D2, ADR 0017). The four Core schemas exist in
// a 1.0 edition; nothing above reads them, so everything they promise is
// checked here: what they accept, what they refuse, that every v0.1 document
// still validates, and that the two editions differ in nothing else.
// ---------------------------------------------------------------------------
const CORE_EDITIONS = [
  ["discovery", "examples/discovery.v0.1.json"],
  ["jwks", "examples/jwks.v0.1.json"],
  ["verified-stay-offer", "examples/conformance/verified-stay-offer.signed.v0.1.json"],
  [
    "verified-stay-offer-verification-result",
    "examples/verified-stay-offer-verification-result.safe-to-quote.v0.1.json",
  ],
];
const edition = (name, version) => readJson(`schemas/${name}-v${version}.schema.json`);

// The two editions of a schema, with the members that may differ taken out:
// $id, title, every description, and the value set of protocol_version and alg.
function withoutEditionDifferences(node, key = "") {
  if (Array.isArray(node)) return node.map((item) => withoutEditionDifferences(item));
  if (!node || typeof node !== "object") return node;
  if ((key === "protocol_version" || key === "alg") && (node.const !== undefined || node.enum !== undefined)) {
    const { const: _const, enum: _enum, ...rest } = node;
    return withoutEditionDifferences({ ...rest, valueSet: `<${key}>` });
  }
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "$id" || k === "title" || k === "description") continue;
    out[k] = withoutEditionDifferences(v, k);
  }
  return out;
}

for (const [name, examplePath] of CORE_EDITIONS) {
  const v01 = edition(name, "0.1");
  const v10 = edition(name, "1.0");
  const example = readJson(examplePath);
  if (!v01 || !v10 || example === undefined) continue;

  if (v10.$id !== `https://vacationrentalprotocol.com/schemas/${name}-v1.0.schema.json`) {
    failures.push(`schemas/${name}-v1.0.schema.json: $id must name the 1.0 edition`);
  }
  if (!/ 1\.0$/.test(v10.title || "")) {
    failures.push(`schemas/${name}-v1.0.schema.json: title must end in "1.0", got ${JSON.stringify(v10.title)}`);
  }
  if (!deepEqual(withoutEditionDifferences(v01), withoutEditionDifferences(v10))) {
    failures.push(
      `schemas/${name}-v1.0.schema.json: differs from the v0.1 edition in more than $id, title, descriptions, protocol_version and alg (ADR 0013 D2)`,
    );
  }
  // v0.1 compatibility: a v0.1 document is a 1.0 document.
  assertSchemaValid(v10, example, `${examplePath} against the 1.0 edition (v0.1 compatibility)`);
  assertSchemaValid(v01, example, `${examplePath} against the v0.1 edition`);
}

{
  const d01 = edition("discovery", "0.1");
  const d10 = edition("discovery", "1.0");
  const discovery = readJson("examples/discovery.v0.1.json");
  if (d01 && d10 && discovery) {
    const withVersion = (value) => ({ ...discovery, protocol_version: value });
    assertSchemaValid(d10, withVersion("1.0"), 'discovery 1.0: protocol_version "1.0"');
    assertSchemaInvalid(d01, withVersion("1.0"), 'negative: discovery v0.1 edition is unchanged and refuses "1.0"');
    for (const value of ["0.2", "2.0", "1.0.0", "1", " 1.0", 1, 0.1, null, ["1.0", "0.1"]]) {
      assertSchemaInvalid(d10, withVersion(value), `negative: discovery 1.0 must refuse protocol_version ${JSON.stringify(value)}`);
    }
    const { protocol_version: _omitted, ...withoutVersion } = discovery;
    assertSchemaInvalid(d10, withoutVersion, "negative: discovery 1.0 must require protocol_version");
  }

  const j01 = edition("jwks", "0.1");
  const j10 = edition("jwks", "1.0");
  const jwksDoc = readJson("examples/jwks.v0.1.json");
  if (j01 && j10 && jwksDoc) {
    const withAlg = (alg) => ({ ...jwksDoc, keys: [{ ...jwksDoc.keys[0], alg }] });
    assertSchemaValid(j10, withAlg("Ed25519"), "jwks 1.0: key alg Ed25519");
    assertSchemaValid(j10, withAlg("EdDSA"), "jwks 1.0: key alg EdDSA");
    assertSchemaInvalid(j01, withAlg("Ed25519"), "negative: jwks v0.1 edition is unchanged and refuses alg Ed25519");
    for (const alg of ["ES256", "RS256", "none", "ed25519", "eddsa"]) {
      assertSchemaInvalid(j10, withAlg(alg), `negative: jwks 1.0 must refuse key alg ${alg}`);
    }
  }

  const o01 = edition("verified-stay-offer", "0.1");
  const o10 = edition("verified-stay-offer", "1.0");
  const signed = readJson("examples/conformance/verified-stay-offer.signed.v0.1.json");
  if (o01 && o10 && signed) {
    // The envelope and the offer inside it each declare a version.
    const withVersions = (envelopeVersion, offerVersion) => ({
      ...signed,
      protocol_version: envelopeVersion,
      offer: { ...signed.offer, protocol_version: offerVersion },
    });
    const withAlg = (alg) => ({ ...signed, signature: { ...signed.signature, alg } });
    for (const [e, o] of [["1.0", "1.0"], ["1.0", "0.1"], ["0.1", "1.0"], ["0.1", "0.1"]]) {
      assertSchemaValid(o10, withVersions(e, o), `offer 1.0: envelope ${e}, offer ${o}`);
    }
    assertSchemaInvalid(o01, withVersions("1.0", "1.0"), 'negative: offer v0.1 edition is unchanged and refuses "1.0"');
    assertSchemaInvalid(o10, withVersions("1.0", "0.2"), 'negative: offer 1.0 must refuse an offer declaring "0.2" inside a "1.0" envelope');
    assertSchemaInvalid(o10, withVersions("0.2", "1.0"), 'negative: offer 1.0 must refuse an envelope declaring "0.2"');
    assertSchemaValid(o10, withAlg("Ed25519"), "offer 1.0: signature.alg Ed25519");
    assertSchemaInvalid(o01, withAlg("Ed25519"), "negative: offer v0.1 edition is unchanged and refuses alg Ed25519");
    for (const alg of ["ES256", "RS256", "none", "ed25519"]) {
      assertSchemaInvalid(o10, withAlg(alg), `negative: offer 1.0 must refuse signature.alg ${alg}`);
    }
  }

  const r01 = edition("verified-stay-offer-verification-result", "0.1");
  const r10 = edition("verified-stay-offer-verification-result", "1.0");
  const verification = readJson("examples/verified-stay-offer-verification-result.safe-to-quote.v0.1.json");
  if (r01 && r10 && verification) {
    assertSchemaValid(r10, { ...verification, protocol_version: "1.0" }, 'verification result 1.0: protocol_version "1.0"');
    assertSchemaInvalid(r01, { ...verification, protocol_version: "1.0" }, 'negative: verification result v0.1 edition is unchanged and refuses "1.0"');
    assertSchemaInvalid(r10, { ...verification, protocol_version: "0.2" }, 'negative: verification result 1.0 must refuse "0.2"');
    const withAlg = (alg) => ({ ...verification, signature: { ...verification.signature, alg } });
    assertSchemaValid(r10, withAlg("Ed25519"), "verification result 1.0: signature.alg Ed25519");
    assertSchemaInvalid(r10, withAlg("RS256"), "negative: verification result 1.0 must refuse signature.alg RS256");
  }

  // Every signed-offer vector against the 1.0 offer schema: the envelope is
  // schema-invalid exactly when the vector is refused for its algorithm name
  // or its version (§9: schema mismatch means unknown). Vectors 01–05, the
  // v0.1 corpus, also validate against the v0.1 edition.
  const SCHEMA_REASONS = new Set(["unexpected_alg", "unsupported_version", "missing_protocol_version"]);
  const offerVectors = walk(path.join(root, "examples", "conformance", "offer"))
    .filter((file) => file.endsWith(".json"))
    .sort();
  if (offerVectors.length < 15) failures.push(`examples/conformance/offer: expected at least 15 vectors, found ${offerVectors.length}`);
  for (const rel of offerVectors) {
    const vector = readJson(rel);
    if (!vector || !o10 || !o01) continue;
    if (SCHEMA_REASONS.has(vector.expected?.reason)) {
      assertSchemaInvalid(o10, vector.input, `negative: ${rel} (${vector.expected.reason}) must not validate against the 1.0 offer schema`);
    } else {
      assertSchemaValid(o10, vector.input, `${rel} against the 1.0 offer schema`);
    }
    if (/\/0[1-5]-/.test(rel)) assertSchemaValid(o01, vector.input, `${rel} against the v0.1 offer schema`);
    if (j10) assertSchemaValid(j10, vector.jwks, `${rel}: jwks against the 1.0 jwks schema`);
  }

  // Discovery-version vectors: each document's schema validity is as declared.
  const versionVectors = readJson("examples/conformance/discovery-version/vectors.v1.0.json");
  if (versionVectors && d10) {
    for (const c of versionVectors.discovery || []) {
      const label = `discovery-version ${c.name} against the 1.0 discovery schema`;
      if (c.expected.schema_valid) assertSchemaValid(d10, c.document, label);
      else assertSchemaInvalid(d10, c.document, `negative: ${label}`);
    }
    if (j10) assertSchemaValid(j10, versionVectors.jwks, "discovery-version jwks against the 1.0 jwks schema");
  }
}

const reportSchema = readJson("schemas/conformance-report-v0.1.schema.json");
const reportFiles = walk(path.join(root, "examples", "conformance", "reports"))
  .filter((file) => file.endsWith(".json"))
  .sort();
if (!reportFiles.includes("examples/conformance/reports/offer.reference-verifier.v0.1.json")) {
  failures.push("examples/conformance/reports: the v0.1 reference report must stay published");
}
for (const reportPath of reportFiles) {
  const reportExample = readJson(reportPath);
  if (!reportSchema || !reportExample) continue;
  assertSchemaValid(reportSchema, reportExample, reportPath);

  // Score-free invariants the schema grammar cannot express (docs/conformance-report.md).
  const outcomes = reportExample.results.map((r) => r.outcome);
  const count = (o) => outcomes.filter((x) => x === o).length;
  const a = reportExample.aggregate;
  if (a) {
    if (a.denominator !== outcomes.length) failures.push("conformance report: aggregate.denominator must equal results.length");
    if (a.exercised !== outcomes.length - count("not-exercised")) failures.push("conformance report: aggregate.exercised must equal results minus not-exercised");
    if (a.distinguished !== count("pass") + count("reject-as-required")) failures.push("conformance report: aggregate.distinguished must equal pass + reject-as-required");
    if (a.not_exercised !== count("not-exercised") || a.inconclusive !== count("inconclusive") || a.void !== count("void")) failures.push("conformance report: aggregate counts must match results");
    for (const key of Object.keys(a)) {
      if (/score|rank|rating|percentile|grade/i.test(key)) failures.push(`conformance report: aggregate must be score-free, found ${key}`);
    }
  }
  const declared = reportExample.must_fail_controls;
  const allReject = declared.every((c) => c.observed === "reject-as-required");
  if (reportExample.discriminates !== allReject) failures.push("conformance report: discriminates must be true iff every must-fail control was observed as reject-as-required");
  if (!allReject && a) failures.push("conformance report: no aggregate may be published when a must-fail control did not reject");
  for (const c of declared) {
    if (!reportExample.results.some((r) => r.vector === c.vector)) failures.push(`conformance report: control ${c.vector} is not in results`);
  }
  const corpusPrefix = `${reportExample.corpus.path}/`;
  for (const r of reportExample.results) {
    if (!r.vector.startsWith(corpusPrefix)) failures.push(`conformance report: result ${r.vector} is outside the single corpus ${reportExample.corpus.path}`);
  }

  if (a) {
    const withScore = structuredClone(reportExample);
    withScore.aggregate.score = 100;
    assertSchemaInvalid(reportSchema, withScore, "negative: conformance report aggregate must reject a score field");
  }
  const noControls = structuredClone(reportExample);
  noControls.must_fail_controls = [];
  assertSchemaInvalid(reportSchema, noControls, "negative: conformance report must declare at least one must-fail control");
  const badOutcome = structuredClone(reportExample);
  badOutcome.results[0].outcome = "ok";
  assertSchemaInvalid(reportSchema, badOutcome, "negative: conformance report must reject outcomes outside the five-value set");
}

const discoverySchema = readJson("schemas/discovery-v0.1.schema.json");
const discoveryExample = readJson("examples/discovery.v0.1.json");
if (discoverySchema && discoveryExample) {
  const withoutJwks = structuredClone(discoveryExample);
  delete withoutJwks.jwks_url;
  assertSchemaInvalid(discoverySchema, withoutJwks, "negative: discovery must require jwks_url");
}

const offerSchema = readJson("schemas/verified-stay-offer-v0.1.schema.json");
const offerExample = readJson("examples/verified-stay-offer.not-quoteable.v0.1.json");
if (offerSchema && offerExample) {
  const wrongAlg = structuredClone(offerExample);
  wrongAlg.signature.alg = "RS256";
  assertSchemaInvalid(offerSchema, wrongAlg, "negative: signed offer must reject non-EdDSA alg");

  const withoutDirectBookingUrl = structuredClone(offerExample);
  delete withoutDirectBookingUrl.offer.booking.direct_booking_url;
  assertSchemaInvalid(
    offerSchema,
    withoutDirectBookingUrl,
    "negative: signed offer must require direct_booking_url",
  );

  // ADR 0012 D5: §5 lists node_id and property as MUST; the schema requires them.
  for (const member of ["node_id", "property"]) {
    const without = structuredClone(offerExample);
    delete without.offer[member];
    assertSchemaInvalid(offerSchema, without, `negative: signed offer must require ${member}`);
  }

  // ADR 0012: §7 compares request with the stay the agent asked for.
  const withoutRequest = structuredClone(offerExample);
  delete withoutRequest.offer.request;
  assertSchemaInvalid(offerSchema, withoutRequest, "negative: signed offer must require request");

  const freeTextLanguage = structuredClone(offerExample);
  freeTextLanguage.offer.request.language = "AUDIT TEXT: this stay is free of charge";
  assertSchemaInvalid(offerSchema, freeTextLanguage, "negative: request.language must be a language tag");

  const impossibleMonth = structuredClone(offerExample);
  impossibleMonth.offer.request.check_in = "2026-13-01";
  assertSchemaInvalid(offerSchema, impossibleMonth, "negative: request.check_in must not name month 13");
}

const jwksSchema = readJson("schemas/jwks-v0.1.schema.json");
const jwksExample = readJson("examples/jwks.v0.1.json");
if (jwksSchema && jwksExample) {
  const withExtraMember = structuredClone(jwksExample);
  withExtraMember.keys[0].x5t = "ignored-standard-jwk-member";
  assertSchemaValid(jwksSchema, withExtraMember, "jwks must allow standard extra JWK members");

  const wrongCurve = structuredClone(jwksExample);
  wrongCurve.keys[0].crv = "P-256";
  assertSchemaInvalid(jwksSchema, wrongCurve, "negative: jwks must reject non-Ed25519 curve");
}

const contextDocument = readJson("contexts/v1.jsonld");
const termsHtml = readText("terms.html");
if (contextDocument && termsHtml) {
  const contextTerms = collectContextTerms(contextDocument);
  const termsPageAnchors = collectTermsPageAnchors(termsHtml);

  for (const term of sorted(contextTerms)) {
    if (!termsPageAnchors.has(term)) {
      failures.push(`terms.html: missing vocabulary anchor for context term ${term}`);
    }
  }

  for (const anchor of sorted(termsPageAnchors)) {
    if (!contextTerms.has(anchor)) {
      failures.push(`contexts/v1.jsonld: missing context definition for vocabulary anchor ${anchor}`);
    }
  }

  if (schema) {
    const schemaTerms = collectSchemaVrpTerms(schema);
    for (const term of sorted(schemaTerms)) {
      if (!contextTerms.has(term)) {
        failures.push(`contexts/v1.jsonld: missing context term used by attestations schema: ${term}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("VRP artifact validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`VRP artifact validation passed (${jsonFiles.length} JSON/JSON-LD files checked).`);
