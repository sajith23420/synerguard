const BASE_URL = '/api';

/**
 * Search for drugs by query string
 * @param {string} query - Search query (minimum 2 characters)
 * @returns {Promise<{results: string[], fuzzy: boolean}>} Matches, and whether
 *   they came from a typo-tolerant fallback rather than a literal match
 */
export async function searchDrugs(query) {
  if (!query || query.length < 2) return { results: [], fuzzy: false };

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