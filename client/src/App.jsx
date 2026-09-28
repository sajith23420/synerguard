import { useState, useEffect, useCallback, useMemo } from 'react';
import { getStats, checkInteractions, resolveDrugName } from './api';
import {
  SearchBox,
  DrugChips,
  UnknownDrugsNotice,
  SubstitutionNotice,
  UnpredictableNotice,
  PredictionToggle,
  ResultsSummary,
  ResultsToolbar,
  InteractionCard,
  FoodNotes,
  Disclaimer,
  ModeToggle,
  ThemeToggle,
  Splash,
} from './components';

const ALL_SEVERITIES = ['Major', 'Moderate', 'Minor', 'Unknown'];
/** Gap between attempts while the server is waking. */
const BOOT_RETRY_MS = 3000;
/** How long to keep waking a sleeping server before calling it a failure. */
const BOOT_BUDGET_MS = 90000;
const SEVERITY_RANK = { Major: 0, Moderate: 1, Minor: 2, Unknown: 3 };

/**
 * The severity this interaction should be filtered, sorted and counted by.
 * An ML estimate only takes effect once the user has opted in; otherwise the
 * pair stays where the source data puts it, at Unknown.
 */
function effectiveSeverity(interaction, showPredicted) {
  return showPredicted && interaction.source === 'predicted'
    ? interaction.predictedSeverity
    : interaction.severity;
}

function App() {
  // State
  const [selectedDrugs, setSelectedDrugs] = useState([]);
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [plainMode, setPlainMode] = useState(false);
  const [showPredicted, setShowPredicted] = useState(false);
  const [stats, setStats] = useState({
    drugs: 0,
    interactions: 0,
    richRecords: 0,
    predicted: 0,
  });

  // Names the resolver could not find, checked as each drug is added rather than
  // only once an analysis has run.
  const [unverifiedDrugs, setUnverifiedDrugs] = useState([]);

  // Results view state
  const [activeSeverities, setActiveSeverities] = useState(ALL_SEVERITIES);
  const [sort, setSort] = useState('severity');
  const [allExpanded, setAllExpanded] = useState(false);
  const [expandSignal, setExpandSignal] = useState(0);

  // Splash / boot state. The hosted API sleeps when idle and takes 30-50s to
  // wake, during which the header would read zeros and every search would fail
  // silently. Retry until it answers rather than leaving a dead app up.
  const [statsReady, setStatsReady] = useState(false);
  const [bootFailed, setBootFailed] = useState(false);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [splashDone, setSplashDone] = useState(false);

  // Fetch stats on mount, retrying while the server wakes
  useEffect(() => {
    let cancelled = false;
    let timer;
    const startedAt = Date.now();

    const attempt = () => {
      getStats()
        .then((data) => {
          if (cancelled) return;
          setStats(data);
          setStatsReady(true);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('Failed to load stats:', err);
          if (Date.now() - startedAt >= BOOT_BUDGET_MS) {
            setBootFailed(true);
            return;
          }
          timer = setTimeout(attempt, BOOT_RETRY_MS);
        });
    };

    attempt();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bootAttempt]);

  const handleBootRetry = useCallback(() => {
    setBootFailed(false);
    setBootAttempt((n) => n + 1);
  }, []);

  /**
   * Ask the server whether a name is in the dataset, and remember it if not.
   *
   * Fire-and-forget: a failed lookup leaves the chip unmarked, and the check on
   * Analyse still reports the name as unscreened. This only moves the warning
   * earlier, it is not the thing the warning depends on.
   */
  const flagIfUnknown = useCallback((drug) => {
    resolveDrugName(drug)
      .then(({ known }) => {
        if (known) return;
        setUnverifiedDrugs((prev) => (prev.includes(drug) ? prev : [...prev, drug]));
      })
      .catch((err) => console.error('Resolve failed:', err));
  }, []);

  // Handle drug selection
  const handleAddDrug = useCallback((drug) => {
    if (selectedDrugs.includes(drug)) return;
    setSelectedDrugs((prev) => [...prev, drug]);
    // Results describe the regimen as it stood when they were run. Leaving them
    // up after a drug is added would show a clean screen for a regimen that was
    // never screened — the exact failure this tool exists to prevent.
    setResults(null);
    setError(null);
    flagIfUnknown(drug);
  }, [selectedDrugs, flagIfUnknown]);

  // Handle drug removal
  const handleRemoveDrug = useCallback((drug) => {
    setSelectedDrugs((prev) => prev.filter((d) => d !== drug));
    setUnverifiedDrugs((prev) => prev.filter((d) => d !== drug));
    // Clear results when drugs change
    setResults(null);
    setError(null);
  }, []);

  // Handle analyse
  const handleAnalyse = useCallback(async () => {
    if (selectedDrugs.length < 2) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await checkInteractions(selectedDrugs);
      setResults(data);
      // Reset the results view for the new run
      setActiveSeverities(ALL_SEVERITIES);
      setSort('severity');
      setAllExpanded(false);
      setExpandSignal((n) => n + 1);
    } catch (err) {
      setError('Failed to check interactions. Please try again.');
      console.error('Check interactions error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDrugs]);

  // Clear results
  const handleClear = useCallback(() => {
    setSelectedDrugs([]);
    setUnverifiedDrugs([]);
    setResults(null);
    setError(null);
  }, []);

  // Swap a misspelled entry for the suggested drug. Results are dropped because
  // they no longer describe the regimen on screen — same as removing a drug.
  const handleReplaceDrug = useCallback((wrongName, correctName) => {
    setSelectedDrugs((prev) => {
      const next = prev.filter((d) => d !== wrongName);
      return next.includes(correctName) ? next : [...next, correctName];
    });
    setUnverifiedDrugs((prev) => prev.filter((d) => d !== wrongName));
    setResults(null);
    setError(null);
  }, []);

  // Toggle one severity filter on/off
  const handleToggleSeverity = useCallback((severity) => {
    setActiveSeverities((prev) =>
      prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity]
    );
  }, []);

  // Expand or collapse every card at once
  const handleToggleExpandAll = useCallback(() => {
    setAllExpanded((prev) => !prev);
    setExpandSignal((n) => n + 1);
  }, []);

  const interactions = useMemo(() => results?.interactions ?? [], [results]);

  const unknownDrugs = useMemo(() => results?.unknown ?? [], [results]);

  // Chips are marked unscreened from two sources: the per-name check that runs
  // on add, and the last analysis. The first keeps the warning visible while the
  // regimen is being edited, when results have deliberately been cleared.
  const unknownNames = useMemo(
    () => [...new Set([...unverifiedDrugs, ...unknownDrugs.map((u) => u.input)])],
    [unverifiedDrugs, unknownDrugs]
  );

  // How many interactions exist per severity, before filtering
  const severityCounts = useMemo(() => {
    return interactions.reduce((acc, item) => {
      const sev = effectiveSeverity(item, showPredicted);
      acc[sev] = (acc[sev] || 0) + 1;
      return acc;
    }, {});
  }, [interactions, showPredicted]);

  // Apply the active filters and sort order
  const visibleInteractions = useMemo(() => {
    const filtered = interactions.filter((item) =>
      activeSeverities.includes(effectiveSeverity(item, showPredicted))
    );

    return [...filtered].sort((a, b) => {
      if (sort === 'drug') {
        return `${a.drugA} ${a.drugB}`.localeCompare(`${b.drugA} ${b.drugB}`);
      }
      if (sort === 'curated' && Boolean(a.hasRich) !== Boolean(b.hasRich)) {
        return a.hasRich ? -1 : 1;
      }
      const rank = (i) => SEVERITY_RANK[effectiveSeverity(i, showPredicted)] ?? 9;
      // Graded interactions outrank estimates at the same severity, so a real
      // Major is never pushed below a predicted one.
      return rank(a) - rank(b)
        || Number(a.source === 'predicted') - Number(b.source === 'predicted');
    });
  }, [interactions, activeSeverities, sort, showPredicted]);

  return (
    <div className="app">
      {!splashDone && (
        <Splash
          ready={statsReady}
          failed={bootFailed}
          onRetry={handleBootRetry}
          onDone={() => setSplashDone(true)}
        />
      )}

      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="header" role="banner">
        <div className="header-inner">
          <div className="header-brand">
            <div className="header-logo" aria-hidden="true">
              SG
            </div>
            <div>
              <h1 className="header-title">SynerGuard</h1>
              <span className="header-tagline">Drug interaction screening</span>
            </div>
          </div>

          <div className="header-right">
            <div className="header-stats" aria-label="Database statistics">
              <span className="header-stat">
                <span className="header-stat-value">{stats.drugs.toLocaleString()}</span>
                <span className="header-stat-label">drugs</span>
              </span>
              <span className="header-stat">
                <span className="header-stat-value">{stats.interactions.toLocaleString()}</span>
                <span className="header-stat-label">interactions</span>
              </span>
              <span className="header-stat">
                <span className="header-stat-value">{stats.richRecords.toLocaleString()}</span>
                <span className="header-stat-label">curated</span>
              </span>
              {stats.predicted > 0 && (
                <span className="header-stat header-stat-predicted">
                  <span className="header-stat-value">{stats.predicted.toLocaleString()}</span>
                  <span className="header-stat-label">predicted</span>
                </span>
              )}
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main-content" className="main" role="main">
        <div className="content">
         <div className="shell">
          {/* Only rendered on paper — heads the printed report */}
          <div className="print-header">
            <h1>SynerGuard — Interaction Report</h1>
            <div className="print-meta">
              <div>Generated: {new Date().toLocaleString()}</div>
              <div>Regimen: {selectedDrugs.join(', ') || '—'}</div>
              <div>Educational decision-support only — not a substitute for clinical judgement.</div>
            </div>
          </div>

          {/* Spans every column of the shell: the page title heads the whole
              layout, not the search rail it used to sit inside. */}
          <div className="shell-head">
            <div className="page-header">
              <span className="eyebrow">Clinical decision support</span>
              <h2 id="search-heading" className="page-title">
                Drug Interaction Checker
              </h2>
              <p className="page-lead">
                Enter two or more medications to screen for known drug–drug interactions and food
                warnings. Results are ranked by clinical severity, with curated guidance where
                evidence exists.
              </p>
            </div>
          </div>

          {/* Left rail. Named in its own right rather than by the page
              heading above it: a landmark whose name lives outside it is
              confusing to walk. The h2 labels the page. */}
          <section className="rail rail-left" aria-label="Regimen">
            <div className="panel">
              <SearchBox onSelect={handleAddDrug} selectedDrugs={selectedDrugs} />

              <DrugChips
                drugs={selectedDrugs}
                onRemove={handleRemoveDrug}
                unknownDrugs={unknownNames}
              />

              <div className="panel-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleAnalyse}
                  disabled={selectedDrugs.length < 2 || isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      Analysing…
                    </>
                  ) : (
                    'Analyse Regimen'
                  )}
                </button>
                {selectedDrugs.length > 0 && (
                  <button className="btn btn-secondary" onClick={handleClear} disabled={isLoading}>
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="error-state" role="alert">
                <div>
                  <div className="error-state-title">Something went wrong</div>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {/* Display controls. Only meaningful once there is a result to
                apply them to, so they appear with it — same condition as
                before the move. The prediction WARNING is not here: it renders
                in the main column above the cards it qualifies. */}
            {results && (
              <div className="rail-controls">
                <div className="rail-control">
                  <ModeToggle plainMode={plainMode} onChange={setPlainMode} />
                </div>

                <PredictionToggle
                  variant="switch"
                  showPredicted={showPredicted}
                  onChange={setShowPredicted}
                  available={results.predictedTotal ?? 0}
                />
              </div>
            )}
          </section>

          <div className="col-main">

          {results && (
            <section className="results-section" aria-labelledby="results-heading">
              <div className="results-header">
                <div>
                  <h2 id="results-heading">Interaction Results</h2>
                  <div className="results-meta">
                    {results.totalPairs} pair{results.totalPairs === 1 ? '' : 's'} checked ·{' '}
                    {results.flagged} flagged
                    {results.unscreenedPairs > 0 && (
                      <> · <span className="results-meta-warn">
                        {results.unscreenedPairs} unscreened
                      </span></>
                    )}
                  </div>
                </div>
              </div>

              <UnknownDrugsNotice
                unknown={unknownDrugs}
                unscreenedPairs={results.unscreenedPairs}
                onReplace={handleReplaceDrug}
              />

              <SubstitutionNotice substitutions={results.substitutions ?? []} />

              <ResultsSummary
                counts={severityCounts}
                totalPairs={results.totalPairs}
                flagged={results.flagged}
                predicted={showPredicted ? results.predictedTotal ?? 0 : 0}
              />

              {interactions.length > 0 && (
                <ResultsToolbar
                  counts={severityCounts}
                  active={activeSeverities}
                  onToggle={handleToggleSeverity}
                  sort={sort}
                  onSortChange={setSort}
                  allExpanded={allExpanded}
                  onToggleExpandAll={handleToggleExpandAll}
                  visible={visibleInteractions.length}
                  total={interactions.length}
                />
              )}

              {/* Immediately above the cards, so it qualifies what is being
                  read. Survives print; the switch in the rail does not. */}
              <PredictionToggle
                variant="warning"
                showPredicted={showPredicted}
                onChange={setShowPredicted}
                available={results.predictedTotal ?? 0}
              />

              {interactions.length === 0 ? (
                <div className="empty-state card">
                  <div className="empty-state-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 className="empty-state-title">
                    {unknownDrugs.length > 0
                      ? 'No interactions flagged among the screened drugs'
                      : 'No interactions flagged'}
                  </h3>
                  <p className="empty-state-body">
                    {unknownDrugs.length > 0 ? (
                      <>
                        No known interactions were found between the medications that could be
                        screened. The {unknownDrugs.length} unrecognised{' '}
                        {unknownDrugs.length === 1 ? 'drug is' : 'drugs are'} not covered by this
                        result — see the warning above.
                      </>
                    ) : (
                      <>
                        No known interactions were found between the selected medications. This is
                        not a guarantee of safety — absence of data is not evidence of absence.
                      </>
                    )}
                  </p>
                </div>
              ) : visibleInteractions.length === 0 ? (
                <div className="empty-state card">
                  <h3 className="empty-state-title">Nothing matches these filters</h3>
                  <p className="empty-state-body">
                    Re-enable a severity filter above to see the {interactions.length} flagged
                    interaction{interactions.length === 1 ? '' : 's'}.
                  </p>
                </div>
              ) : (
                <div className="interaction-list" role="list" aria-label="Drug interactions">
                  {visibleInteractions.map((interaction, index) => (
                    <InteractionCard
                      key={`${interaction.drugA}-${interaction.drugB}-${index}`}
                      interaction={interaction}
                      plainMode={plainMode}
                      expandAll={allExpanded}
                      expandSignal={expandSignal}
                      showPredicted={showPredicted}
                    />
                  ))}
                </div>
              )}

              <UnpredictableNotice items={results.unpredictable ?? []} />

              <FoodNotes food={results.food} />
            </section>
          )}

          {!results && selectedDrugs.length === 0 && (
            <section
              className="empty-state card welcome-state"
              aria-labelledby="welcome-heading"
            >
              <div className="empty-state-icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7z" />
                  <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
                </svg>
              </div>
              <h3 id="welcome-heading" className="empty-state-title">
                Start with two medications
              </h3>
              <p className="empty-state-body">
                Search for the medicines a patient is taking. Once two or more are added, the
                analysis screens every pair against {stats.interactions.toLocaleString()} recorded
                interaction pairs.
              </p>
              {/* Every example here returns a graded interaction — verified
                  against the API. Suggesting a pair the dataset has no record of
                  teaches the first-time user that "nothing found" is the normal
                  result, which is the wrong lesson from a screening tool. */}
              <div className="example-list">
                <span className="example-pill">Warfarin + Ibuprofen</span>
                <span className="example-pill">Simvastatin + Clarithromycin</span>
                <span className="example-pill">Methotrexate + Trimethoprim</span>
              </div>
            </section>
          )}

          {/* Outside the results block on purpose: the limits of this tool apply
              before anyone runs a check, not only once they have an answer. */}
          <Disclaimer />

          </div>{/* /col-main */}
         </div>{/* /shell */}
        </div>
      </main>
    </div>
  );
}

export default App;
