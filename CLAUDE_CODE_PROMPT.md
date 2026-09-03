> **HISTORICAL ARTEFACT — DO NOT USE AS DOCUMENTATION.**
>
> This is the original scaffolding prompt used to generate the first version of
> the React client. It is kept for provenance, because the dissertation describes
> how the client was built.
>
> **It describes an API that no longer exists.** Since it was written the server
> has gained fuzzy name matching, unrecognised-drug reporting, synonym redirects
> and the whole predicted tier; `/api/stats` and `/api/drugs/search` both return
> different shapes now. For the current API see **`README.md`**, and for the
> severity model see **`ml/README.md`**.

# Claude Code Prompt — SynerGuard React Frontend

Copy everything inside the code block below and paste it into the Claude Code
agent in Antigravity (with this project folder open). It builds the React client
that talks to the Express API already in `/server`.

Make sure the backend is running first: `cd server && npm install && npm run dev`

---

```
I'm building SynerGuard, a drug–drug interaction checker for a university
dissertation. The backend is already built and running — an Express API in the
/server folder that serves data from JSON files in memory (no database). I need
you to build the React frontend in a /client folder using Vite.

## Backend API (already working — do NOT rebuild it)

Base URL: http://localhost:5000

1. GET /api/stats
   -> { drugs: 2691, interactions: 314068, richRecords: 79 }

2. GET /api/drugs/search?q=warf
   -> ["Warfarin", "(R)-warfarin", ...]   (array of drug name strings)

3. POST /api/check   body: { "drugs": ["Warfarin","Ibuprofen","Aspirin"] }
   -> {
        totalPairs: 3,
        flagged: 2,
        counts: { Major: 2, Moderate: 0, Minor: 0, Unknown: 0 },
        interactions: [
          {
            drugA: "Ibuprofen", drugB: "Warfarin",
            severity: "Major",              // Major | Moderate | Minor | Unknown
            description: "...",             // may be present
            hasRich: true,                  // if true, the fields below exist
            mechanism: "...",
            clinicalEffect: "...",
            saferAlternative: "Acetaminophen (Paracetamol)",
            clinicalManagement: "..."
          }
        ],
        food: [
          { name: "Warfarin", foodInteractions: ["Avoid vitamin K rich foods...", ...] }
        ]
      }

## What to build

A single-page React app (Vite + plain CSS or CSS modules — no Tailwind needed)
with these features:

1. A drug search box with live autocomplete that calls /api/drugs/search as the
   user types (debounce ~200ms). Selecting a result adds it as a removable chip.

2. A list of selected drugs shown as chips. "Analyse regimen" button is disabled
   until at least 2 drugs are selected.

3. On analyse, POST the selected drugs to /api/check and render results:
   - A summary row: counts of Major / Moderate / Minor / "No flag" (totalPairs - flagged).
   - Each interaction as an expandable card, sorted by severity (already sorted by API).
     * Card header: drugA + drugB, a "Curated" badge if hasRich, and a severity pill.
     * Severity colour coding: Major = red, Moderate = amber/orange, Minor = green,
       Unknown = grey. Use a coloured left border on each card too.
     * Expanded body: description, and for curated records show Mechanism,
       Clinical effect, Safer alternative (highlight this in green), and Management.
   - A "Food & supplement notes" section listing food warnings for selected drugs.

4. A Clinician / Plain mode toggle. In Plain mode, hide the Mechanism rows and
   keep the language simpler (just hide the clinical-only detail, don't refetch).

5. A prominent medical disclaimer near the results: this is an educational
   decision-support tool, does not account for dose/patient history, and every
   decision must be confirmed by a qualified prescriber or pharmacist.

## Design direction

Clinical, calm, trustworthy — a medical safety tool, not a consumer app.
- Dark navy (#12161c) top bar with a teal (#0f6b6b) accent line.
- Light blue-grey page background (#eef1f5), white cards.
- A serif display face (e.g. Newsreader) for the main headline, a clean sans
  (e.g. IBM Plex Sans) for everything else, mono (IBM Plex Mono) for stats.
- Severity must be readable at a glance through colour + a text label.
- Show the /api/stats numbers in the header ("2,691 drugs indexed", etc).
- Responsive down to mobile; visible keyboard focus.

## Project setup

- Create /client with Vite (React).
- Add a vite proxy so /api calls go to http://localhost:5000 in dev.
- Structure: components for SearchBox, DrugChips, ResultsSummary,
  InteractionCard, FoodNotes, Disclaimer.
- Keep API calls in a small src/api.js helper.

Start by scaffolding the Vite app, then build the components one by one. After
it's working, show me how to run both server and client together.
```

---

## After the agent finishes

Two terminals:

1. **Server** — `cd server && npm install && npm run dev`
2. **Client** — `cd client && npm install && npm run dev`

Then open the client URL (usually http://localhost:5173).
