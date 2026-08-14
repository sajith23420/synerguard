/**
 * DrugChips component - displays selected drugs as removable chips
 * @param {Object} props
 * @param {string[]} props.drugs - Array of selected drug names
 * @param {Function} props.onRemove - Callback when a drug is removed
 * @param {string[]} props.unknownDrugs - Names the database holds no data for
 */
export default function DrugChips({ drugs = [], onRemove, unknownDrugs = [] }) {
  if (drugs.length === 0) {
    return (
      <div className="selected-drugs">
        <span className="selected-drugs-label">Selected drugs (0)</span>
        <div className="selected-drugs-list" aria-live="polite">
          <span className="chip-empty">No drugs selected yet — search above to add one.</span>
        </div>
      </div>
    );
  }

  const unknownSet = new Set(unknownDrugs.map((d) => d.toLowerCase()));

  return (
    <div className="selected-drugs">
      <span className="selected-drugs-label">
        Selected drugs ({drugs.length})
      </span>
      <div className="selected-drugs-list" aria-live="polite">
        {drugs.map((drug, index) => {
          const isUnknown = unknownSet.has(drug.toLowerCase());
          return (
            <span
              key={`${drug}-${index}`}
              className={`chip ${isUnknown ? 'chip-unknown' : ''}`}
              title={isUnknown ? `${drug} — not in the database, not screened` : undefined}
            >
              {isUnknown && (
                <svg
                  className="chip-warn-icon"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
              {drug}
              {isUnknown && <span className="sr-only"> — not screened</span>}
              <button
                type="button"
                className="chip-remove"
                onClick={() => onRemove(drug)}
                aria-label={`Remove ${drug}`}
                title={`Remove ${drug}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
