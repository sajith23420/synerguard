/**
 * ModeToggle component - Clinician / Plain mode switch
 * @param {Object} props
 * @param {boolean} props.plainMode - Current mode
 * @param {Function} props.onChange - Callback when mode changes
 */
export default function ModeToggle({ plainMode, onChange }) {
  return (
    <div className="mode-toggle" role="group" aria-labelledby="mode-toggle-label">
      <span id="mode-toggle-label" className="mode-toggle-label">
        {plainMode ? 'Plain language' : 'Clinician mode'}
      </span>
      <button
        className="mode-toggle-switch"
        role="switch"
        aria-checked={plainMode}
        aria-label={plainMode ? 'Switch to clinician mode' : 'Switch to plain language mode'}
        onClick={() => onChange(!plainMode)}
      >
        <span className="mode-toggle-thumb" aria-hidden="true" />
      </button>
    </div>
  );
}