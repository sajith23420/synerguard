const express = require('express');
const router = express.Router();
const store = require('../store');

/** GET /api/stats — dashboard counts */
router.get('/stats', (req, res) => {
  res.json(store.state.stats);
});

/**
 * GET /api/drugs/search?q=warf
 * Autocomplete — prefix matches first, capped at 10.
 */
router.get('/drugs/search', (req, res) => {
  const q = req.query.q || '';
  res.json(store.searchDrugs(q, 10));
});

/**
 * GET /api/drugs/resolve?name=warfrin
 * Is this name in the data? If not, what did the user probably mean?
 */
router.get('/drugs/resolve', (req, res) => {
  const name = req.query.name || '';
  const { canonical, alias } = store.resolveDrugWithAlias(name);
  res.json({
    input: String(name).trim(),
    known: Boolean(canonical),
    canonical,
    // Present only when a synonym redirect was applied, so the caller can say
    // which medicine was actually used.
    matchedVia: alias ? alias.from : null,
    suggestions: canonical ? [] : store.fuzzyMatches(name, 5),
  });
});

/**
 * POST /api/check   body: { drugs: ["Warfarin","Ibuprofen","Aspirin"] }
 * Returns every pairwise interaction found, ranked by severity,
 * plus food notes for the supplied drugs.
 */
router.post('/check', (req, res) => {
  const drugs = Array.isArray(req.body.drugs) ? req.body.drugs : [];
  if (drugs.length < 2) {
    return res.status(400).json({ error: 'Provide at least two drugs.' });
  }

  // A null or blank entry is a malformed request, not an unrecognised medicine.
  // Letting it through would list a drug called "null" among the unscreened
  // names, which reads like a real gap in the data rather than a caller bug.
  const invalid = drugs.filter((d) => typeof d !== 'string' || d.trim() === '');
  if (invalid.length > 0) {
    return res.status(400).json({
      error: 'Every drug must be a non-empty string.',
      invalidCount: invalid.length,
    });
  }

  // Names we don't recognise are *not* an error — the result reports them under
  // `unknown` so the caller can show what went unscreened.
  res.json(store.checkInteractions(drugs));
});

module.exports = router;
