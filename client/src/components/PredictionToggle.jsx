/**
 * PredictionToggle — opt in to seeing ML severity estimates.
 *
 * Off by default, and deliberately so. The estimates are not clinically
 * verified, and their worst error is the unsafe direction: held-out recall for
 * Major is 0.67, so roughly one in three genuinely Major interactions is
 * estimated lower. Showing them unasked would put that error in front of a
 * clinician who never chose to accept it.
 *
 * @param {Object} props
 * @param {boolean} props.showPredicted - Current state
 * @param {Function} props.onChange - Called with the new state
 * @param {number} props.available - How many pairs in this result have an estimate
 */
export default function PredictionToggle({ showPredicted, onChange, available = 0 }) {
  if (available === 0) return null;

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

      {showPredicted && (
        <p className="prediction-toggle-warning" role="note">
          <strong>Predicted severities are ML estimates, not clinically verified.</strong>{' '}
          A predicted “Moderate” may actually be more serious. Confirm with a qualified
          prescriber.
        </p>
      )}
    </div>
  );
}
