const SEVERITIES = ['Major', 'Moderate', 'Minor', 'Unknown'];

/**
 * ResultsToolbar component - severity filters, sort order and bulk controls
 * @param {Object} props
 * @param {Object} props.counts - Count of interactions per severity, e.g. { Major: 3 }
 * @param {string[]} props.active - Currently enabled severities
 * @param {Function} props.onToggle - Called with a severity name when a filter is clicked
 * @param {string} props.sort - Current sort key ('severity' | 'drug')
 * @param {Function} props.onSortChange - Called with the new sort key
 * @param {boolean} props.allExpanded - Whether every card is currently expanded
 * @param {Function} props.onToggleExpandAll - Expand / collapse every card
 * @param {number} props.visible - Number of interactions currently shown
 * @param {number} props.total - Total number of interactions before filtering
 */
export default function ResultsToolbar({
  counts = {},
  active = [],
  onToggle,
  sort = 'severity',
  onSortChange,
  allExpanded = false,
  onToggleExpandAll,
  visible = 0,
  total = 0,
}) {
  return (
    <div className="toolbar" role="group" aria-label="Filter and sort interactions">
      <span className="toolbar-label" id="filter-label">
        Filter
      </span>

      <div className="toolbar-group" aria-labelledby="filter-label">
        {SEVERITIES.map((severity) => {
          const count = counts[severity] || 0;
          const isActive = active.includes(severity);

          return (
            <button
              key={severity}
              type="button"
              className={`filter-chip filter-chip-${severity.toLowerCase()}`}
              aria-pressed={isActive}
              disabled={count === 0}
              onClick={() => onToggle(severity)}
            >
              <span className="filter-chip-dot" aria-hidden="true" />
              {severity}
              <span className="filter-chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        <label className="toolbar-label" htmlFor="sort-select">
          Sort
        </label>
        <select
          id="sort-select"
          className="select"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
        >
          <option value="severity">Severity</option>
          <option value="drug">Drug name</option>
          <option value="curated">Curated first</option>
        </select>

        <button type="button" className="btn btn-ghost btn-sm" onClick={onToggleExpandAll}>
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => window.print()}
          title="Print or save the report as PDF"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print
        </button>
      </div>

      <span className="text-muted" style={{ width: '100%', fontSize: 'var(--text-xs)' }}>
        Showing {visible} of {total} flagged interaction{total === 1 ? '' : 's'}
      </span>
    </div>
  );
}
