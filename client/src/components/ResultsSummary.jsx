/**
 * ResultsSummary component - displays summary statistics
 * @param {Object} props
 * @param {Object} props.counts - Object with Major, Moderate, Minor, Unknown counts
 * @param {number} props.totalPairs - Total number of pairs checked
 * @param {number} props.flagged - Number of flagged interactions
 * @param {number} props.predicted - How many of the above are ML estimates (0 when opted out)
 */
export default function ResultsSummary({
  counts = {},
  totalPairs = 0,
  flagged = 0,
  predicted = 0,
}) {
  const major = counts.Major || 0;
  const moderate = counts.Moderate || 0;
  const minor = counts.Minor || 0;
  const noFlag = totalPairs - flagged;

  return (
    <div className="summary-row" role="region" aria-label="Interaction summary">
      <div className="summary-stat summary-stat-major">
        <div className="summary-stat-value" aria-label={`Major interactions: ${major}`}>{major}</div>
        <div className="summary-stat-label">Major</div>
      </div>
      <div className="summary-stat summary-stat-moderate">
        <div className="summary-stat-value" aria-label={`Moderate interactions: ${moderate}`}>{moderate}</div>
        <div className="summary-stat-label">Moderate</div>
      </div>
      <div className="summary-stat summary-stat-minor">
        <div className="summary-stat-value" aria-label={`Minor interactions: ${minor}`}>{minor}</div>
        <div className="summary-stat-label">Minor</div>
      </div>
      <div className="summary-stat summary-stat-none">
        <div className="summary-stat-value" aria-label={`No flag: ${noFlag}`}>{noFlag}</div>
        <div className="summary-stat-label">No Flag</div>
      </div>
      {predicted > 0 && (
        <div className="summary-stat summary-stat-predicted">
          <div className="summary-stat-value" aria-label={`Predicted: ${predicted}`}>
            {predicted}
          </div>
          {/* The counts to the left include these; this tile says how many of
              them are estimates rather than graded data. */}
          <div className="summary-stat-label">of which predicted</div>
        </div>
      )}
    </div>
  );
}