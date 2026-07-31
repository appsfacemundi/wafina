/**
 * Thrown only after retrying a transient Google Sheets failure (rate limit,
 * momentary network blip) and still not succeeding. Distinct from a generic
 * 500 so the client can show a "try again in a moment" message instead of a
 * raw "Internal server error" — this is the backend genuinely being
 * temporarily unavailable, not a bug in the request itself.
 */
export class TransientServiceError extends Error {}
