/**
 * FoodNotes component - displays food and supplement interactions
 * @param {Object} props
 * @param {Array} props.food - Array of food interaction objects
 */
export default function FoodNotes({ food = [] }) {
  if (!food || food.length === 0) {
    return null;
  }

  return (
    <section className="food-notes card" aria-labelledby="food-notes-heading">
      <h3 className="food-notes-title" id="food-notes-heading">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 2v7a3 3 0 0 0 3 3 3 3 0 0 0 3-3V2M6 2v20M16 2c-1.5 2-2 4.5-2 7s.5 4 2 4h2V2z" />
        </svg>
        Food &amp; supplement notes
      </h3>
      <div className="food-grid">
        {food.map((item, index) => (
          <div key={index} className="food-drug">
            <div className="food-drug-name">{item.name}</div>
            <ul className="food-interaction-list">
              {item.foodInteractions?.map((interaction, i) => (
                <li key={i} className="food-interaction-item">
                  {interaction}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
