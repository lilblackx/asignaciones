export const PASSWORD_POLICY_HINT = 'Mínimo 8 caracteres, con mayúscula, minúscula y número.';

export function getPasswordPolicyError(password) {
  if (password.length < 8) return 'La clave debe tener al menos 8 caracteres.';
  if (!/[A-Z]/.test(password)) return 'La clave debe incluir al menos una mayúscula.';
  if (!/[a-z]/.test(password)) return 'La clave debe incluir al menos una minúscula.';
  if (!/[0-9]/.test(password)) return 'La clave debe incluir al menos un número.';
  return '';
}
