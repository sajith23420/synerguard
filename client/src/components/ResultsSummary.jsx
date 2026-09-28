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
  const ungraded = counts.Unknown || 0;
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
      {/* Recorded interactions with no severity grade. Without this tile the
          severity tiles could all read 0 while a pair was in fact flagged,
          which reads as a clean regimen — the silent failure to avoid. */}
      <div
        className="summary-stat summary-stat-ungraded"
        title="An interaction is recorded for these pairs, but no severity grade exists. This is not a finding of safety."
      >
        <div className="summary-stat-value" aria-label={`Ungraded interactions: ${ungraded}`}>{ungraded}</div>
        <div className="summary-stat-label">Ungraded</div>
        <div className="summary-stat-hint">severity not recorded</div>
      </div>
      {/* Not "No Flag": these pairs have no entry in the dataset at all, so
          nothing was assessed. Labelling that as a clean result would imply the
          checker looked and found nothing, which is the opposite of the truth. */}
      <div
        className="summary-stat summary-stat-none"
        title="These pairs have no entry in the dataset. They were not assessed — this is not a finding of safety."
      >
        <div className="summary-stat-value" aria-label={`No record in dataset: ${noFlag}`}>{noFlag}</div>
        <div className="summary-stat-label">No record</div>
        <div className="summary-stat-hint">not assessed</div>
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