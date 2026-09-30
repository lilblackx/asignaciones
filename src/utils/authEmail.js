import { AUTH_EMAIL_DOMAIN } from '../constants';

// Lista blanca: solo letras/números ASCII, punto, guion y guion bajo.
// Corta cualquier símbolo raro (comillas, ; -- etc.) o emoji antes de que
// termine formando parte del email ficticio que usa Firebase Auth.
export function normalizeUsername(username) {
  return username.trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
}

export function usernameToAuthEmail(username) {
  return `${normalizeUsername(username)}@${AUTH_EMAIL_DOMAIN}`;
}
