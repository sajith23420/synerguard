import { useState, useEffect, useId } from 'react';

/**
 * Confidence as a whole percentage, capped at 99.
 *
 * Math.round alone sends everything from 0.995 upward to a flat "100%" — 11,486
 * of the 56,342 exported predictions, one in five. A badge reading "100%" on an
 * estimate that was never clinically verified overstates certainty in exactly
 * the direction this tool must not, given that held-out recall for Major is 0.67.
 *
 * The stored value in predictions.json is untouched; only the display is capped.
 */
function formatConfidence(confidence) {
  return Math.min(99, Math.round(confidence * 100));
}

/**
 * InteractionCard component - displays a single drug interaction
 * @param {Object} props
 * @param {Object} props.interaction - Interaction object from API
 * @param {boolean} props.plainMode - Whether to show plain language mode
 * @param {boolean} props.expandAll - Target expanded state pushed by the parent
 * @param {number} props.expandSignal - Changes whenever the parent wants to re-apply expandAll
 * @param {boolean} props.showPredicted - Whether the user has opted into ML estimates
 */
export default function InteractionCard({
  interaction,
  plainMode = false,
  expandAll = false,
  expandSignal = 0,
  showPredicted = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const bodyId = useId();

  // Re-apply the parent's expand/collapse whenever it fires the signal
  useEffect(() => {
    if (expandSignal > 0) setIsExpanded(expandAll);
  }, [expandSignal, expandAll]);

  const {
    drugA,
    drugB,
    severity,
    description,
    hasRich,
    mechanism,
    clinicalEffect,
    saferAlternative,
    clinicalManagement,
    predictedSeverity,
    confidence,
    source,
  } = interaction;

  // The card shows the estimate only where the user asked for it. `severity`
  // itself is never overwritten — an estimate is a different kind of claim, and
  // the two stay distinguishable all the way to the badge.
  const isPredicted = showPredicted && source === 'predicted';
  const shownSeverity = isPredicted ? predictedSeverity : severity;
  const severityClass = shownSeverity.toLowerCase();
  const showClinical = !plainMode && hasRich;

  return (
    <article
      className={`card interaction-card ${severityClass} ${isExpanded ? 'expanded' : ''} ${
        isPredicted ? 'interaction-card-predicted' : ''
      }`}
    >
      <button
        type="button"
        className="interaction-header"
        aria-expanded={isExpanded}
        aria-controls={bodyId}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <div className="interaction-drugs">
          <div className="interaction-drug-pair">
            <span>{drugA}</span>
            <span className="interaction-drug-sep" aria-hidden="true">
              +
            </span>
            <span>{drugB}</span>
          </div>
          {!isExpanded && description && (
            <p className="interaction-preview">{description}</p>
          )}
        </div>

        <div className="interaction-badges">
          <span className={`badge badge-${severityClass} ${isPredicted ? 'badge-estimate' : ''}`}>
            {shownSeverity}
          </span>
          {isPredicted && (
            <span
              className="badge badge-predicted"
              title="Machine-learning estimate — not a verified grading"
            >
              Predicted · {formatConfidence(confidence)}%
            </span>
          )}
          {hasRich && <span className="badge badge-curated">Curated</span>}
          <span className="interaction-toggle" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="interaction-body" id={bodyId}>
          {isPredicted && (
            <p className="interaction-predicted-note">
              This severity is an <strong>ML estimate</strong> ({formatConfidence(confidence)}%
              confidence), not a graded interaction. The source data records this pair as
              Unknown. Estimates under-call Major roughly one time in three — confirm with a
              qualified prescriber.
            </p>
          )}

          <div className="interaction-fields">
            {description && (
              <div className="interaction-field-wide">
                <span className="interaction-field-label">Description</span>
                <p className="interaction-field-value">{description}</p>
              </div>
            )}

            {showClinical && mechanism && (
              <div>
                <span className="interaction-field-label">Mechanism</span>
                <p className="interaction-field-value">{mechanism}</p>
              </div>
            )}

            {showClinical && clinicalEffect && (
              <div>
                <span className="interaction-field-label">Clinical effect</span>
                <p className="interaction-field-value">{clinicalEffect}</p>
              </div>
            )}

            {showClinical && clinicalManagement && (
              <div className="interaction-field-wide">
                <span className="interaction-field-label">Management</span>
                <p className="interaction-field-value">{clinicalManagement}</p>
              </div>
            )}

            {hasRich && saferAlternative && (
              <div className="interaction-field-wide interaction-field-alt">
                <span className="interaction-field-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Safer alternative
                </span>
                <p className="interaction-field-value">{saferAlternative}</p>
              </div>
            )}

            {!description && !hasRich && (
              <p className="text-muted interaction-field-wide">
                No additional details available for this interaction.
              </p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
