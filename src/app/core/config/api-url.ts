/**
 * Resolves the backend API origin for production (api.pakabet.site) and local dev.
 */
const isLocalDevelopment =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const API_ORIGIN = isLocalDevelopment
  ? 'http://localhost:3022'
  : 'https://api.pakabet.site';

export const API_BASE_URL = `${API_ORIGIN}/api`;
