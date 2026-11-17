import { cache } from 'react';

// Server-side loaders for public student reviews (GET /api/reviews/...). A failure returns null so
// the page renders without the reviews rather than failing as a whole.
const apiUrl = process.env.API_URL || 'http://127.0.0.1:4100';

async function load(path) {
  try {
    const response = await fetch(`${apiUrl}/api/reviews${path}`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`responded ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`[reviews] ${path || '/'} unavailable: ${error.message}`);
    return null;
  }
}

export const getReviewSummary = cache(() => load('/summary'));
export const getReviewHighlights = cache((limit = 24) => load(`/highlights?limit=${limit}`));
export const getReviewPage = cache((rating = '') => load(`?limit=12${rating ? `&rating=${rating}` : ''}`));
export const getReviewForm = cache(() => load('/form'));
