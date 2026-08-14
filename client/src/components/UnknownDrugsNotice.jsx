/**
 * UnknownDrugsNotice — states plainly which entries were not screened.
 *
 * The dangerous failure mode for a checker like this is a quiet one: a drug the
 * database has never heard of contributes no interactions, so the regimen looks
 * clean when in fact it was never checked. This makes that gap loud, and offers
 * the closest known spellings so a typo can be corrected in one click.
 *
 * @param {Object} props
 * @param {Array<{input: string, suggestions: Array<{name: string, score: number}>}>} props.unknown
 * @param {number} props.unscreenedPairs - Pairs that could not be checked
 * @param {Function} props.onReplace - (wrongName, correctName) => void
 */
export default function UnknownDrugsNotice({ unknown = [], unscreenedPairs = 0, onReplace }) {
  if (unknown.length === 0) return null;

  const count = unknown.length;

  return (
    <div className="unknown-notice" role="alert">
      <div className="unknown-notice-head">
        <svg
          className="unknown-notice-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div>
          <h3 className="unknown-notice-title">
            {count} {count === 1 ? 'drug was' : 'drugs were'} not screened
          </h3>
          <p className="unknown-notice-body">
            {count === 1 ? 'This name is' : 'These names are'} not in the database, so{' '}
            {unscreenedPairs} {unscreenedPairs === 1 ? 'pair' : 'pairs'} could not be checked.{' '}
            <strong>A clean result below does not cover {count === 1 ? 'it' : 'them'}.</strong>
          </p>
        </div>
      </div>

      <ul className="unknown-list">
        {unknown.map((item) => (
          <li key={item.input} className="unknown-item">
            <code className="unknown-item-name">{item.input}</code>
            {item.suggestions.length > 0 ? (
              <span className="unknown-item-suggest">
                Did you mean
                {item.suggestions.map((s, i) => (
                  <span key={s.name}>
                    {i > 0 && ' / '}{' '}
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => onReplace(item.input, s.name)}
                    >
                      {s.name}
                    </button>
                  </span>
                ))}
                ?
              </span>
            ) : (
              <span className="unknown-item-suggest unknown-item-suggest-none">
                No close match — check the spelling, or try the generic name rather than a brand
                name.
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
