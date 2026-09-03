/**
 * SubstitutionNotice — names that were redirected to a synonym before screening.
 *
 * The merged source data holds some substances under two names with very
 * different coverage: 'Aspirin' carries 2 interaction pairs, 'Acetylsalicylic
 * acid' carries 864. The resolver redirects to the better-covered entry, which
 * is the difference between screening a regimen and appearing to.
 *
 * That redirect is reported here rather than applied quietly. The user asked
 * about one name and the system checked another; even though it is the same
 * substance, they are entitled to see the swap and to recognise it as correct.
 *
 * @param {Object} props
 * @param {Array<{input: string, matched: string, canonical: string}>} props.substitutions
 */
export default function SubstitutionNotice({ substitutions = [] }) {
  if (substitutions.length === 0) return null;

  return (
    <div className="substitution-notice" role="note">
      <svg
        className="substitution-notice-icon"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>

      <div>
        <p className="substitution-notice-body">
          {substitutions.length === 1 ? 'One name was' : `${substitutions.length} names were`}{' '}
          matched to an equivalent entry with fuller interaction data:
        </p>
        <ul className="substitution-list">
          {substitutions.map((s) => (
            <li key={s.input}>
              <span className="substitution-from">{s.matched}</span>
              <span className="substitution-arrow" aria-hidden="true">→</span>
              <span className="substitution-to">{s.canonical}</span>
              <span className="sr-only">
                {' '}was screened as {s.canonical}
              </span>
            </li>
          ))}
        </ul>
        <p className="substitution-notice-foot">
          The same substance under a different name. Results below are for the name on the right.
        </p>
      </div>
    </div>
  );
}
