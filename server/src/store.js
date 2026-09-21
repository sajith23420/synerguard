/**
 * In-memory data store.
 *
 * On startup we read the two newline-delimited JSON files once and build fast
 * lookup structures. No database needed — 314k interactions sit comfortably in
 * memory and every lookup is O(1) via a Map keyed on the sorted drug pair.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_DIR = path.join(__dirname, 'data');
const SEV_ORDER = { Major: 3, Moderate: 2, Minor: 1, Unknown: 0 };
const GRADED = ['Major', 'Moderate', 'Minor'];

/**
 * Minimum graded interactions a drug needs before the severity model's estimate
 * for it means anything. Held-out testing showed the model collapses to roughly
 * chance (macro-F1 0.34) for drugs with no history — it learned per-drug
 * tendencies, not pharmacology. Below this we refuse to guess and say why.
 *
 * This mirrors MIN_HISTORY in ml/04_export.py. If the two drift apart the app
 * will warn about pairs the export happily predicted, or stay silent about ones
 * it skipped.
 */
const MIN_LABELLED_HISTORY = 5;

/**
 * Synonym redirects, applied at resolution time only.
 *
 * The merged source datasets name the same substance in more than one way, and
 * the two spellings did not receive the same coverage. 'Aspirin' carries 2
 * interaction pairs; 'Acetylsalicylic acid' — the same drug under its systematic
 * name — carries 864. A prescriber who types the common name therefore screened
 * a regimen against 2 interactions and saw nothing wrong, which is the precise
 * silent failure this tool exists to prevent.
 *
 * The fix is deliberately NOT a data merge. Both entries stay in drugs.json and
 * both keep counting toward the published totals, so every figure reported in
 * the write-up still describes the data as it was analysed. What changes is only
 * which entry a *search* lands on.
 *
 * Three rules govern entries here:
 *   1. Same substance, not same class. 'Oral Contraceptives' is not a synonym
 *      for Levonorgestrel, and a combination such as
 *      'Trimethoprim/Sulfamethoxazole' is not a synonym for either component —
 *      redirecting those would silently drop half of what the user asked about.
 *   2. Both names must exist in drugs.json, and the target must be the
 *      better-covered of the two. Verified at startup; a broken entry warns
 *      loudly rather than failing quietly.
 *   3. The substitution is always shown to the user. Search results and
 *      /check both report which name was matched, so the redirect is visible
 *      rather than silent — see `substitutions` in the check response.
 *
 * Keys are normalised (lowercase, alphanumeric only); values are canonical
 * display names as they appear in drugs.json.
 */
const DRUG_ALIASES = new Map([
  ['aspirin', 'Acetylsalicylic acid'],  // 2 pairs -> 864
  ['alcohol', 'Ethanol'],               // 1 pair  -> 674

  // British Approved / INN spellings. Sri Lankan prescribing follows the BNF,
  // but the merged datasets are US-named throughout, so these were dead ends:
  // the name simply did not resolve and the drug dropped out of the screen.
  // Each source name below was checked to be absent from drugs.json in its own
  // right, so nothing is being shadowed — these add reach rather than redirect
  // it. Rule 1 still applies, which is why 'hyoscine' is NOT here: hyoscine
  // butylbromide is not scopolamine, and guessing between them is exactly the
  // ambiguity the rule forbids.
  ['paracetamol', 'Acetaminophen'],
  ['glibenclamide', 'Glyburide'],
  ['thyroxine', 'Levothyroxine'],
  ['sodiumvalproate', 'Valproic acid'],
  ['frusemide', 'Furosemide'],
  ['pethidine', 'Meperidine'],
  ['lignocaine', 'Lidocaine'],
  ['chlorphenamine', 'Chlorpheniramine'],
  ['adrenaline', 'Epinephrine'],
  ['noradrenaline', 'Norepinephrine'],
  ['ciclosporin', 'Cyclosporine'],
  ['oestradiol', 'Estradiol'],
  ['amoxycillin', 'Amoxicillin'],
  ['dexamfetamine', 'Dextroamphetamine'],
  ['colestyramine', 'Cholestyramine'],
]);

// Public state (populated by load())
const state = {
  drugs: [],              // [{ name, nameLower, foodInteractions }]
  drugNames: [],          // [name] for autocomplete
  byLower: new Map(),     // nameLower -> canonical name
  byNormalised: new Map(),// normalise(name) -> canonical name
  interactionsByKey: new Map(), // "a||b" -> record
  foodByLower: new Map(), // nameLower -> { name, foodInteractions }
  labelledHistory: new Map(), // nameLower -> count of graded interactions
  equivalents: new Map(),     // canonical nameLower -> [every nameLower for that substance]
  hasPredictions: false,  // was predictions.json present at startup?
  stats: { drugs: 0, interactions: 0, richRecords: 0, predicted: 0 },
  ready: false,
};

/**
 * Loose key for matching user input against drug names: lowercase, and strip
 * everything that isn't a letter or digit. Lets "(R)-warfarin" match "r warfarin"
 * and "co-trimoxazole" match "cotrimoxazole".
 */
function normalise(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function readNdjson(file, onDoc) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(file),
      crlfDelay: Infinity,
    });
    rl.on('line', (line) => {
      const t = line.trim();
      if (t) {
        try { onDoc(JSON.parse(t)); } catch (_) { /* skip bad line */ }
      }
    });
    rl.on('close', resolve);
    rl.on('error', reject);
  });
}

async function load() {
  const t0 = Date.now();

  // drugs
  await readNdjson(path.join(DATA_DIR, 'drugs.json'), (d) => {
    state.drugs.push(d);
    state.drugNames.push(d.name);
    state.byLower.set(d.nameLower, d.name);
    // First name wins, so "Warfarin" beats "(R)-warfarin" for the key "warfarin"
    const norm = normalise(d.name);
    if (!state.byNormalised.has(norm)) state.byNormalised.set(norm, d.name);
    if (d.foodInteractions && d.foodInteractions.length) {
      state.foodByLower.set(d.nameLower, { name: d.name, foodInteractions: d.foodInteractions });
    }
  });

  // A stale alias is worse than no alias: it would silently resolve to nothing
  // and the drug would drop out of the screen. Check the map against the data
  // as soon as the names are loaded, and say so loudly if it has drifted.
  for (const [key, target] of DRUG_ALIASES) {
    const canonical = state.byLower.get(target.toLowerCase());
    const source = state.byNormalised.get(key);

    if (!canonical) {
      console.warn(`Alias '${key}' points at '${target}', which is not in drugs.json — ignored.`);
      continue;
    }
    if (!source) {
      console.warn(`Alias key '${key}' matches no drug name — it can never fire.`);
      continue;
    }

    // Reverse the map so a pair lookup can try BOTH names. The redirect decides
    // which entry the user lands on; this decides which records that entry can
    // see, and the two are not the same question.
    const lower = canonical.toLowerCase();
    const variants = state.equivalents.get(lower) || [lower];
    if (!variants.includes(source.toLowerCase())) variants.push(source.toLowerCase());
    state.equivalents.set(lower, variants);
  }

  // interactions
  let rich = 0;
  await readNdjson(path.join(DATA_DIR, 'interactions.json'), (rec) => {
    const existing = state.interactionsByKey.get(rec.pairKey);
    if (
      !existing ||
      rec.hasRich ||
      (SEV_ORDER[rec.severity] || 0) > (SEV_ORDER[existing.severity] || 0)
    ) {
      state.interactionsByKey.set(rec.pairKey, rec);
    }
    if (rec.hasRich) rich++;
  });

  // How many graded interactions each drug has. Counted from the deduped map so
  // it matches exactly what the export script saw, and used to decide whether a
  // missing prediction is "not confident" or "not enough data to try".
  for (const rec of state.interactionsByKey.values()) {
    if (!GRADED.includes(rec.severity)) continue;
    state.labelledHistory.set(rec.drugALower, (state.labelledHistory.get(rec.drugALower) || 0) + 1);
    state.labelledHistory.set(rec.drugBLower, (state.labelledHistory.get(rec.drugBLower) || 0) + 1);
  }

  const predicted = await loadPredictions();

  state.stats = {
    drugs: state.drugs.length,
    interactions: state.interactionsByKey.size,
    richRecords: rich,
    predicted,
  };
  state.ready = true;
  console.log(
    `Data loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s — ` +
    `${state.stats.drugs} drugs, ${state.stats.interactions} interaction pairs, ` +
    `${state.stats.richRecords} curated, ${state.stats.predicted} predicted.`
  );
}

/**
 * Attach ML severity estimates from predictions.json, if it exists.
 *
 * Two rules hold this apart from the source data, and both matter more than the
 * feature itself:
 *   1. `severity` is never written to. A prediction lands in its own fields, so
 *      nothing downstream can mistake an estimate for a graded interaction.
 *   2. Only records already sitting at `Unknown` are touched, so a prediction
 *      can never overwrite — or quietly downgrade — a real grade.
 *
 * The file is optional. Without it the app is exactly what it was before: a
 * lookup over curated and known data. It is generated by ml/04_export.py and
 * committed as data, so no Python is needed to run the server.
 */
async function loadPredictions() {
  const file = path.join(DATA_DIR, 'predictions.json');
  if (!fs.existsSync(file)) {
    console.log('No predictions.json — running without the predicted tier.');
    return 0;
  }
  state.hasPredictions = true;

  let attached = 0;
  let skipped = 0;
  await readNdjson(file, (p) => {
    const rec = state.interactionsByKey.get(p.pairKey);
    if (!rec || rec.severity !== 'Unknown') {
      skipped++;
      return;
    }
    rec.predictedSeverity = p.severity;
    rec.confidence = p.confidence;
    rec.source = 'predicted';
    attached++;
  });

  if (skipped > 0) {
    console.warn(
      `predictions.json: ${skipped} rows ignored (pair missing, or already graded). ` +
      'Re-run ml/04_export.py if the interaction data has changed.'
    );
  }
  return attached;
}

// ---- fuzzy matching (for typos) ----

/**
 * Levenshtein distance, abandoned early once every cell in a row exceeds `max`.
 * Bailing out keeps a scan of all 2.7k drug names cheap.
 */
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let best = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < best) best = curr[j];
    }
    if (best > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Distance budget scaled to the length of what the user typed. */
function budgetFor(len) {
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return 3;
}

/**
 * A weak suggestion is worse than none here: proposing Danazol (a steroid) for
 * "panadol" would be actively dangerous. So a candidate must both start with the
 * same letter and clear a similarity floor before we're willing to name it.
 */
const MIN_SUGGESTION_SCORE = 0.78;

/**
 * Closest drug names to a query that had no exact or substring match.
 * Returns [{ name, score }] with score in 0..1, best first. Empty when nothing
 * is close enough to suggest safely.
 */
function fuzzyMatches(q, limit = 5) {
  const nq = normalise(q);
  if (nq.length < 3) return [];
  const max = budgetFor(nq.length);
  const hits = [];

  for (const [norm, name] of state.byNormalised) {
    if (norm[0] !== nq[0]) continue;
    const d = editDistance(nq, norm, max);
    if (d <= max) hits.push({ name, distance: d, length: norm.length });
  }

  hits.sort((a, b) => a.distance - b.distance || a.length - b.length);
  return hits
    .map((h) => ({
      name: h.name,
      score: Number((1 - h.distance / Math.max(nq.length, h.length)).toFixed(2)),
    }))
    .filter((h) => h.score >= MIN_SUGGESTION_SCORE)
    .slice(0, limit);
}

// ---- query helpers used by the routes ----

/**
 * Resolve a user-supplied string to a canonical drug, reporting whether a
 * synonym redirect was applied.
 *
 * Returns { canonical, alias }, where `alias` is null for a direct hit and
 * otherwise { from, to } naming both ends of the redirect. Callers that need to
 * show the substitution use this; `resolveDrug` is the plain-answer wrapper.
 */
function resolveDrugWithAlias(input) {
  const raw = String(input || '').trim();
  if (!raw) return { canonical: null, alias: null };

  const direct = state.byLower.get(raw.toLowerCase())
    || state.byNormalised.get(normalise(raw))
    || null;

  const target = DRUG_ALIASES.get(normalise(raw));
  if (target) {
    const canonical = state.byLower.get(target.toLowerCase());
    // Only redirect to a name the data actually holds; otherwise fall through
    // to whatever the direct lookup found rather than losing the drug entirely.
    if (canonical) {
      return { canonical, alias: { from: direct || raw, to: canonical } };
    }
  }

  return { canonical: direct, alias: null };
}

/** Canonical drug name for a user-supplied string, or null if not in the data. */
function resolveDrug(input) {
  return resolveDrugWithAlias(input).canonical;
}

/**
 * Autocomplete. Prefix matches first, then substring. If neither turns anything
 * up the query is probably a typo, so fall back to fuzzy matches and say so —
 * that way the UI can offer "did you mean …?" instead of a dead end.
 */
function searchDrugs(q, limit = 10) {
  const ql = q.trim().toLowerCase();
  if (!ql) return { results: [], fuzzy: false };

  const starts = [];
  const contains = [];
  for (const name of state.drugNames) {
    const nl = name.toLowerCase();
    if (nl.startsWith(ql)) starts.push(name);
    else if (nl.includes(ql)) contains.push(name);
    if (starts.length >= limit) break;
  }

  const results = [...starts, ...contains].slice(0, limit);
  if (results.length > 0) return { ...redirect(results), fuzzy: false };

  return { ...redirect(fuzzyMatches(ql, 5).map((m) => m.name)), fuzzy: true };
}

/**
 * Swap any aliased name in a result list for the better-covered entry it points
 * at, and report the swap so the UI can show it. Without the `aliases` map the
 * user would type "aspirin", see "Acetylsalicylic acid" appear, and have no way
 * of knowing why.
 */
function redirect(names) {
  const results = [];
  const aliases = {};
  const seen = new Set();

  for (const name of names) {
    const target = DRUG_ALIASES.get(normalise(name));
    const canonical = target ? (state.byLower.get(target.toLowerCase()) || name) : name;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    results.push(canonical);
    if (canonical !== name) aliases[canonical] = name;
  }

  return { results, aliases };
}

/** The stronger of two records for the same pair: curated first, then severity. */
function preferRecord(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (Boolean(a.hasRich) !== Boolean(b.hasRich)) return a.hasRich ? a : b;
  return (SEV_ORDER[b.severity] || 0) > (SEV_ORDER[a.severity] || 0) ? b : a;
}

/**
 * Best interaction record for a pair, searched across every name the two
 * substances go by.
 *
 * A synonym redirect must not cost the user data, and a naive one would. Three
 * of the 79 curated records are filed under an alias name — Aspirin+Warfarin,
 * Aspirin+Duloxetine and Alcohol+Amitriptyline — so looking only under the
 * canonical name would trade 864 pairs of coverage for the loss of the richest
 * guidance in the dataset. Every variant key is tried instead, and the strongest
 * record wins by the same precedence load() uses for duplicate keys.
 */
function lookupPair(nameA, nameB) {
  const la = nameA.toLowerCase();
  const lb = nameB.toLowerCase();
  const variantsA = state.equivalents.get(la) || [la];
  const variantsB = state.equivalents.get(lb) || [lb];

  let best = null;
  for (const a of variantsA) {
    for (const b of variantsB) {
      const rec = state.interactionsByKey.get([a, b].sort().join('||'));
      if (rec) best = preferRecord(best, rec);
    }
  }
  if (!best) return null;

  // Show the pair under the names the user selected. Without this a regimen
  // listing 'Acetylsalicylic acid' would produce a card headed 'Aspirin', which
  // reads as a bug rather than as the synonym it is.
  const [drugA, drugB] = la <= lb ? [nameA, nameB] : [nameB, nameA];
  if (best.drugA === drugA && best.drugB === drugB) return best;
  return { ...best, drugA, drugB };
}

function checkInteractions(input) {
  // Split what the user gave us into names we hold data for and names we don't.
  // Anything unrecognised is reported back rather than silently dropped — an
  // unscreened drug must never look like a screened one that came up clean.
  const drugs = [];
  const unknown = [];
  const substitutions = [];
  const seenCanonical = new Set();

  for (const raw of input) {
    const { canonical, alias } = resolveDrugWithAlias(raw);
    if (canonical) {
      if (!seenCanonical.has(canonical)) {
        seenCanonical.add(canonical);
        drugs.push(canonical);
        // A redirect changes which medicine was actually screened, so it is
        // reported rather than applied quietly.
        if (alias) {
          substitutions.push({
            input: String(raw).trim(),
            matched: alias.from,
            canonical: alias.to,
          });
        }
      }
    } else {
      unknown.push({ input: String(raw).trim(), suggestions: fuzzyMatches(raw, 3) });
    }
  }

  const keys = [];
  const pairs = [];
  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      keys.push([drugs[i].toLowerCase(), drugs[j].toLowerCase()].sort().join('||'));
      pairs.push([drugs[i], drugs[j]]);
    }
  }
  const seen = new Set();
  const interactions = [];
  for (const [a, b] of pairs) {
    const k = [a.toLowerCase(), b.toLowerCase()].sort().join('||');
    if (seen.has(k)) continue;
    seen.add(k);
    const rec = lookupPair(a, b);
    if (rec) interactions.push(rec);
  }
  interactions.sort(
    (a, b) => (SEV_ORDER[b.severity] || 0) - (SEV_ORDER[a.severity] || 0)
  );

  const counts = { Major: 0, Moderate: 0, Minor: 0, Unknown: 0 };
  interactions.forEach((i) => { counts[i.severity] = (counts[i.severity] || 0) + 1; });

  // Predictions are tallied apart from `counts` on purpose. Folding them in
  // would make an estimate indistinguishable from a graded interaction at the
  // point where the UI decides what to show.
  const predictedCounts = { Major: 0, Moderate: 0, Minor: 0 };
  let predictedTotal = 0;
  for (const i of interactions) {
    if (i.source === 'predicted') {
      predictedCounts[i.predictedSeverity] = (predictedCounts[i.predictedSeverity] || 0) + 1;
      predictedTotal++;
    }
  }

  // Every Unknown pair we declined to estimate, with the reason. Staying quiet
  // here is what would let a user read "Unknown" as "checked, nothing found".
  //
  // Skipped entirely when no predictions file is loaded: with no model in play,
  // reporting "not confident enough" for every Unknown pair would be a lie
  // about a step that never ran.
  const unpredictable = [];
  for (const i of state.hasPredictions ? interactions : []) {
    if (i.severity !== 'Unknown' || i.source === 'predicted') continue;

    const thin = [i.drugA, i.drugB].filter(
      (n) => (state.labelledHistory.get(n.toLowerCase()) || 0) < MIN_LABELLED_HISTORY
    );

    if (thin.length > 0) {
      const subject = thin.length === 1
        ? `'${thin[0]}' has`
        : `'${thin[0]}' and '${thin[1]}' have`;
      unpredictable.push({
        drugA: i.drugA,
        drugB: i.drugB,
        reason: 'insufficient-data',
        drugs: thin,
        message:
          `Cannot predict severity: ${subject} too little interaction data to ` +
          'estimate reliably. Treated as Unknown — please verify manually.',
      });
    } else {
      unpredictable.push({
        drugA: i.drugA,
        drugB: i.drugB,
        reason: 'low-confidence',
        drugs: [],
        message:
          'Cannot predict severity: the model was not confident enough about ' +
          'this pair. Treated as Unknown — please verify manually.',
      });
    }
  }

  const food = drugs
    .map((d) => state.foodByLower.get(d.toLowerCase()))
    .filter(Boolean);

  // Pairs involving an unrecognised drug can't be checked at all. Counting them
  // is what makes the coverage gap visible instead of invisible.
  const total = drugs.length + unknown.length;
  const unscreenedPairs = (total * (total - 1)) / 2 - keys.length;

  return {
    totalPairs: keys.length,
    flagged: interactions.length,
    counts,
    interactions,
    food,
    recognised: drugs,
    unknown,
    substitutions,
    unscreenedPairs,
    predictedCounts,
    predictedTotal,
    unpredictable,
  };
}

module.exports = {
  state,
  load,
  searchDrugs,
  checkInteractions,
  resolveDrug,
  resolveDrugWithAlias,
  fuzzyMatches,
};
