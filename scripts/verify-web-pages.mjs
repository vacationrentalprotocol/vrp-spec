// The pages that say "verified", run as served: verify.html, demo.html and
// verify-receipt.html.
//
// Each page is a verifier of its own, with its rules in its own inline script.
// This script runs those scripts unmodified in a Node `vm` context, with a
// stand-in document, a clock and timers the test moves, a recording fetch, and
// genuine Ed25519 signatures made here. Nothing leaves the machine.
//
//   shared   — the functions demo.html takes from verify.html are the same text.
//   jws      — verify.html and demo.html: the key's own alg label, the header's
//              alg, the key type, the exact compact form, a changed signature.
//   offers   — the same signed offers through verify.html's and demo.html's
//              whole flow. Neither page may show an offer as safe to quote or
//              offer a booking link where the other does not, and a valid
//              signature is never enough for either (Core §6, §7).
//   schema   — every single change the offer schema forbids, read off the
//              schema itself (scripts/lib/schema-mutations.mjs): neither page
//              may show a schema-invalid offer as safe to quote (Core §9), and
//              both still show a valid one, with or without optional members.
//   price    — a signed amount as a person reads it, minor units respected.
//   lifetime — a result stands for its request and only until valid_until.
//   receipts — verify-receipt.html: the node key's alg label, the log key's,
//              receipt-v1 §3, §4, §6 (version, shape, each attestation's own
//              status, one by one) against the reference verifier, the inclusion
//              proof held to the signed tree head's size (transparency-log §8),
//              and a result that follows the clock and the pasted text.
//
// Run directly or via `npm test`:  node scripts/verify-web-pages.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto, createHash } from "node:crypto";
import vm from "node:vm";
import { verifyReceipt } from "../lib/vrp-receipt.mjs";
import { schemaMutations } from "./lib/schema-mutations.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = (page) => readFileSync(join(repoRoot, page), "utf8");
const OFFER_SCHEMA_PATH = "/schemas/verified-stay-offer-v0.1.schema.json";
const OFFER_SCHEMA_TEXT = readFileSync(join(repoRoot, "schemas", "verified-stay-offer-v0.1.schema.json"), "utf8");
const OFFER_SCHEMA = JSON.parse(OFFER_SCHEMA_TEXT);

let passed = 0;
const failures = [];
const check = (name, cond, detail = "") => {
  if (cond) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else failures.push(detail ? `${name} (${String(detail).slice(0, 400)})` : name);
};
const same = (name, got, want) => check(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const HOST = "villaakerlyckan.se";
const NOW = Date.parse("2026-11-13T12:00:00Z");
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
const b64 = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
const sha256 = (...parts) => createHash("sha256").update(Buffer.concat(parts.map((p) => Buffer.from(p)))).digest();

// Two Ed25519 key pairs made for this run: a node's and a log operator's.
async function makeKey(kid) {
  const pair = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const jwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
  const pub = { kty: "OKP", crv: "Ed25519", x: jwk.x, kid, alg: "EdDSA" };
  const sign = async (payload, header = { alg: "EdDSA", kid }) => {
    const input = b64(header) + "." + b64(payload);
    const sig = await webcrypto.subtle.sign("Ed25519", pair.privateKey, new TextEncoder().encode(input));
    return input + "." + Buffer.from(sig).toString("base64url");
  };
  return { pub, sign, kid };
}
const node = await makeKey("node-key-1");
const log = await makeKey("log-key-1");
const relabel = (pub, label) => {
  const { alg, ...rest } = pub;
  return label === undefined ? rest : { ...rest, alg: label };
};

// The text of every inline <script> element of a page of this repository, as
// written. The tags are found as the exact strings the pages use, so this
// reads the repository's own files and filters nothing.
function inlineScripts(text) {
  const OPEN = "<script>";
  const CLOSE = "</script>";
  const found = [];
  let at = 0;
  for (;;) {
    const a = text.indexOf(OPEN, at);
    if (a < 0) break;
    const b = text.indexOf(CLOSE, a + OPEN.length);
    if (b < 0) break;
    found.push(text.slice(a + OPEN.length, b));
    at = b + CLOSE.length;
  }
  return found;
}

// ── a page, loaded ──────────────────────────────────────────────────────────
function load(page, { search = "", hash = "", respond = () => undefined } = {}) {
  const t = { now: NOW, timers: [], next: 1 };
  class Clock extends Date {
    constructor(...args) {
      if (args.length === 0) super(t.now);
      else super(...args);
    }
    static now() {
      return t.now;
    }
  }
  const elements = new Map();
  const state = { focused: null, fetched: [] };
  const element = (id) => {
    const classes = new Set();
    let inner = "";
    return {
      id, value: "", min: "", hidden: true, textContent: "", disabled: false, style: {}, attributes: {}, listeners: {}, children: [],
      scrollTop: 0, scrollHeight: 0,
      get innerHTML() { return inner; },
      set innerHTML(v) { inner = String(v); this.children = []; },
      get className() { return [...classes].join(" "); },
      set className(v) { classes.clear(); for (const c of String(v).split(/\s+/)) if (c) classes.add(c); },
      classList: {
        add: (...c) => c.forEach((x) => classes.add(x)),
        remove: (...c) => c.forEach((x) => classes.delete(x)),
        toggle: (c, on) => ((on === undefined ? !classes.has(c) : on) ? classes.add(c) : classes.delete(c)),
        contains: (c) => classes.has(c),
      },
      setAttribute(k, v) { this.attributes[k] = String(v); },
      getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
      removeAttribute(k) { delete this.attributes[k]; },
      addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
      appendChild(child) { this.children.push(child); },
      focus() { state.focused = id; },
      scrollIntoView() {},
      querySelector: () => element(""),
      closest: () => null,
    };
  };
  const el = (id) => {
    if (!elements.has(id)) elements.set(id, element(id));
    return elements.get(id);
  };
  const fetch = async (url) => {
    url = String(url);
    state.fetched.push(url);
    const answer = await respond(url);
    if (!answer) throw new TypeError("Failed to fetch");
    const body = answer.body;
    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      type: "basic",
      json: async () => (typeof body === "string" ? JSON.parse(body) : structuredClone(body)),
      text: async () => String(body),
    };
  };
  // A pause in a page's presentation (under a second) runs at once; a longer
  // timer waits until the test moves the clock past it.
  const setTimeout = (fn, ms = 0) => {
    const id = t.next++;
    if (ms <= 1000) fn();
    else t.timers.push({ id, at: t.now + ms, fn });
    return id;
  };
  const clearTimeout = (id) => {
    t.timers = t.timers.filter((x) => x.id !== id);
  };
  const context = vm.createContext({
    crypto: webcrypto, atob, btoa, TextEncoder, TextDecoder, URL, URLSearchParams, console,
    Date: Clock, setTimeout, clearTimeout, fetch,
    navigator: { clipboard: { writeText: async () => {} } },
    location: { search, hash },
    document: { getElementById: el, addEventListener() {}, querySelector: () => element(""), createElement: () => element("") },
  });
  context.window = context;
  const scripts = inlineScripts(html(page));
  if (scripts.length !== 1) throw new Error(`${page}: expected one inline script, found ${scripts.length}`);
  vm.runInContext(scripts[0], context, { filename: page });
  const fire = async (id, type) => {
    for (const fn of el(id).listeners[type] ?? []) await fn({ target: el(id) });
  };
  const advance = (ms) => {
    t.now += ms;
    const due = t.timers.filter((x) => x.at <= t.now);
    t.timers = t.timers.filter((x) => x.at > t.now);
    for (const x of due) x.fn();
  };
  return { context, el, state, fire, advance, timers: () => t.timers.length };
}

// ── shared: the functions demo.html takes from verify.html are the same text ─
function fnText(page, name) {
  const lines = html(page).split("\n");
  const start = lines.findIndex((l) => new RegExp("^      (async )?function " + name + "\\(").test(l));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i >= start && l === "      }");
  return lines.slice(start, end + 1).join("\n");
}
for (const name of ["verifyJws", "isNodeUrl", "sameJson", "parseDateTime", "parseDate", "loadOfferSchema", "schemaFaults", "offerShapeFaults", "formatMoney"]) {
  const a = fnText("verify.html", name);
  check(`shared: verify.html defines ${name}`, a !== null);
  check(`shared: demo.html carries verify.html's ${name}, the same text`, a !== null && a === fnText("demo.html", name));
}
for (const prefix of ["      const LANGUAGE_TAG = ", "      const MAX_LIFETIME_MS = ", "      const CLOCK_SKEW_MS = ", "      const OFFER_SCHEMA_URL = "]) {
  const pick = (page) => html(page).split("\n").filter((l) => l.startsWith(prefix));
  check(`shared: ${prefix.trim()} … is the same line in both pages`, pick("verify.html").length === 1 && pick("verify.html")[0] === pick("demo.html")[0]);
}

// ── the offer both pages are given ──────────────────────────────────────────
const offerFor = (check_in, check_out, guests) => ({
  kind: "verified_stay_offer",
  protocol_version: "0.1",
  canonical_domain: HOST,
  node_id: HOST,
  generated_at: iso(NOW - 60000),
  valid_until: iso(NOW + 540000),
  request: { check_in, check_out, guests, nights: 2, check_in_weekday: "Wednesday", check_out_weekday: "Friday", language: "en" },
  property: { property_id: "stay-1", id: "stay-1", name: "Test stay", url: "https://" + HOST + "/", domain: HOST, city: "Kävlinge", country: "SE" },
  availability: { available: true, source: "official_host_domain", reason: null, checked_at: iso(NOW - 60000) },
  price: {
    currency: "EUR", public_total: 120000, agent_total: 120000, total: 120000, minor_unit: true, exact: true, no_add_on_fees: true,
    ota_comparison_total: null, ota_comparison_source: null, checked_at: iso(NOW - 60000), package_applied: null,
  },
  booking: { direct_booking_url: "https://" + HOST + "/book?checkIn=" + check_in + "&checkOut=" + check_out + "&guests=" + guests, offer_id: "offer-1" },
  agent_permission: { may_quote_as_official_direct_offer: true, must_not_claim_ota_comparison_without_signed_ota_price: true, must_not_invent_discounts: true },
  source_authority: {
    model: "host_verified_direct_source", is_official_source_for_property: true, intermediary: "none",
    payment_recipient: "host", booking_model: "direct_with_host", booking_commission_pct: 0,
  },
});
const PSL = "// ===BEGIN ICANN DOMAINS===\nse\nexample\n// ===END ICANN DOMAINS===\n";
const DISCOVERY = {
  protocol: "vacation-rental-protocol",
  protocol_version: "0.1",
  canonical_domain: HOST,
  jwks_url: "https://" + HOST + "/.well-known/jwks.json",
  verified_stay_offer_endpoint: "https://" + HOST + "/api/verified-stay-offer",
};
// The node as a function of the URL. `change` edits the payload before it is
// signed; `changeEnvelope` edits the response after; `hold` delays the offer.
function nodeAnswers({ change, changeEnvelope, key = node.pub, header, discovery = DISCOVERY, hold, schema = OFFER_SCHEMA_TEXT } = {}) {
  return async (url) => {
    // The page asks the site it came from for the offer schema.
    if (url === OFFER_SCHEMA_PATH) return schema === null ? { status: 404, body: "{}" } : { status: 200, body: schema };
    if (url.includes("public_suffix_list")) return { status: 200, body: PSL };
    if (url.includes("gtlds.json")) return { status: 200, body: { gTLDs: [] } };
    if (url.endsWith("/.well-known/agent-traversal.json")) return { status: 200, body: { node: HOST } };
    if (url.endsWith("/.well-known/vacation-rental.json")) return { status: 200, body: discovery };
    if (url.endsWith("/.well-known/jwks.json")) return { status: 200, body: { keys: [key] } };
    if (url.includes("/api/verified-stay-offer")) {
      if (hold) await hold;
      const q = new URL(url).searchParams;
      const payload = offerFor(q.get("check_in"), q.get("check_out"), Number(q.get("guests")));
      if (change) change(payload);
      const envelope = { offer: structuredClone(payload), signature: { jws: await node.sign(payload, header) } };
      if (changeEnvelope) changeEnvelope(envelope);
      return { status: 200, body: envelope };
    }
    return undefined;
  };
}
async function runVerify(options) {
  const p = load("verify.html", { respond: nodeAnswers(options) });
  p.el("host").value = HOST;
  p.el("checkIn").value = "2027-01-27";
  p.el("checkOut").value = "2027-01-29";
  p.el("guests").value = "6";
  await p.context.runLive();
  return p;
}
async function runDemo(options) {
  const p = load("demo.html", { respond: nodeAnswers(options) });
  await p.fire("run", "click");
  return p;
}
const verifyGreen = (p) => p.el("verdict").classList.contains("pass") && p.el("verdict").textContent.startsWith("✓ Verified and safe to quote") && /<a href="https:/.test(p.el("facts").innerHTML);
const verifySaysGreenAnywhere = (p) => p.el("verdict").classList.contains("pass") || /safe to quote — signed/.test(p.el("verdict").textContent) || /<a href=/.test(p.el("facts").innerHTML);
const demoGreen = (p) => p.el("env").classList.contains("verified") && /<a class="env-cta" href="https:/.test(p.el("envBody").innerHTML);
const demoSaysGreenAnywhere = (p) => p.el("env").classList.contains("verified") || /Verified by your browser|<a /.test(p.el("envBody").innerHTML);
const demoLog = (p) => p.el("log").children.map((c) => c.innerHTML).join("\n");

// ── jws: the two pages' verifyJws ───────────────────────────────────────────
{
  const payload = offerFor("2027-01-27", "2027-01-29", 6);
  const jws = await node.sign(payload);
  for (const page of ["verify.html", "demo.html"]) {
    const { verifyJws } = load(page).context;
    const run = async (j, keys) => {
      try {
        return (await verifyJws(j, { keys })).ok === true;
      } catch {
        return false;
      }
    };
    check(`jws ${page}: a key labelled EdDSA and a genuine signature verify`, await run(jws, [node.pub]));
    for (const label of ["ES256", "none", "ed25519", "Ed25519", "", null, undefined]) {
      check(`jws ${page}: key alg ${label === undefined ? "absent" : JSON.stringify(label)} is refused`, !(await run(jws, [relabel(node.pub, label)])));
    }
    for (const header of [{ alg: "none", kid: node.kid }, { alg: "ES256", kid: node.kid }, { alg: "Ed25519", kid: node.kid }, { kid: node.kid }, { alg: "EdDSA" }]) {
      check(`jws ${page}: header ${JSON.stringify(header)} is refused`, !(await run(await node.sign(payload, header), [node.pub])));
    }
    check(`jws ${page}: a key that is not OKP/Ed25519 is refused`, !(await run(jws, [{ ...node.pub, kty: "EC", crv: "P-256" }])));
    check(`jws ${page}: a fourth part is refused`, !(await run(jws + ".extra", [node.pub])));
    check(`jws ${page}: an empty part is refused`, !(await run(jws.split(".").slice(0, 2).join(".") + ".", [node.pub])));
    check(`jws ${page}: a changed signature is refused`, !(await run(jws.slice(0, -8) + (jws.endsWith("AAAAAAAA") ? "BBBBBBBB" : "AAAAAAAA"), [node.pub])));
    check(`jws ${page}: another key with the same kid does not verify`, !(await run(jws, [{ ...log.pub, kid: node.kid }])));
  }
}

// ── offers: the same signed offers through both pages' whole flow ───────────
const OFFERS = [
  // [name, options, safe to quote?]
  ["a complete, fresh, available offer", {}, true],
  ["no total alias (price.total absent)", { change: (o) => delete o.price.total }, true],
  ["signed commission 9% beside intermediary none (the schema allows 0 only)", { change: (o) => (o.source_authority.booking_commission_pct = 9) }, false],
  ["the offer schema cannot be fetched", { schema: null }, false],
  ["the offer schema uses a keyword the pages do not apply", { schema: JSON.stringify({ ...OFFER_SCHEMA, $defs: { ...OFFER_SCHEMA.$defs, offerPayload: { ...OFFER_SCHEMA.$defs.offerPayload, oneOf: [{}] } } }) }, false],
  ["expired", { change: (o) => ((o.generated_at = iso(NOW - 1200000)), (o.valid_until = iso(NOW - 600000))) }, false],
  ["a lifetime of 901 seconds", { change: (o) => ((o.generated_at = iso(NOW - 1000)), (o.valid_until = iso(NOW + 900000))) }, false],
  ["generated_at two minutes ahead", { change: (o) => ((o.generated_at = iso(NOW + 120000)), (o.valid_until = iso(NOW + 600000))) }, false],
  ["valid_until malformed", { change: (o) => (o.valid_until = "soon") }, false],
  ["names another domain, books on another domain", { change: (o) => ((o.canonical_domain = "other.example"), (o.booking.direct_booking_url = "https://other.example/book")) }, false],
  ["names another domain, books on this one", { change: (o) => (o.canonical_domain = "other.example") }, false],
  ["booking URL on another domain", { change: (o) => (o.booking.direct_booking_url = "https://other.example/book") }, false],
  ["booking URL over http", { change: (o) => (o.booking.direct_booking_url = "http://" + HOST + "/book") }, false],
  ["no booking URL", { change: (o) => delete o.booking.direct_booking_url }, false],
  ["price not exact", { change: (o) => (o.price.exact = false) }, false],
  ["the host does not let agents quote it", { change: (o) => (o.agent_permission.may_quote_as_official_direct_offer = false) }, false],
  ["signed for other dates than asked", { change: (o) => ((o.request.check_in = "2027-02-01"), (o.request.check_out = "2027-02-03")) }, false],
  ["signed for another guest count than asked", { change: (o) => (o.request.guests = 2) }, false],
  ["signed dates that are not a stay", { change: (o) => (o.request.check_out = o.request.check_in) }, false],
  ["price with exact and nothing else", { change: (o) => (o.price = { exact: true }) }, false],
  ["price.agent_total null", { change: (o) => (o.price.agent_total = null) }, false],
  ["price.agent_total a decimal", { change: (o) => (o.price.agent_total = 1200.5) }, false],
  ["price.currency in lower case", { change: (o) => (o.price.currency = "eur") }, false],
  ["price.minor_unit absent", { change: (o) => delete o.price.minor_unit }, false],
  ["a required field absent (property)", { change: (o) => delete o.property }, false],
  ["protocol_version 9.9", { change: (o) => (o.protocol_version = "9.9") }, false],
  ["the returned offer differs from the signed one", { changeEnvelope: (e) => (e.offer.price.agent_total = 1) }, false],
  ["no returned offer beside the signature", { changeEnvelope: (e) => delete e.offer }, false],
  ["signed by a key labelled ES256", { key: relabel(node.pub, "ES256") }, false],
  ["signed with header alg none", { header: { alg: "none", kid: node.kid } }, false],
  ["the discovery document names another domain", { discovery: { ...DISCOVERY, canonical_domain: "other.example" } }, false],
  ["the discovery document declares another version", { discovery: { ...DISCOVERY, protocol_version: "9.9" } }, false],
  ["the offer endpoint is on another domain", { discovery: { ...DISCOVERY, verified_stay_offer_endpoint: "https://other.example/api/verified-stay-offer" } }, false],
];
for (const [name, options, safe] of OFFERS) {
  const v = await runVerify(options);
  const d = await runDemo(options);
  same(`offers, ${name}: verify.html shows it as safe to quote, with a link`, verifyGreen(v), safe);
  same(`offers, ${name}: demo.html shows it as verified, with a link`, demoGreen(d), safe);
  if (!safe) {
    check(`offers, ${name}: verify.html shows nothing green and no link`, !verifySaysGreenAnywhere(v), v.el("verdict").textContent);
    check(`offers, ${name}: demo.html shows nothing verified and no link`, !demoSaysGreenAnywhere(d), d.el("envBody").innerHTML);
    check(`offers, ${name}: demo.html says why, and does not blame the network`, /✕/.test(demoLog(d)) && !/momentarily unreachable/.test(demoLog(d)), demoLog(d).split("\n").pop());
  }
}
// The 0% and "No intermediary" words follow the signed payload, on both pages.
{
  const nine = { change: (o) => (o.source_authority.booking_commission_pct = 9) };
  const v9 = await runVerify(nine);
  const d9 = await runDemo(nine);
  check("offers, signed commission 9%: verify.html does not say 0% commission", !/0% commission/.test(v9.el("checks").innerHTML.replace(/commission: 9%/g, "")) && /No intermediary/.test(v9.el("checks").innerHTML), v9.el("checks").innerHTML.slice(-600));
  check("offers, signed commission 9%: demo.html does not say 0% commission", !/0% commission/.test(d9.el("envBody").innerHTML + demoLog(d9)), d9.el("envBody").innerHTML);
  const v0 = await runVerify({});
  const d0 = await runDemo({});
  check("offers, signed commission 0%: verify.html says so", /No intermediary, 0% commission/.test(v0.el("checks").innerHTML));
  check("offers, signed commission 0%: demo.html says so", /0% commission · paid direct to the host · no add-on fees/.test(d0.el("envBody").innerHTML), d0.el("envBody").innerHTML);
  const bare = { change: (o) => (delete o.source_authority, delete o.price.no_add_on_fees) };
  const dBare = await runDemo(bare);
  check("offers, nothing signed about commission or fees: demo.html claims neither under “Verified”", demoGreen(dBare) && !/commission|add-on/.test(dBare.el("envBody").innerHTML), dBare.el("envBody").innerHTML);
  check("offers, no source_authority signed: demo.html does not say “No middleman”", !/No middleman/.test(demoLog(dBare)) && /Nothing was altered\./.test(demoLog(dBare)), demoLog(dBare));
  check("offers, intermediary none signed: demo.html says “No middleman”", /Nothing was altered\. No middleman\./.test(demoLog(d0)), demoLog(d0));
}
// The demo's network: a status that is not a success, and a window that is not available.
{
  const down = load("demo.html", { respond: async (url) => (url.endsWith("/jwks.json") ? { status: 503, body: "{}" } : nodeAnswers({})(url)) });
  await down.fire("run", "click");
  check("demo.html, the JWKS answers 503: stopped, with the status, nothing verified", !demoSaysGreenAnywhere(down) && /answered HTTP 503/.test(demoLog(down)), demoLog(down));
  const none = await runDemo({ change: (o) => (o.availability.available = false) });
  check("demo.html, no window comes back available: nothing is called available or bookable", !demoSaysGreenAnywhere(none) && !/found an available window/.test(demoLog(none)) && /None of the five windows/.test(demoLog(none)), demoLog(none));
  const ok = await runDemo({});
  check("demo.html, a good run: the log shows the statuses received", (demoLog(ok).match(/→ <span class="ok">200<\/span>/g) ?? []).length === 4 && /found an available window/.test(demoLog(ok)), demoLog(ok));
}

// ── schema: the matrix comes from the schema, not from what a page reads ────
{
  check("schema: the pages are given the repository's schema, with the offer payload in it", OFFER_SCHEMA.$defs && typeof OFFER_SCHEMA.$defs.offerPayload === "object");
  const control = offerFor("2027-01-27", "2027-01-29", 6);
  const pagesValidate = ["verify.html", "demo.html"].every((page) => typeof load(page).context.schemaFaults === "function");
  check("schema: both pages define schemaFaults", pagesValidate);
  for (const page of pagesValidate ? ["verify.html", "demo.html"] : []) {
    const { schemaFaults, offerShapeFaults } = load(page).context;
    same(`schema ${page}: the control offer is valid under the offer schema`, JSON.stringify(schemaFaults(OFFER_SCHEMA, "#/$defs/offerPayload", control)), "[]");
    check(`schema ${page}: without a schema the shape is unknown, not valid`, offerShapeFaults(null, control).length === 1);
    for (const file of ["verified-stay-offer.signed.v0.1.json"]) {
      const example = JSON.parse(readFileSync(join(repoRoot, "examples", "conformance", file), "utf8"));
      same(`schema ${page}: the repository's example offer (${file}) is valid`, JSON.stringify(schemaFaults(OFFER_SCHEMA, "#/$defs/offerPayload", example.offer)), "[]");
    }
  }
  const { invalid, optional } = schemaMutations(OFFER_SCHEMA, "#/$defs/offerPayload", control);
  check("schema: the schema yields a matrix of forbidden changes", invalid.length >= 100, `found ${invalid.length}`);
  check("schema: the control offer carries optional members", optional.length >= 20, `found ${optional.length}`);
  // A page without the validator is still put through the matrix: what counts is what it shows.
  const schemaFaults = pagesValidate ? load("verify.html").context.schemaFaults : () => [];
  for (const m of invalid) {
    const changed = structuredClone(control);
    m.apply(changed);
    check(`schema, ${m.name}: the page's validator finds it`, schemaFaults(OFFER_SCHEMA, "#/$defs/offerPayload", changed).length > 0);
    const v = await runVerify({ change: m.apply });
    const d = await runDemo({ change: m.apply });
    check(`schema, ${m.name}: verify.html shows nothing green and no link`, !verifySaysGreenAnywhere(v), v.el("verdict").textContent);
    check(`schema, ${m.name}: demo.html shows nothing verified and no link`, !demoSaysGreenAnywhere(d), d.el("envBody").innerHTML);
  }
  // What the schema allows stays green: an optional member may be absent. The
  // three members other rules ask for are left to those rules.
  for (const m of optional) {
    const changed = structuredClone(control);
    m.apply(changed);
    same(`schema, optional ${m.name}: still valid under the schema`, JSON.stringify(schemaFaults(OFFER_SCHEMA, "#/$defs/offerPayload", changed)), "[]");
    const v = await runVerify({ change: m.apply });
    const d = await runDemo({ change: m.apply });
    check(`schema, optional ${m.name}: verify.html still shows it as safe to quote`, verifyGreen(v), v.el("verdict").textContent);
    check(`schema, optional ${m.name}: demo.html still shows it as verified`, demoGreen(d), demoLog(d).split("\n").pop());
  }
  // The seven the review found green, by name.
  for (const [name, change] of [
    ["node_id null", (o) => (o.node_id = null)],
    ["property without property_id", (o) => delete o.property.property_id],
    ["property_id empty", (o) => (o.property.property_id = "")],
    ["request.nights -7", (o) => (o.request.nights = -7)],
    ["property.name an object", (o) => (o.property.name = { unexpected: "value" })],
    ["availability.source false", (o) => (o.availability.source = false)],
    ["agent_permission without must_not_claim_ota_comparison_without_signed_ota_price", (o) => delete o.agent_permission.must_not_claim_ota_comparison_without_signed_ota_price],
  ]) {
    const v = await runVerify({ change });
    const d = await runDemo({ change });
    check(`schema, review case ${name}: verify.html is not green, and says the shape is why`, !verifySaysGreenAnywhere(v) && /does not have the VRP §5 shape/.test(v.el("verdict").textContent), v.el("verdict").textContent);
    check(`schema, review case ${name}: demo.html is not green, and says the shape is why`, !demoSaysGreenAnywhere(d) && /does not have the VRP §5 shape/.test(demoLog(d)), demoLog(d).split("\n").pop());
  }
}

// ── price: a signed amount as a person reads it ─────────────────────────────
for (const page of ["verify.html", "demo.html"]) {
  const { formatMoney } = load(page).context;
  check(`price ${page}: defines formatMoney`, typeof formatMoney === "function");
  if (typeof formatMoney !== "function") continue;
  for (const [amount, currency, minor, want] of [
    [120000, "EUR", true, "1200.00 EUR"],
    [5, "EUR", true, "0.05 EUR"],
    [0, "EUR", true, "0.00 EUR"],
    [590000, "SEK", true, "5900.00 SEK"],
    [5900, "SEK", false, "5900 SEK"],
    [120000, "EUR", false, "120000 EUR"],
    [12000, "JPY", true, "12000 JPY"],
    [1234567, "KWD", true, "1234.567 KWD"],
    [120000, "EUR", undefined, "120000 EUR (unit not stated)"],
    [120000, "ZZZ", true, "120000 minor units of ZZZ"],
    [120000, "ZZZ", false, "120000 ZZZ"],
    [null, "EUR", true, "—"],
    [1200.5, "EUR", true, "—"],
    [-1, "EUR", true, "—"],
    [1200, "eur", true, "—"],
  ]) {
    same(`price ${page}: ${JSON.stringify(amount)} ${currency}, minor_unit ${minor}`, formatMoney(amount, currency, minor), want);
  }
}
{
  const v = await runVerify({});
  check("price: verify.html shows 120000 minor units of EUR as 1200.00 EUR", /<dt>Total price<\/dt><dd>1200\.00 EUR<\/dd>/.test(v.el("facts").innerHTML), v.el("facts").innerHTML);
  const d = await runDemo({});
  check("price: demo.html shows 120000 minor units of EUR as 1200.00 EUR", /<div class="env-price">1200\.00 <span class="cur">EUR<\/span><\/div>/.test(d.el("envBody").innerHTML), d.el("envBody").innerHTML);
  const noAlias = await runVerify({ change: (o) => delete o.price.total });
  check("price: verify.html shows agent_total when the total alias is absent", /<dt>Total price<\/dt><dd>1200\.00 EUR<\/dd>/.test(noAlias.el("facts").innerHTML), noAlias.el("facts").innerHTML);
  const two = await runVerify({ change: (o) => (o.price.public_total = 130000) });
  check("price: verify.html quotes agent_total and names the website total beside it", /<dd>1200\.00 EUR {2}\(website total: 1300\.00 EUR\)<\/dd>/.test(two.el("facts").innerHTML), two.el("facts").innerHTML);
  const major = await runVerify({ change: (o) => ((o.price = { ...o.price, currency: "SEK", public_total: 5900, agent_total: 5900, total: 5900, minor_unit: false })) });
  check("price: verify.html shows 5900 SEK in major units as 5900 SEK", /<dt>Total price<\/dt><dd>5900 SEK<\/dd>/.test(major.el("facts").innerHTML), major.el("facts").innerHTML);
}

// ── lifetime: a result stands for its request, until valid_until ────────────
{
  const v = await runVerify({});
  check("lifetime verify.html: green while the offer is fresh", verifyGreen(v));
  v.advance(539000);
  check("lifetime verify.html: still green one second before valid_until", verifyGreen(v));
  v.advance(1000);
  check("lifetime verify.html: at valid_until it is shown as expired, without a link", !verifySaysGreenAnywhere(v) && /the offer has expired/.test(v.el("verdict").textContent), v.el("verdict").textContent);
  check("lifetime verify.html: the booking URL stays readable as text", /no link: this offer is not safe to quote/.test(v.el("facts").innerHTML));
  same("lifetime verify.html: no timer is left running", v.timers(), 0);
}
for (const field of ["host", "checkIn", "checkOut", "guests", "paste"]) {
  const v = await runVerify({});
  await v.fire(field, "input");
  check(`lifetime verify.html: editing ${field} takes the result down`, !verifySaysGreenAnywhere(v) && v.el("verdict").textContent === "" && v.el("resultSection").style.display === "none" && v.timers() === 0, v.el("verdict").textContent);
}
{
  // A new check starts: the old result is gone while it runs.
  let release;
  const hold = new Promise((r) => (release = r));
  const first = nodeAnswers({});
  let held = false;
  const p = load("verify.html", { respond: (url) => (held && url.includes("/api/verified-stay-offer") ? nodeAnswers({ hold })(url) : first(url)) });
  for (const [id, value] of Object.entries({ host: HOST, checkIn: "2027-01-27", checkOut: "2027-01-29", guests: "6" })) p.el(id).value = value;
  await p.context.runLive();
  check("lifetime verify.html: first result is green", verifyGreen(p));
  held = true;
  const second = p.context.runLive();
  await new Promise((r) => setImmediate(r));
  check("lifetime verify.html: while a new check runs, the earlier result is not on the page", !verifySaysGreenAnywhere(p) && p.el("btnLive").textContent === "Verifying…", p.el("verdict").textContent);
  // The person changes a field while that check is still out: its answer is for
  // a request the form no longer shows, and is not written.
  await p.fire("checkIn", "input");
  release();
  await second;
  check("lifetime verify.html: an answer to a request the form no longer shows is not written", !verifySaysGreenAnywhere(p) && p.el("verdict").textContent === "", p.el("verdict").textContent);
  same("lifetime verify.html: the button is free again", p.el("btnLive").textContent, "Fetch & verify");
}
// The other form is chosen: a result belongs to the form that asked for it.
{
  const shown = (p) => ({ verdict: p.el("verdict").textContent, section: p.el("resultSection").style.display, link: /<a href=/.test(p.el("facts").innerHTML) });
  const gone = (p) => !verifySaysGreenAnywhere(p) && shown(p).verdict === "" && shown(p).section === "none" && !shown(p).link && p.timers() === 0;
  // An invalid paste first, then a valid live offer, then back to the paste form.
  const p = load("verify.html", { respond: nodeAnswers({}) });
  await p.fire("tab-paste", "click");
  p.el("paste").value = "not an offer";
  await p.context.runPaste();
  check("lifetime verify.html, tabs: a pasted text that is not an offer is not green", !verifySaysGreenAnywhere(p) && shown(p).verdict !== "", shown(p).verdict);
  await p.fire("tab-live", "click");
  check("lifetime verify.html, tabs: choosing the live form takes the paste form's result down", gone(p), shown(p).verdict);
  for (const [id, value] of Object.entries({ host: HOST, checkIn: "2027-01-27", checkOut: "2027-01-29", guests: "6" })) p.el(id).value = value;
  await p.context.runLive();
  check("lifetime verify.html, tabs: the live form's own valid offer is green", verifyGreen(p), shown(p).verdict);
  await p.fire("tab-live", "click");
  check("lifetime verify.html, tabs: choosing the form already chosen changes nothing", verifyGreen(p), shown(p).verdict);
  await p.fire("tab-paste", "click");
  check("lifetime verify.html, tabs: choosing the paste form takes the live form's green result and its link down", gone(p), JSON.stringify(shown(p)));
  same("lifetime verify.html, tabs: the paste box keeps what was typed", p.el("paste").value, "not an offer");
  same("lifetime verify.html, tabs: the live form keeps what was typed", [p.el("host").value, p.el("checkIn").value, p.el("checkOut").value, p.el("guests").value].join(" "), HOST + " 2027-01-27 2027-01-29 6");
  await p.fire("tab-live", "click");
  check("lifetime verify.html, tabs: going back does not bring the old result back", gone(p), shown(p).verdict);
  await p.context.runLive();
  check("lifetime verify.html, tabs: a new check on the live form is green again", verifyGreen(p), shown(p).verdict);

  // A live check is still out when the paste form is chosen: its answer is not written.
  let release;
  const hold = new Promise((r) => (release = r));
  const q = load("verify.html", { respond: nodeAnswers({ hold }) });
  for (const [id, value] of Object.entries({ host: HOST, checkIn: "2027-01-27", checkOut: "2027-01-29", guests: "6" })) q.el(id).value = value;
  const running = q.context.runLive();
  await new Promise((r) => setTimeout(r, 20));
  same("lifetime verify.html, tabs: a live check is out", q.el("btnLive").textContent, "Verifying…");
  await q.fire("tab-paste", "click");
  release();
  await running;
  check("lifetime verify.html, tabs: a live check that ends after the paste form was chosen writes nothing", gone(q), JSON.stringify(shown(q)));
  same("lifetime verify.html, tabs: the live button is free again", q.el("btnLive").textContent, "Fetch & verify");
  q.advance(541000);
  check("lifetime verify.html, tabs: and nothing comes back later", gone(q), shown(q).verdict);

  // And the other way: a paste check is still out when the live form is chosen.
  let releasePaste;
  const holdPaste = new Promise((r) => (releasePaste = r));
  const answers = nodeAnswers({});
  const w = load("verify.html", { respond: async (url) => { if (url.endsWith("/.well-known/jwks.json")) await holdPaste; return answers(url); } });
  await w.fire("tab-paste", "click");
  w.el("paste").value = JSON.stringify({ signature: { jws: await node.sign(offerFor("2027-01-27", "2027-01-29", 6)) } });
  const pasting = w.context.runPaste();
  await new Promise((r) => setTimeout(r, 20));
  same("lifetime verify.html, tabs: a paste check is out", w.el("btnPaste").textContent, "Verifying…");
  await w.fire("tab-live", "click");
  releasePaste();
  await pasting;
  check("lifetime verify.html, tabs: a paste check that ends after the live form was chosen writes nothing", gone(w), JSON.stringify(shown(w)));
}
{
  const d = await runDemo({});
  check("lifetime demo.html: verified while the offer is fresh", demoGreen(d));
  d.advance(540000);
  check("lifetime demo.html: at valid_until nothing is shown as verified or bookable", !demoSaysGreenAnywhere(d) && /This offer expired at/.test(d.el("envBody").innerHTML), d.el("envBody").innerHTML);
}

// ── receipts: verify-receipt.html ───────────────────────────────────────────
const LOG_ID = "did:web:log.example";
const INNER = await node.sign(offerFor("2027-01-27", "2027-01-29", 2));
const INNER_BROKEN = INNER.slice(0, -8) + (INNER.endsWith("AAAAAAAA") ? "BBBBBBBB" : "AAAAAAAA");
const attestation = (layer, signature, from = NOW - 60000, until = NOW + 540000) => ({ layer, ...(signature === undefined ? {} : { signature }), valid_from: iso(from), valid_until: iso(until) });
async function receiptPage({ change, nodeKey = node.pub, logKey = log.pub, leaves = 1, proofTreeSize, headTreeSize, withProof = true, holdKeys } = {}) {
  const receipt = {
    vrp_receipt_version: "1.0",
    subject: { node: HOST, property_name: "Test stay", check_in: "2027-01-27", check_out: "2027-01-29", guests_count: 2, total_price: 1200, currency: "EUR" },
    issuer: { domain: HOST, did: "did:web:" + HOST },
    attestations: [attestation("offer", INNER)],
  };
  if (change) change(receipt);
  const jws = await node.sign(receipt);
  const artifact = "sha256:" + createHash("sha256").update(jws).digest("hex");
  const leaf = sha256([0], artifact);
  const other = sha256([0], "sha256:another-artifact");
  const root = leaves === 1 ? leaf : sha256([1], leaf, other);
  const sth = { root_hash: root.toString("base64url"), tree_size: headTreeSize ?? leaves, log_id: LOG_ID };
  const proof = {
    inclusion: { leaf_index: 0, tree_size: proofTreeSize ?? leaves, audit_path: leaves === 1 ? [] : [other.toString("base64url")] },
    signed_tree_head: sth,
    signature: { jws: await log.sign(sth) },
  };
  const { kid: logKid, ...logJwk } = logKey;
  const p = load("verify-receipt.html", {
    respond: async (url) => {
      if (url.includes("public_suffix_list")) return { status: 200, body: PSL };
      if (url.includes("gtlds.json")) return { status: 200, body: { gTLDs: [] } };
      if (url === "https://" + HOST + "/.well-known/jwks.json") {
        if (holdKeys) await holdKeys;
        return { status: 200, body: { keys: [nodeKey] } };
      }
      if (url.startsWith("https://" + HOST + "/.well-known/vrp/log/v0.1/proof?hash=")) return withProof ? { status: 200, body: proof } : { status: 404, body: "{}" };
      if (url === "https://log.example/.well-known/did.json") return { status: 200, body: { id: LOG_ID, verificationMethod: [{ id: LOG_ID + "#" + log.kid, publicKeyJwk: logJwk }] } };
      return { status: 404, body: "{}" };
    },
  });
  const view = () => ({
    verdict: p.el("verdict").textContent,
    cls: p.el("verdict").className,
    rows: p.el("checks").children.map((c) => c.className + " | " + c.innerHTML).join("\n"),
    shown: p.el("resultSection").style.display,
    ref: p.el("refbox").textContent,
  });
  const reference = (now = NOW) => verifyReceipt(receipt, { resolveJwks: () => ({ keys: [node.pub] }), now });
  return { p, jws, view, reference };
}
async function receiptRun(options) {
  const r = await receiptPage(options);
  r.p.el("paste").value = r.jws;
  await r.p.fire("btnVerify", "click");
  return { ...r.view(), reference: r.reference(), page: r };
}
const isGreen = (r) => /\bpass\b/.test(r.cls) && r.verdict.startsWith("VERIFIED");
{
  const good = await receiptRun();
  check("receipts: signed, anchored, every attestation inside its period — VERIFIED", isGreen(good), good.verdict);
  check("receipts: … and the reference verifier says fully_verified", good.reference.receipt_valid && good.reference.fully_verified);
  const two = await receiptRun({ leaves: 2 });
  check("receipts: the same in a tree of two leaves, with an audit path — VERIFIED", isGreen(two), two.verdict + "\n" + two.rows);

  // The node key's own alg label (Core §3).
  for (const label of ["ES256", "none", "ed25519", "", undefined]) {
    const r = await receiptRun({ nodeKey: relabel(node.pub, label) });
    check(`receipts: node key alg ${label === undefined ? "absent" : JSON.stringify(label)} — NOT VERIFIED, refused for its label`, r.verdict.startsWith("NOT VERIFIED") && /labelled alg/.test(r.verdict), r.verdict);
  }
  // The log operator's key (transparency-log §5.1): Ed25519, no label asked for.
  const unlabelled = await receiptRun({ logKey: relabel(log.pub, undefined) });
  check("receipts: log key without an alg label — still anchored, VERIFIED", isGreen(unlabelled), unlabelled.verdict);
  for (const label of ["ES256", "none", "ed25519"]) {
    const r = await receiptRun({ logKey: relabel(log.pub, label) });
    check(`receipts: log key labelled ${JSON.stringify(label)} — not anchored, not green`, !isGreen(r) && r.verdict.startsWith("SIGNATURE VERIFIED") && /not anchored/.test(r.verdict), r.verdict);
  }

  // receipt-v1 §3, §4, §6, against the reference verifier.
  const expired = await receiptRun({ change: (r) => ((r.attestations[0].valid_from = iso(NOW - 1200000)), (r.attestations[0].valid_until = iso(NOW - 600000))) });
  check("receipts: an attestation past valid_until — not green; signed and anchored, not fully verified", !isGreen(expired) && /\bwarn\b/.test(expired.cls) && expired.verdict.startsWith("SIGNED AND ANCHORED, NOT FULLY VERIFIED") && /validity period over/.test(expired.rows), expired.verdict);
  check("receipts: … the reference verifier: receipt_valid, not fully_verified, sig_expired", expired.reference.receipt_valid && !expired.reference.fully_verified && expired.reference.attestations[0].error === "sig_expired");
  const future = await receiptRun({ change: (r) => ((r.attestations[0].valid_from = iso(NOW + 600000)), (r.attestations[0].valid_until = iso(NOW + 1200000))) });
  check("receipts: an attestation before valid_from — not green; not fully verified", !isGreen(future) && future.verdict.startsWith("SIGNED AND ANCHORED, NOT FULLY VERIFIED") && /not valid yet/.test(future.rows), future.verdict);
  check("receipts: … the reference verifier: not_yet_valid", !future.reference.fully_verified && future.reference.attestations[0].error === "not_yet_valid");
  const noWindow = await receiptRun({ change: (r) => (delete r.attestations[0].valid_from, delete r.attestations[0].valid_until) });
  check("receipts: an attestation without a validity period — NOT VERIFIED", noWindow.verdict.startsWith("NOT VERIFIED") && /\bfail\b/.test(noWindow.cls) && /malformed_receipt/.test(noWindow.rows), noWindow.verdict);
  check("receipts: … the reference verifier: malformed_receipt", !noWindow.reference.receipt_valid && noWindow.reference.errors[0] === "malformed_receipt");
  const badWindow = await receiptRun({ change: (r) => (r.attestations[0].valid_until = "later") });
  check("receipts: a validity period that is not a time — NOT VERIFIED", badWindow.verdict.startsWith("NOT VERIFIED") && /missing_validity_window/.test(badWindow.rows), badWindow.verdict);
  check("receipts: … the reference verifier: not fully_verified, missing_validity_window", !badWindow.reference.fully_verified && badWindow.reference.attestations[0].error === "missing_validity_window");
  for (const version of ["999", "1", 1, undefined]) {
    const r = await receiptRun({ change: (x) => (version === undefined ? delete x.vrp_receipt_version : (x.vrp_receipt_version = version)) });
    check(`receipts: vrp_receipt_version ${JSON.stringify(version)} — NOT VERIFIED, unsupported_version`, r.verdict.startsWith("NOT VERIFIED") && /unsupported_version/.test(r.rows), r.verdict);
    check(`receipts: … the reference verifier refuses version ${JSON.stringify(version)} as well`, !r.reference.receipt_valid);
  }
  const noAtt = await receiptRun({ change: (r) => (r.attestations = []) });
  check("receipts: no attestation — NOT VERIFIED", noAtt.verdict.startsWith("NOT VERIFIED") && !noAtt.reference.receipt_valid, noAtt.verdict);

  // The inclusion proof and the signed tree head are about the same tree.
  const oneOfTwo = await receiptRun({ proofTreeSize: 1, headTreeSize: 2 });
  check("receipts: a proof for a tree of 1 under a signed tree head of 2 — not anchored, not green", !isGreen(oneOfTwo) && oneOfTwo.verdict.startsWith("SIGNATURE VERIFIED") && /for a tree of 1 leaves, the tree head for 2/.test(oneOfTwo.verdict), oneOfTwo.verdict);
  const twoOfOne = await receiptRun({ leaves: 2, headTreeSize: 3 });
  check("receipts: a proof for a tree of 2 under a signed tree head of 3 — not anchored, not green", !isGreen(twoOfOne) && /for a tree of 2 leaves, the tree head for 3/.test(twoOfOne.verdict), twoOfOne.verdict);
  const text = await receiptRun({ proofTreeSize: "1", headTreeSize: "1" });
  check("receipts: tree sizes given as text — not anchored, not green", !isGreen(text) && text.verdict.startsWith("SIGNATURE VERIFIED"), text.verdict);
  const none = await receiptRun({ withProof: false });
  check("receipts: no inclusion proof — signature only, not green", !isGreen(none) && none.verdict.startsWith("SIGNATURE VERIFIED") && /no inclusion proof was found/.test(none.verdict), none.verdict);
  const noneExpired = await receiptRun({ withProof: false, change: (r) => ((r.attestations[0].valid_from = iso(NOW - 1200000)), (r.attestations[0].valid_until = iso(NOW - 600000))) });
  check("receipts: no proof and an expired attestation — both are said", noneExpired.verdict.startsWith("SIGNATURE VERIFIED") && /1 of 1 attestation is outside its validity period now/.test(noneExpired.verdict), noneExpired.verdict);
  check("receipts: the period is called what it is, and nothing is said about the booking", /validity period the attestation itself carries/.test(expired.verdict) && !/promise in force|no longer|cancel/i.test(expired.verdict), expired.verdict);
}

// receipt-v1 §6, partial verification: each attestation has its own answer, and
// one that fails does not stop the others from being read.
{
  const rowOf = (r, n) => r.rows.split("\n").find((l) => l.includes("Attestation " + n + " (")) ?? "";
  // What the page shows for attestation n, in the reference verifier's words.
  const pageStatus = (row) =>
    /inside its validity period/.test(row) ? "verified" : /validity period over|not valid yet/.test(row) ? "expired" : /unverifiable/.test(row) ? "unverifiable" : /does not verify|no validity period/.test(row) ? "invalid" : "(no row)";
  for (const [name, attestations, verdictStart, cls] of [
    ["a broken signature first, a good one second", [attestation("offer", INNER_BROKEN), attestation("second", INNER)], "NOT VERIFIED", "fail"],
    ["a good signature first, a broken one last", [attestation("offer", INNER), attestation("second", INNER_BROKEN)], "NOT VERIFIED", "fail"],
    ["no signature on the first, a good one second", [attestation("offer", undefined), attestation("second", INNER)], "NOT VERIFIED", "fail"],
    ["a good one and an expired one", [attestation("offer", INNER), attestation("second", INNER, NOW - 1200000, NOW - 600000)], "SIGNED AND ANCHORED, NOT FULLY VERIFIED", "warn"],
    ["an expired one and a good one", [attestation("offer", INNER, NOW - 1200000, NOW - 600000), attestation("second", INNER)], "SIGNED AND ANCHORED, NOT FULLY VERIFIED", "warn"],
    ["three good ones", [attestation("offer", INNER), attestation("second", INNER), attestation("third", INNER)], "VERIFIED", "pass"],
    ["a good one, a broken one, an expired one, one without signature", [attestation("offer", INNER), attestation("second", INNER_BROKEN), attestation("third", INNER, NOW - 1200000, NOW - 600000), attestation("fourth", undefined)], "NOT VERIFIED", "fail"],
  ]) {
    const r = await receiptRun({ change: (x) => (x.attestations = attestations) });
    check(`receipts, ${name}: ${verdictStart}`, r.verdict.startsWith(verdictStart) && new RegExp("\\b" + cls + "\\b").test(r.cls), r.verdict);
    same(`receipts, ${name}: green only when the reference verifier says fully_verified`, isGreen(r), r.reference.fully_verified);
    attestations.forEach((_a, i) => {
      same(`receipts, ${name}: attestation ${i + 1} is shown as the reference verifier has it`, pageStatus(rowOf(r, i + 1)), r.reference.attestations[i].status);
    });
  }
}

// A receipt's result follows the clock and the pasted text.
{
  const r = await receiptRun();
  const page = r.page;
  check("receipts, lifetime: VERIFIED while the attestation is inside its period", isGreen(page.view()));
  page.p.advance(540000);
  check("receipts, lifetime: still VERIFIED at valid_until itself", isGreen(page.view()) && page.reference(NOW + 540000).fully_verified, page.view().verdict);
  page.p.advance(1000);
  check("receipts, lifetime: after valid_until it is no longer green, without anyone pressing anything", !isGreen(page.view()) && page.view().verdict.startsWith("SIGNED AND ANCHORED, NOT FULLY VERIFIED") && /validity period over/.test(page.view().rows), page.view().verdict);
  check("receipts, lifetime: … as the reference verifier has it then", !page.reference(NOW + 541000).fully_verified);
  same("receipts, lifetime: no timer is left running", page.p.timers(), 0);

  const bare = await receiptRun({ withProof: false });
  check("receipts, lifetime without a log proof: signature verified, nothing about the period", bare.verdict.startsWith("SIGNATURE VERIFIED") && !/outside its validity period/.test(bare.verdict), bare.verdict);
  bare.page.p.advance(541000);
  check("receipts, lifetime without a log proof: after valid_until the period is said too", bare.page.view().verdict.startsWith("SIGNATURE VERIFIED") && /1 of 1 attestation is outside its validity period now/.test(bare.page.view().verdict), bare.page.view().verdict);

  const early = await receiptRun({ change: (x) => (x.attestations = [attestation("offer", INNER, NOW + 600000, NOW + 1200000)]) });
  check("receipts, lifetime: not valid yet — not green", !isGreen(early) && /not valid yet/.test(early.rows), early.verdict);
  early.page.p.advance(600000);
  check("receipts, lifetime: at valid_from it becomes VERIFIED", isGreen(early.page.view()), early.page.view().verdict);
  early.page.p.advance(600001);
  check("receipts, lifetime: and after valid_until it is no longer green", !isGreen(early.page.view()) && /validity period over/.test(early.page.view().rows), early.page.view().verdict);

  const far = await receiptRun({ change: (x) => (x.attestations = [attestation("offer", INNER, NOW - 60000, NOW + 40 * 86400000)]) });
  far.page.p.advance(30 * 86400000);
  check("receipts, lifetime: a period longer than a timer can hold stays VERIFIED inside it", isGreen(far.page.view()), far.page.view().verdict);
  far.page.p.advance(10 * 86400000 + 1000);
  check("receipts, lifetime: … and is no longer green after it", !isGreen(far.page.view()), far.page.view().verdict);

  // The pasted text changes: the result is for a text the box no longer holds.
  for (const withProof of [true, false]) {
    const t = await receiptRun({ withProof });
    t.page.p.el("paste").value = "not a receipt";
    await t.page.p.fire("paste", "input");
    const v = t.page.view();
    check(`receipts, text changed (${withProof ? "with" : "without"} a log proof): the result is taken down`, v.verdict === "" && v.shown === "none" && v.rows === "" && v.ref === "" && t.page.p.timers() === 0, v.verdict);
    t.page.p.advance(541000);
    check(`receipts, text changed (${withProof ? "with" : "without"} a log proof): and nothing comes back later`, t.page.view().verdict === "", t.page.view().verdict);
  }
  // A check is still out when the text changes: its answer is not written.
  {
    let release;
    const holdKeys = new Promise((res) => (release = res));
    const slow = await receiptPage({ holdKeys });
    slow.p.el("paste").value = slow.jws;
    const running = slow.p.fire("btnVerify", "click");
    await new Promise((res) => setImmediate(res));
    same("receipts, a check in progress: the page says so", slow.view().verdict, "Verifying…");
    slow.p.el("paste").value = "something else";
    await slow.p.fire("paste", "input");
    release();
    await running;
    check("receipts, the text changed while a check was out: its answer is not written", slow.view().verdict === "" && slow.view().shown === "none" && slow.view().rows === "", slow.view().verdict);
  }
  // Two checks, the first one slower: the first one's answer does not replace the second's.
  {
    let release;
    let hold = new Promise((res) => (release = res));
    const two = await receiptPage({ holdKeys: { then: (f) => hold.then(f) } });
    two.p.el("paste").value = two.jws;
    const first = two.p.fire("btnVerify", "click");
    await new Promise((res) => setImmediate(res));
    two.p.el("paste").value = "x.y.z";
    const second = two.p.fire("btnVerify", "click");
    await second;
    const afterSecond = two.view().verdict;
    release();
    await first;
    check("receipts, two checks: the second one's answer stands", afterSecond.startsWith("NOT VERIFIED") && two.view().verdict === afterSecond, afterSecond + " / " + two.view().verdict);
  }
}

if (failures.length > 0) {
  console.error("\nWeb pages check failed:");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log(`\nWeb pages OK (verify.html, demo.html, verify-receipt.html: ${passed} checks).`);
