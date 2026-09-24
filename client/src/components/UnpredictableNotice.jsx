import { useState } from 'react';

/**
 * UnpredictableNotice — pairs the model declined to estimate, and why.
 *
 * This exists for the same reason the unrecognised-drug notice does. Once some
 * Unknown pairs start showing an estimate, the ones that don't read as "checked,
 * nothing found" rather than "not attempted". Naming the reason — and the drug
 * responsible — keeps the gap visible instead of letting silence imply safety.
 *
 * @param {Object} props
 * @param {Array<{drugA: string, drugB: string, reason: string, message: string}>} props.items
 */
const PREVIEW_COUNT = 5;

export default function UnpredictableNotice({ items = [] }) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const thin = items.filter((i) => i.reason === 'insufficient-data');
  const unsure = items.filter((i) => i.reason === 'low-confidence');

  // A fifteen-drug regimen produces dozens of these. Listing them all buries
  // the summary underneath, so the tail collapses until asked for.
  const shown = expanded ? items : items.slice(0, PREVIEW_COUNT);
  const hidden = items.length - shown.length;

  return (
    <div className="unpredictable-notice" role="note">
      <div className="unpredictable-notice-head">
        <svg
          className="unpredictable-notice-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9.2a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.6" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <h3 className="unpredictable-notice-title">
          No severity estimate for {items.length} pair{items.length === 1 ? '' : 's'}
        </h3>
      </div>

      <ul className="unpredictable-list">
        {shown.map((item) => (
          <li key={`${item.drugA}-${item.drugB}`} className="unpredictable-item">
            <span className="unpredictable-pair">
              {item.drugA} + {item.drugB}
            </span>
            <span className="unpredictable-message">{item.message}</span>
          </li>
        ))}
      </ul>

      {(hidden > 0 || expanded) && (
        <button
          type="button"
          className="link-button unpredictable-more"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? 'Show fewer' : `+${hidden} more`}
        </button>
      )}

      <p className="unpredictable-footer">
        {thin.length > 0 && (
          <>
            {thin.length} skipped for lack of data — the model learns from a drug&apos;s other
            graded interactions, and cannot estimate for one that has too few. This is not a
            statement that the combination is safe.
          </>
        )}
        {thin.length > 0 && unsure.length > 0 && ' '}
        {unsure.length > 0 && (
          <>
            {unsure.length} skipped because the estimate fell below the confidence
            threshold. This is not a statement that the combination is safe.
          </>
        )}{' '}
        These remain <strong>Unknown</strong>, which means not assessed — not assessed as safe.
      </p>
    </div>
  );
}
