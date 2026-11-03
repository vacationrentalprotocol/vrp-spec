# AGENTS.md — vrp-spec

The Vacation Rental Protocol (VRP) specification: a static website
(`index.html`, `verify.html`, `styles.css`, …, deployed on Vercel), the spec
docs (`spec/`), JSON schemas (`schemas/`), JSON-LD contexts, and conformance
test vectors (`examples/conformance`). Node.js scripts validate the artifacts.

## Källan först — inga gissningar (VD 2026-11-03)

VRP är en global öppen standard. Ett felaktigt påstående kan skada den.

1. **Källan först.** Säg innan du svarar vilken primärkälla som avgör frågan, och läs den. Det snabbaste verktyget är inte källan.
2. **Varje påstående är märkt:** `mätt` (URL eller verktyg + UTC), `läst` (fil:rad@SHA, eller dokument + avsnitt) eller `inte kontrollerat`. Ett påstående utan märkning får inte stå.
3. **Ett verktygs sammanfattning är aldrig bevis.** Sökverktyg, AI-sammanfattningar och andra AI:s svar är ledtrådar. Bara rådata från källan räknas.
4. **En källa är en källa.** Dra aldrig slutsatser från ett verktyg om «webben», «alla», «aldrig» eller «ingen».
5. **Rekommendation först efter mätning.** Ingen slutsats och ingen rekommendation får bygga på något som är `inte kontrollerat`.
6. **Gamla anteckningar mäts om.** LAGE, ADR:er, minnen och sammanfattningar säger vad som gällde då. Mät igen innan något upprepas som läget nu.
7. **Fel rättas direkt och öppet:** vad som var fel, vilken källa som visar det rätta, och vilka andra påståenden som byggde på felet.
8. **Granskaren avvisar** varje påstående utan märkning, oavsett vilken AI som skrev det.

### Källkartan

| Frågan | Primärkällan |
|---|---|
| Är det live? | Produktionens URL: svaret läst, med UTC-tid |
| Vad står i koden eller specen? | Repot vid origin/main-SHA, fil:rad |
| Hämtar sökmotorer och AI-robotar sidorna? | Vercel Observability: `vercel.request.count` per `bot_name` och `request_hostname` |
| Är sidan indexerad, och för vilka sökord? | Google Search Console och Bing Webmaster Tools (ägarens data) |
| Kommer besökare från sökning eller AI? | Vercel Web Analytics per `referrerHostname` |
| Version och ägare på npm | registry.npmjs.org |
| PR, ärenden, granskningar, säkerhetsrapporter | GitHubs API |
| Vad kräver IETF, W3C, OpenID och andra standardorgan? | Originaldokumentet: ordagrant citat och avsnitt |
| Bokningar, betalningar och data | Supabase och Stripe: raden läst, med UTC-tid |

## Cursor Cloud specific instructions

- **No dependencies to install** — `package.json` declares none and there is no
  lockfile; the validation scripts use only Node's standard library. The startup
  update script intentionally does nothing for this repo.
- **Tests (offline):** `npm test` runs the full validation suite —
  `validate` + `verify-vectors` + `verify-attestations` + `verify-three-state` +
  `check-public-routes`, all against local fixtures (no network). Add the `:live`
  variants (e.g. `npm run check-public-routes:live`) to hit live URLs.
- **Generated pages.** Every Markdown document under `spec/` and `docs/` is
  rendered to an HTML page under `pages/` (`npm run build-pages`), served at
  the document's clean URL; the `.md` file stays as the Markdown twin for agents.
  After editing a `.md` file run `npm run build-pages` (and `npm run build-source-pack`
  when the file is in the source-pack manifest) and commit the output; CI fails
  on a stale page (`check-pages`). No other build step: to preview the site
  locally, serve the repo root with any static file server (e.g.
  `python3 -m http.server 4180`) and open `index.html` / `verify.html`.

## Source truth: sync to origin/main BEFORE reading or building

A stale local clone is the single most likely cause of a wrong conclusion —
reading old file content, or mistaking one repo's facts for another's. Before you
read source to make a claim, or start building:

- Run `git fetch origin && git switch main && git reset --hard origin/main`.
- Create the work branch FROM origin/main: `git switch -c <prefix>/<task> origin/main`.
- Do this for EVERY repo you touch — `vrp-spec`, `hemmabo-mcp-server`,
  `hemmabo-smart-stays` — because cross-repo claims require all of them current.
- NEVER assert a file's content, license, or status from a local clone without
  confirming it against origin/main (or prod). A stale clone is not evidence.
- Don't confuse repos: `vrp-spec` = CC0 (spec text); `hemmabo-mcp-server` =
  Apache-2.0 (reference code). Different licenses, different layers.
