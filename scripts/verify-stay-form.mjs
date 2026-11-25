// The stay form on verify.html and implement.html: two dates and a guest count.
//
// Both pages carry the same block of code for the three fields (VRP §5, §7):
//
//   - when check-in moves to or past check-out, check-out moves to a real later
//     date, and the check-out calendar offers no earlier day;
//   - fields that do not say a stay (a date missing or not in the calendar,
//     check-out not later than check-in, a check-in that has passed, a guest
//     count that is not a whole number of at least 1) are refused where the
//     person typed them, with the field named: verify.html fetches nothing,
//     implement.html signs nothing;
//   - nothing is rounded, defaulted or swapped on the way.
//
// This script holds the two copies of the block to each other, then runs each
// page's inline script unmodified in a Node `vm` context with a small stand-in
// document, a fixed clock and a recording fetch. Nothing leaves the machine.
//
// Run directly or via `npm test`:  node scripts/verify-stay-form.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import vm from "node:vm";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = ["verify.html", "implement.html"];
const html = Object.fromEntries(PAGES.map((p) => [p, readFileSync(join(repoRoot, p), "utf8")]));

let passed = 0;
const failures = [];
const check = (name, cond, detail = "") => {
  if (cond) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else failures.push(detail ? `${name} (${detail})` : name);
};
const same = (name, got, want) => check(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// The clock every run uses: Friday 2026-11-13, noon UTC. The first day the form
// takes is the day before the UTC date (§7), 2026-11-12.
const NOW = Date.parse("2026-11-13T12:00:00Z");
class FixedDate extends Date {
  constructor(...args) {
    if (args.length === 0) super(NOW);
    else super(...args);
  }
  static now() {
    return NOW;
  }
}

const START = "// ── the stay form: dates and guests (VRP §5, §7)";
const END = "// ── end of the stay form";
function block(page) {
  const text = html[page];
  const a = text.indexOf(START);
  const b = text.indexOf(END);
  return a >= 0 && b > a ? text.slice(a, b) : null;
}
check("verify.html carries the stay-form block", block("verify.html") !== null);
check("implement.html carries the stay-form block", block("implement.html") !== null);
check("the two copies of the block are the same text", block("verify.html") !== null && block("verify.html") === block("implement.html"));

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

// A page, loaded: its one inline script evaluated as served.
function load(page, { search = "", respond } = {}) {
  const elements = new Map();
  const state = { focused: null, fetched: [] };
  const element = (id) => ({
    id,
    value: "",
    min: "",
    hidden: true,
    textContent: "",
    innerHTML: "",
    className: "",
    disabled: false,
    style: {},
    attributes: {},
    listeners: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute(k, v) {
      this.attributes[k] = String(v);
    },
    getAttribute(k) {
      return k in this.attributes ? this.attributes[k] : null;
    },
    removeAttribute(k) {
      delete this.attributes[k];
    },
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    },
    focus() {
      state.focused = id;
    },
    scrollIntoView() {},
    querySelector: () => element(""),
    closest: () => null,
    appendChild() {},
  });
  const el = (id) => {
    if (!elements.has(id)) elements.set(id, element(id));
    return elements.get(id);
  };
  const fetch = async (url) => {
    url = String(url);
    state.fetched.push(url);
    const answer = respond ? respond(url) : null;
    if (!answer) throw new TypeError("Failed to fetch");
    return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, type: "basic", json: async () => JSON.parse(answer.body) };
  };
  const context = vm.createContext({
    crypto: webcrypto,
    atob,
    btoa,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    Date: FixedDate,
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    AbortController,
    fetch,
    navigator: { clipboard: { writeText: async () => {} } },
    location: { search, hash: "" },
    document: { getElementById: el, addEventListener() {}, querySelector: () => element(""), createElement: () => element("") },
  });
  context.window = context;
  const scripts = inlineScripts(html[page]);
  check(`${page}${search ? " " + search : ""}: one inline script`, scripts.length === 1, `found ${scripts.length}`);
  vm.runInContext(scripts[0] ?? "", context, { filename: page });
  const fire = (id, type = "change") => {
    for (const fn of el(id).listeners[type] ?? []) fn({ target: el(id), preventDefault() {} });
  };
  const set = (id, value, type) => {
    el(id).value = value;
    fire(id, type);
  };
  return { context, el, state, fire, set };
}

for (const page of PAGES) {
  check(`${page}: the form has a place for the stay message, announced and hidden until needed`,
    /<p id="stayError" class="stay-error" role="alert" hidden><\/p>/.test(html[page]));

  // ── what the three fields say ────────────────────────────────────────────
  const { readStay } = load(page).context;
  check(`${page}: defines readStay`, typeof readStay === "function");
  const says = (ci, co, g) => {
    const r = readStay(ci, co, g);
    return r.ok ? `ok ${r.check_in} ${r.check_out} guests=${JSON.stringify(r.guests)} nights=${JSON.stringify(r.nights)}` : `${r.field}: ${r.message}`;
  };
  const AFTER_20_JAN = "checkOut: Choose a check-out after 20 January 2027.";
  const GUESTS = "guests: Guests is a whole number, 1 or more.";
  const table = [
    ["a stay of two nights", ["2027-01-27", "2027-01-29", "2"], "ok 2027-01-27 2027-01-29 guests=2 nights=2"],
    ["check-out before check-in", ["2027-01-20", "2026-12-15", "2"], AFTER_20_JAN],
    ["check-out on the day of check-in", ["2027-01-20", "2027-01-20", "2"], AFTER_20_JAN],
    ["no check-out", ["2027-01-20", "", "2"], AFTER_20_JAN],
    ["a check-out that is not in the calendar", ["2027-01-20", "2027-02-30", "2"], AFTER_20_JAN],
    ["no check-in", ["", "2027-01-22", "2"], "checkIn: Choose a check-in date."],
    ["a check-in that is not in the calendar", ["2027-02-29", "2027-03-02", "2"], "checkIn: Choose a check-in date."],
    ["a check-in that is not a date", ["20 January", "2027-01-22", "2"], "checkIn: Choose a check-in date."],
    ["29 February in a leap year", ["2028-02-28", "2028-02-29", "1"], "ok 2028-02-28 2028-02-29 guests=1 nights=1"],
    ["over the end of February", ["2027-02-28", "2027-03-01", "1"], "ok 2027-02-28 2027-03-01 guests=1 nights=1"],
    ["over the end of the year", ["2026-12-31", "2027-01-01", "4"], "ok 2026-12-31 2027-01-01 guests=4 nights=1"],
    ["a long stay", ["2027-06-01", "2027-07-01", "12"], "ok 2027-06-01 2027-07-01 guests=12 nights=30"],
    ["check-in on the UTC date", ["2026-11-13", "2026-11-14", "2"], "ok 2026-11-13 2026-11-14 guests=2 nights=1"],
    ["check-in the day before the UTC date (still today somewhere)", ["2026-11-12", "2026-11-14", "2"], "ok 2026-11-12 2026-11-14 guests=2 nights=2"],
    ["check-in two days before the UTC date", ["2026-11-11", "2026-11-14", "2"], "checkIn: Check-in 11 November 2026 has passed. Choose a later check-in."],
    ["a check-in years ago", ["2020-01-01", "2020-01-02", "2"], "checkIn: Check-in 1 January 2020 has passed. Choose a later check-in."],
    ["no guests", ["2027-01-27", "2027-01-29", ""], GUESTS],
    ["0 guests", ["2027-01-27", "2027-01-29", "0"], GUESTS],
    ["-1 guests", ["2027-01-27", "2027-01-29", "-1"], GUESTS],
    ["2.5 guests", ["2027-01-27", "2027-01-29", "2.5"], GUESTS],
    ["2.0 guests", ["2027-01-27", "2027-01-29", "2.0"], GUESTS],
    ["1e2 guests", ["2027-01-27", "2027-01-29", "1e2"], GUESTS],
    ["guests in words", ["2027-01-27", "2027-01-29", "two"], GUESTS],
    ["more guests than a number holds", ["2027-01-27", "2027-01-29", "99999999999999999999"], GUESTS],
  ];
  for (const [name, args, want] of table) same(`${page}: ${name}`, says(...args), want);

  // ── the two date fields as one stay ──────────────────────────────────────
  {
    const p = load(page);
    const ci = p.el("checkIn");
    const co = p.el("checkOut");
    check(`${page}: opens on a stay (check-out later than check-in)`, /^\d{4}-\d{2}-\d{2}$/.test(ci.value) && co.value > ci.value, `${ci.value} → ${co.value}`);
    same(`${page}: the check-in calendar starts at the day before the UTC date`, ci.min, "2026-11-12");

    // The reported case: check-out 2026-12-15, then check-in 2027-01-20.
    p.set("checkIn", "2026-12-13");
    p.set("checkOut", "2026-12-15");
    p.set("checkIn", "2027-01-20");
    same(`${page}: check-in moved past check-out — check-out follows, same two nights`, co.value, "2027-01-22");
    same(`${page}: the check-out calendar starts the day after check-in`, co.min, "2027-01-21");

    p.set("checkOut", "2027-01-30");
    p.set("checkIn", "2027-01-25");
    same(`${page}: a check-out still later than check-in stays where it was put`, co.value, "2027-01-30");
    same(`${page}: … and its calendar starts the day after the new check-in`, co.min, "2027-01-26");

    p.set("checkIn", "2027-01-30");
    same(`${page}: check-in moved onto check-out — check-out follows, same five nights`, co.value, "2027-02-04");

    // One night, then check-in moved onto check-out, at three calendar edges.
    const moveOntoCheckOut = (from, to) => {
      p.set("checkIn", from);
      p.set("checkOut", to);
      p.set("checkIn", to);
      return co.value;
    };
    same(`${page}: over the end of the year`, moveOntoCheckOut("2027-12-30", "2027-12-31"), "2028-01-01");
    same(`${page}: onto 29 February in a leap year`, moveOntoCheckOut("2028-02-27", "2028-02-28"), "2028-02-29");
    same(`${page}: over the end of February in a common year`, moveOntoCheckOut("2027-02-27", "2027-02-28"), "2027-03-01");

    p.set("checkIn", "2027-05-01");
    p.set("checkOut", "2027-05-02");
    p.set("checkOut", "");
    p.set("checkIn", "2027-05-10");
    same(`${page}: an emptied check-out is filled when check-in is chosen`, co.value, "2027-05-11");

    p.set("checkIn", "", "input");
    same(`${page}: a check-in being typed (no value yet) moves nothing`, co.value, "2027-05-11");
    same(`${page}: … and the check-out calendar falls back to the UTC date`, co.min, "2026-11-13");

    p.set("checkIn", "2027-08-01", "input");
    same(`${page}: the input event moves check-out as the change event does`, co.value, "2027-08-02");
  }
}

// ── verify.html: nothing is fetched for fields that do not say a stay ──────
const DISCOVERY = JSON.stringify({
  protocol: "vacation-rental-protocol",
  protocol_version: "0.1",
  canonical_domain: "stay.example",
  jwks_url: "https://stay.example/.well-known/jwks.json",
  verified_stay_offer_endpoint: "https://stay.example/api/verified-stay-offer",
});
const node = (offerAnswer) => (url) => {
  if (url.endsWith("/.well-known/vacation-rental.json")) return { status: 200, body: DISCOVERY };
  if (url.endsWith("/.well-known/jwks.json")) return { status: 200, body: '{"keys":[]}' };
  if (url.includes("/api/verified-stay-offer")) return offerAnswer;
  return null;
};
async function live(fields, offerAnswer) {
  const p = load("verify.html", { respond: node(offerAnswer) });
  p.el("host").value = "stay.example";
  for (const [id, value] of Object.entries(fields)) p.el(id).value = value;
  await p.context.runLive();
  return p;
}
const REFUSED = { status: 400, body: '{"error":"checkout_must_be_after_checkin"}' };
for (const [name, fields, field, message] of [
  ["check-out before check-in", { checkIn: "2027-01-20", checkOut: "2026-12-15", guests: "2" }, "checkOut", "Choose a check-out after 20 January 2027."],
  ["no dates", { checkIn: "", checkOut: "", guests: "2" }, "checkIn", "Choose a check-in date."],
  ["a check-in that has passed", { checkIn: "2020-01-01", checkOut: "2020-01-02", guests: "2" }, "checkIn", "Check-in 1 January 2020 has passed. Choose a later check-in."],
  ["0 guests", { checkIn: "2027-01-27", checkOut: "2027-01-29", guests: "0" }, "guests", "Guests is a whole number, 1 or more."],
  ["2.5 guests", { checkIn: "2027-01-27", checkOut: "2027-01-29", guests: "2.5" }, "guests", "Guests is a whole number, 1 or more."],
  ["no guests", { checkIn: "2027-01-27", checkOut: "2027-01-29", guests: "" }, "guests", "Guests is a whole number, 1 or more."],
]) {
  const p = await live(fields, REFUSED);
  same(`verify.html, ${name}: nothing is fetched`, p.state.fetched.length, 0);
  same(`verify.html, ${name}: the form says what to do`, p.el("stayError").textContent, message);
  check(`verify.html, ${name}: the message is shown`, p.el("stayError").hidden === false);
  same(`verify.html, ${name}: the field is marked`, p.el(field).getAttribute("aria-invalid"), "true");
  same(`verify.html, ${name}: the field has the focus`, p.state.focused, field);
  p.set(field, field === "guests" ? "2" : "2027-03-01", "input");
  check(`verify.html, ${name}: the message goes when the field is edited`, p.el("stayError").hidden === true && p.el("stayError").textContent === "" && p.el(field).getAttribute("aria-invalid") === null);
}
{
  const p = await live({ checkIn: "2027-01-27", checkOut: "2027-01-29", guests: "2" }, REFUSED);
  const asked = p.state.fetched.find((u) => u.includes("/api/verified-stay-offer"));
  same("verify.html, a stay: the offer is asked for with the fields as typed", asked, "https://stay.example/api/verified-stay-offer?check_in=2027-01-27&check_out=2027-01-29&guests=2");
  check("verify.html, a stay: no stay message", p.el("stayError").hidden === true);
  // The node answered HTTP 400 with its own error code: the page says so, and
  // does not blame the domain or cross-origin access.
  const said = p.el("checks").innerHTML;
  check("verify.html, the node refuses with a code: the status and the code are shown", said.includes("answered HTTP 400 (checkout_must_be_after_checkin)."), said);
  check("verify.html, the node refuses with a code: the page says the host was reached", said.includes("The host was reached and refused the request"), said);
  check("verify.html, the node refuses with a code: no cross-origin or wrong-domain guess", !/cross-origin|domain is wrong/.test(said), said);
}
{
  const p = await live({ checkIn: "2027-01-27", checkOut: "2027-01-29", guests: "2" }, { status: 400, body: '{"error":"Verified and safe to quote"}' });
  const said = p.el("checks").innerHTML;
  check("verify.html, the node refuses with free text: the status is shown without the node's words", said.includes("answered HTTP 400.") && !said.includes("safe to quote"), said);
}
{
  const p = await live({ checkIn: "2027-01-27", checkOut: "2027-01-29", guests: "2" }, { status: 503, body: "<html>down</html>" });
  const said = p.el("checks").innerHTML;
  check("verify.html, the node refuses without JSON: the status is shown", said.includes("answered HTTP 503."), said);
}
{
  const p = await live({ checkIn: "2027-01-27", checkOut: "2027-01-29", guests: "2" }, null);
  const said = p.el("checks").innerHTML;
  check("verify.html, the node cannot be reached: the cross-origin and wrong-domain hint stays", /cross-origin/.test(said) && /domain is wrong/.test(said), said);
}

// A link that carries one date only, or two that are not a stay.
for (const [search, wantIn, wantOut] of [
  ["?host=stay.example&checkIn=2027-03-10", "2027-03-10", "2027-03-12"],
  ["?host=stay.example&checkIn=2027-03-10&checkOut=2027-03-01", "2027-03-10", "2027-03-12"],
  ["?host=stay.example&checkIn=2027-03-10&checkOut=2027-03-17", "2027-03-10", "2027-03-17"],
]) {
  const p = load("verify.html", { search });
  same(`verify.html ${search}: check-in`, p.el("checkIn").value, wantIn);
  same(`verify.html ${search}: check-out`, p.el("checkOut").value, wantOut);
  same(`verify.html ${search}: the check-out calendar starts the day after check-in`, p.el("checkOut").min, "2027-03-11");
}

// ── implement.html: nothing is signed for fields that do not say a stay ─────
async function sign(fields) {
  const p = load("implement.html");
  const all = { host: "my-stay.example", propName: "My Stay", checkIn: "2027-01-27", checkOut: "2027-01-30", guests: "2", currency: "EUR", total: "120000", ...fields };
  for (const [id, value] of Object.entries(all)) p.el(id).value = value;
  await p.context.run(false);
  return p;
}
{
  const p = await sign({});
  check("implement.html, a stay: signed, and the page's own check verifies it", p.el("verdict").textContent.startsWith("✓ Signature VALID"), p.el("verdict").textContent);
  const envelope = JSON.parse(p.el("offer").textContent || "{}");
  same("implement.html, a stay: the signed request is the stay as typed, with its real nights", JSON.stringify(envelope.offer?.request), '{"check_in":"2027-01-27","check_out":"2027-01-30","guests":2,"nights":3}');
  const signed = JSON.parse(Buffer.from(String(envelope.signature?.jws).split(".")[1] ?? "", "base64url").toString("utf8") || "{}");
  same("implement.html, a stay: the JWS payload carries the same request", JSON.stringify(signed.request), '{"check_in":"2027-01-27","check_out":"2027-01-30","guests":2,"nights":3}');
  same("implement.html, a stay: the total is the number typed", JSON.stringify([signed.price?.public_total, signed.price?.agent_total]), "[120000,120000]");
  same("implement.html, a stay: the booking URL carries the stay", signed.booking?.direct_booking_url, "https://my-stay.example/book?check_in=2027-01-27&check_out=2027-01-30&guests=2");
}
for (const [name, fields, field, message] of [
  ["check-out before check-in", { checkIn: "2027-01-20", checkOut: "2026-12-15" }, "checkOut", "Choose a check-out after 20 January 2027."],
  ["no dates", { checkIn: "", checkOut: "" }, "checkIn", "Choose a check-in date."],
  ["a check-in that has passed", { checkIn: "2020-01-01", checkOut: "2020-01-02" }, "checkIn", "Check-in 1 January 2020 has passed. Choose a later check-in."],
  ["2.5 guests", { guests: "2.5" }, "guests", "Guests is a whole number, 1 or more."],
  ["0 guests", { guests: "0" }, "guests", "Guests is a whole number, 1 or more."],
]) {
  const p = await sign(fields);
  same(`implement.html, ${name}: the form says what to do`, p.el("stayError").textContent, message);
  same(`implement.html, ${name}: the field has the focus`, p.state.focused, field);
  check(`implement.html, ${name}: nothing is signed or shown`, p.el("offer").textContent === "" && p.el("jwks").textContent === "" && p.el("privkey").textContent === "" && !/VALID/.test(p.el("verdict").textContent));
}
for (const total of ["", "1200.5", "-1", "1e5", "twelve"]) {
  const p = await sign({ total });
  check(`implement.html, total ${JSON.stringify(total)}: refused, nothing is signed`, p.el("verdict").textContent.startsWith("✕ Total price is a whole number of minor units") && p.el("offer").textContent === "", p.el("verdict").textContent);
}

if (failures.length > 0) {
  console.error("\nStay form check failed:");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log(`\nStay form OK (verify.html and implement.html: ${passed} checks).`);
