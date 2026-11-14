// Mutations of a schema-valid value, read off the schema itself.
//
// Given a JSON Schema (the keywords the VRP 0.1 schemas use) and a value that
// is valid under it, this lists every single change the schema forbids at a
// place the value has: a required member removed, a member the schema does not
// know added, a value of another type, another value than a const or an enum
// allows, a number under a minimum or over a maximum, a string shorter than
// minLength or outside a pattern. It also lists every optional member the
// value has, whose removal the schema allows.
//
// The test matrix for a page that says "schema-valid" comes from here, so it
// follows the schema and not the members a page happens to read.

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const typeOf = (v) =>
  v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" ? (Number.isInteger(v) ? "integer" : "number") : typeof v;
const allows = (types, v) => {
  const t = typeOf(v);
  return types.some((a) => a === t || (a === "number" && t === "integer"));
};

function resolve(root, ref) {
  let at = root;
  for (const part of ref.slice(2).split("/")) at = at?.[part.replace(/~1/g, "/").replace(/~0/g, "~")];
  return at;
}

/** Every schema object that applies at one place: the schema and what it refers to. */
function applicable(root, schema) {
  const out = [];
  let guard = 0;
  while (isObject(schema) && guard++ < 40) {
    out.push(schema);
    schema = typeof schema.$ref === "string" ? resolve(root, schema.$ref) : null;
  }
  return out;
}

const at = (value, path) => path.reduce((v, k) => v[k], value);
const label = (path) => (path.length ? path.map((k) => (typeof k === "number" ? "[" + k + "]" : "." + k)).join("").replace(/^\./, "") : "(the offer)");

/**
 * @returns {{ invalid: {name: string, apply: (v: any) => void}[], optional: {name: string, apply: (v: any) => void}[] }}
 *   `apply` changes a clone of the control value in place.
 */
export function schemaMutations(root, pointer, control) {
  const invalid = [];
  const optional = [];
  const set = (path, make) => (v) => {
    const parent = at(v, path.slice(0, -1));
    parent[path[path.length - 1]] = make();
  };
  const remove = (path) => (v) => {
    delete at(v, path.slice(0, -1))[path[path.length - 1]];
  };

  function walk(schema, path) {
    const value = at(control, path);
    const schemas = applicable(root, schema);
    const replaceable = path.length > 0;
    for (const s of schemas) {
      if (replaceable && "type" in s) {
        const types = Array.isArray(s.type) ? s.type : [s.type];
        for (const candidate of ["x", 7, 7.5, true, null, {}, []]) {
          if (!allows(types, candidate)) invalid.push({ name: `${label(path)} is ${typeOf(candidate)}`, apply: set(path, () => structuredClone(candidate)) });
        }
      }
      if (replaceable && "const" in s) invalid.push({ name: `${label(path)} is not the value the schema fixes`, apply: set(path, () => (s.const === "other" ? "another" : "other")) });
      if (replaceable && Array.isArray(s.enum)) invalid.push({ name: `${label(path)} is outside the schema's list`, apply: set(path, () => "not-in-the-list") });
      if (replaceable && typeof value === "number") {
        if ("minimum" in s) invalid.push({ name: `${label(path)} is under ${s.minimum}`, apply: set(path, () => s.minimum - 1) });
        if ("maximum" in s) invalid.push({ name: `${label(path)} is over ${s.maximum}`, apply: set(path, () => s.maximum + 1) });
      }
      if (replaceable && typeof value === "string") {
        if (s.minLength >= 1) invalid.push({ name: `${label(path)} is empty`, apply: set(path, () => "") });
        if (typeof s.pattern === "string") {
          const re = new RegExp(s.pattern, "u");
          const off = ["not the form", "x", "0000-00-00", "http://x"].find((c) => !re.test(c));
          if (off !== undefined) invalid.push({ name: `${label(path)} is ${JSON.stringify(off)}`, apply: set(path, () => off) });
        }
      }
      if (isObject(value)) {
        const props = isObject(s.properties) ? s.properties : {};
        const required = Array.isArray(s.required) ? s.required : [];
        for (const k of required) {
          if (k in value) invalid.push({ name: `${label([...path, k])} is absent`, apply: remove([...path, k]) });
        }
        if (s.additionalProperties === false) invalid.push({ name: `${label([...path, "zz_unknown"])} is added`, apply: set([...path, "zz_unknown"], () => 1) });
        for (const k of Object.keys(props)) {
          if (!(k in value)) continue;
          if (!required.includes(k)) optional.push({ name: `${label([...path, k])} is absent`, apply: remove([...path, k]) });
          walk(props[k], [...path, k]);
        }
      }
      if (Array.isArray(value) && isObject(s.items)) value.slice(0, 2).forEach((_item, i) => walk(s.items, [...path, i]));
    }
  }
  walk(resolve(root, pointer), []);
  return { invalid, optional };
}
