/**
 * Disclaimer component - medical disclaimer
 */
export default function Disclaimer() {
  return (
    <section className="disclaimer" role="contentinfo" aria-label="Medical disclaimer">
      <h3 className="disclaimer-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        Important Medical Disclaimer
      </h3>
      <div className="disclaimer-text">
        <p>
          <strong>SynerGuard is an educational decision-support tool only.</strong> It does not replace professional medical judgment.
        </p>
        <p>
          This tool checks for known drug–drug interactions based on published data. It does <strong>not</strong> account for:
        </p>
        <ul className="disclaimer-list">
          <li>Patient-specific factors (age, weight, genetics, comorbidities)</li>
          <li>Dosage, route, frequency, or duration of therapy</li>
          <li>Renal/hepatic function, pregnancy, or lactation status</li>
          <li>Over-the-counter medications, supplements, or herbal products not in the database</li>
          <li>Pharmacogenomic variations or rare metabolic pathways</li>
        </ul>
        <p>
          <strong>Every clinical decision must be confirmed by a qualified prescriber or pharmacist</strong> who has access to the complete patient picture. The authors and institution accept no liability for clinical decisions made using this tool.
        </p>
      </div>
    </section>
  );
}