export function isValidPhone(phone) {
  if (typeof phone !== 'string') return false;
  const p = phone.trim();
  // Minimal E.164-like: optional +, starts 1-9, total 8-15 digits
  const re = /^\+?[1-9]\d{7,14}$/;
  return re.test(p);
}

export function isStrongPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}
