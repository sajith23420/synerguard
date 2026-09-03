const BASE_URL = '/api';

/**
 * Search for drugs by query string
 * @param {string} query - Search query (minimum 2 characters)
 * @returns {Promise<{results: string[], fuzzy: boolean, aliases: Object}>} Matches,
 *   whether they came from a typo-tolerant fallback rather than a literal match,
 *   and for any result reached through a synonym redirect, the name that was
 *   actually matched (canonical name -> matched synonym)
 */
export async function searchDrugs(query) {
  if (!query || query.length < 2) return { results: [], fuzzy: false, aliases: {} };

  const response = await fetch(`${BASE_URL}/drugs/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error('Failed to search drugs');
  }
  return response.json();
}

/**
 * Check interactions for a list of drugs
 * @param {string[]} drugs - Array of drug names
 * @returns {Promise<Object>} Interaction check results
 */
export async function checkInteractions(drugs) {
  const response = await fetch(`${BASE_URL}/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ drugs }),
  });

  if (!response.ok) {
    throw new Error('Failed to check interactions');
  }
  return response.json();
}

/**
 * Ask whether a single name is in the dataset.
 *
 * Used the moment a drug is added, so an unrecognised entry is flagged while the
 * regimen is being built rather than only after an analysis has run.
 *
 * @param {string} name - The name as the user entered it
 * @returns {Promise<{input: string, known: boolean, canonical: string|null,
 *   matchedVia: string|null, suggestions: Array<{name: string, score: number}>}>}
 */
export async function resolveDrugName(name) {
  const response = await fetch(`${BASE_URL}/drugs/resolve?name=${encodeURIComponent(name)}`);
  if (!response.ok) {
    throw new Error('Failed to resolve drug name');
  }
  return response.json();
}

/**
 * Get statistics about the drug database
 * @returns {Promise<Object>} Statistics object
 */
export async function getStats() {
  const response = await fetch(`${BASE_URL}/stats`);
  if (!response.ok) {
    throw new Error('Failed to fetch stats');
  }
  return response.json();
}