export function cleanPhoneInput(input) {
  return String(input ?? "")
    .trim()
    .replace(/[\s-]/g, "");
}

// Canonical form: no leading '+'
export function canonicalPhone(input) {
  const cleaned = cleanPhoneInput(input);
  return cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
}

// Returns array [canonical, "+" + canonical] for lookup flexibility
export function makePhoneVariants(rawInput) {
  const c = canonicalPhone(rawInput);
  return [c, "+" + c];
}
