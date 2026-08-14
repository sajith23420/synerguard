# SynerGuard — client

React 19 + Vite frontend for the drug interaction checker. Talks to the Express
API in `../server`; it holds no data of its own.

```bash
npm install
npm run dev      # http://localhost:5173
```

`vite.config.js` proxies `/api` to `http://localhost:5000`, so **the server must
be running** or every request 404s. Start it first (`cd ../server && npm run dev`).

| Script | Does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production bundle into `dist/` |
| `npm run preview` | Serve the built bundle |
| `npm run lint` | Oxlint |

## Structure

```
src/
├── App.jsx          # state, filtering, sorting, layout
├── api.js           # the three API calls
├── index.css        # design system — tokens, light/dark themes, print styles
└── components/
```

| Component | Role |
|---|---|
| `SearchBox` | Autocomplete with typo tolerance; can add an unrecognised name |
| `DrugChips` | Selected drugs; unrecognised ones marked as unscreened |
| `UnknownDrugsNotice` | Names not in the database, with "did you mean…?" |
| `PredictionToggle` | Opt in to ML estimates — off by default |
| `UnpredictableNotice` | Pairs the model declined to estimate, and why |
| `ResultsSummary` | Severity tiles |
| `ResultsToolbar` | Severity filters, sort, expand all, print |
| `InteractionCard` | One interaction; expands to mechanism and management |
| `FoodNotes` | Food and supplement warnings |
| `Disclaimer` | Medical disclaimer — always rendered, not only after a check |
| `ModeToggle` | Clinician / plain-language wording |
| `ThemeToggle` | Light / dark |

## The four tiers

Results carry different grades of evidence, and the UI keeps them apart on
purpose — an estimate must never read as a verified fact:

| Tier | Shown as |
|---|---|
| **Curated** (79) | Green `Curated` badge; mechanism, management, safer alternative |
| **Known** | Severity badge from the source data |
| **Predicted** (56,342) | Violet dashed `Predicted · 94%` badge, **behind an opt-in toggle** |
| **Unknown** | Left as Unknown, with a stated reason where one applies |

`effectiveSeverity()` in `App.jsx` decides what a row is filtered, sorted and
counted by. A predicted severity only takes effect once the user opts in;
otherwise the pair stays at Unknown, where the source data puts it. The raw
`severity` field is never rewritten.

Predicted styling is dashed as well as violet, and the dash is forced in the
print stylesheet — on paper the colour is gone, and colour alone must not be the
only thing separating an estimate from a graded severity.

## Theming

Light and dark both supported. `ThemeToggle` writes `data-theme` on `<html>`;
with no explicit choice the OS preference wins. Tokens live at the top of
`index.css` — violet (`--color-predicted`) is reserved for ML estimates and used
nowhere else.
