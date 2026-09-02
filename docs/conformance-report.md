# Conformance report v0.1

A conformance report records **one run of one verifier against one named VRP conformance corpus**, in a form a stranger can re-run and compare. It answers three questions and nothing else: what code ran, against which exact vectors, and what came out per vector.

It is **score-free**. There is no number to rank by. A report is not a trust, safety, compliance, certification or whole-agent verdict. It is not a registry of nodes and not a catalogue of implementations.

## The three parts

1. **Per-vector outcomes.** Every vector in the corpus gets exactly one of five outcomes:

   | Outcome | Meaning |
   | --- | --- |
   | `pass` | The engine's observed result equals the vector's `expected` block, and the vector expects acceptance. |
   | `reject-as-required` | The observed result equals `expected`, and the vector expects rejection. |
   | `not-exercised` | The vector was not run (excluded, unsupported, skipped). |
   | `inconclusive` | The engine ran but the observed result does not equal `expected`, or evidence is incomplete. |
   | `void` | The run could not produce a result at all (infrastructure unavailable, harness error). |

   Missing evidence never becomes `pass`.

2. **Reproducibility binding.** The report names the engine (repository, revision, file digest), the corpus (path, version, content digest), the configuration, the runtime environment and the run instant. Two parties with the same binding should get the same outcomes.

3. **Declared must-fail controls.** At least one vector the engine MUST reject is declared up front. If a declared control is observed as anything but `reject-as-required`, the report sets `discriminates: false`: the harness cannot tell the relevant behavior apart, and no aggregate may be published from it.

An **aggregate** is optional and consists of counts only: the full denominator, how many vectors were exercised, how many were distinguished (`pass` plus `reject-as-required`). `not-exercised`, `inconclusive` and `void` can never raise the distinguished count.

## Artifacts

- JSON Schema: `https://vacationrentalprotocol.com/schemas/conformance-report-v0.1.schema.json`
- Filled example, reference verifier against the signed-offer corpus: `https://vacationrentalprotocol.com/examples/conformance/reports/offer.reference-verifier.v0.1.json`

The example covers exactly one corpus, `examples/conformance/offer/` (five self-describing signed-offer vectors). Its declared must-fail control is `03-tampered-signature`. Other VRP corpora (`receipt/`, `stayintent/`, the three-state fixtures, the attestation bundle) are reported separately, one report each.

## Corpus digest

A directory corpus is digested as the `sha256sum` manifest of its `*.json` files in `LC_ALL=C` sort order, then the SHA-256 of that manifest text:

```bash
cd examples/conformance/offer && ls *.json | LC_ALL=C sort | xargs sha256sum | sha256sum
```

The `method` field in the report carries this command so the digest can be recomputed without reading this page.

## Producing a report for your own verifier

1. Run your verifier over every vector in one corpus, using each vector's embedded `jwks`, `input` and `clock`.
2. For each vector, record `expected` (copied from the vector) and `observed` (what your verifier returned, same shape).
3. Assign the outcome by the table above.
4. Bind engine, corpus digest, config, environment and `run_at`.
5. Declare the must-fail controls you ran and what you observed.
6. Validate the file against the schema. Publish it wherever you like; VRP keeps no registry of reports.

## License

Specification text on this page and the schema under `schemas/` are [CC0 1.0](../LICENSE). The conformance vectors and the example report under `examples/conformance/`, and any harness under `scripts/`, are [Apache-2.0](../LICENSE-CODE), which carries the royalty-free patent grant. See the [README license table](../README.md#license).
