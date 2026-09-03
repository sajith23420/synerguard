/**
 * PredictionToggle — opt in to seeing ML severity estimates.
 *
 * Off by default, and deliberately so. The estimates are not clinically
 * verified, and their worst error is the unsafe direction: held-out recall for
 * Major is 0.67, so roughly one in three genuinely Major interactions is
 * estimated lower. Showing them unasked would put that error in front of a
 * clinician who never chose to accept it.
 *
 * SPLIT INTO TWO VARIANTS, and this is a safety contract rather than a styling
 * convenience. The layout puts controls in the left rail and results in the
 * main column, but the warning has to stay with the cards it qualifies — a
 * warning parked in a rail beside the results, or below the fold, no longer
 * describes anything the reader is looking at, and on paper the rail is not
 * printed at all. So:
 *
 *   variant="switch"   the control. Lives in the rail. Hidden in print.
 *   variant="warning"  the warning paragraph. Lives in the main column,
 *                      immediately above the interaction list. Printed.
 *
 * BOTH MUST BE RENDERED. Rendering the switch alone gives the user a way to
 * turn on unverified estimates with nothing telling them what they have turned
 * on, which is the exact failure the default-off state exists to prevent. If
 * you remove one call site, remove the other or move it — do not leave the
 * switch on its own.
 *
 * @param {Object} props
 * @param {boolean} props.showPredicted - Current state
 * @param {Function} props.onChange - Called with the new state
 * @param {number} props.available - How many pairs in this result have an estimate
 * @param {'switch'|'warning'} props.variant - Which half to render
 */
export default function PredictionToggle({
  showPredicted,
  onChange,
  available = 0,
  variant = 'switch',
}) {
  // No estimates in this result: neither half has anything to say.
  if (available === 0) return null;

  if (variant === 'warning') {
    if (!showPredicted) return null;

    return (
      <p className="prediction-toggle-warning prediction-warning-standalone" role="note">
        <strong>Predicted severities are ML estimates, not clinically verified.</strong>{' '}
        A predicted “Moderate” may actually be more serious. Confirm with a qualified
        prescriber.
      </p>
    );
  }

  return (
    <div className="prediction-toggle">
      <div className="prediction-toggle-row">
        <span id="prediction-toggle-label" className="prediction-toggle-label">
          Show predicted severities
          <span className="prediction-toggle-sub">
            ML estimates for {available} pair{available === 1 ? '' : 's'} with no graded severity
          </span>
        </span>
        <button
          type="button"
          className="mode-toggle-switch"
          role="switch"
          aria-checked={showPredicted}
          aria-labelledby="prediction-toggle-label"
          onClick={() => onChange(!showPredicted)}
        >
          <span className="mode-toggle-thumb" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
