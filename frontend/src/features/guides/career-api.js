// Server-side loader for the counsellor directory. Sent without cookies, so the server render never
// holds counsellors' phone numbers; Counsellors.js fetches those in the browser after login.
// null when the API is unreachable (the section then retries from the browser).
const apiUrl = process.env.API_URL || 'http://127.0.0.1:4100';

export async function getCareerDirectory() {
  try {
    const response = await fetch(`${apiUrl}/api/career/fields`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`responded ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`[career] Counsellor directory unavailable: ${error.message}`);
    return null;
  }
}
