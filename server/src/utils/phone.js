export function cleanPhoneInput(input) {
  const s = String(input ?? "")
    .trim()
    .replace(/[\s-]/g, "");
  return s;
}

export function makePhoneVariants(rawInput) {
  const raw = cleanPhoneInput(rawInput);
  const set = new Set([raw]);
  if (raw.startsWith("+")) set.add(raw.slice(1));
  else set.add("+" + raw);
  return Array.from(set);
}
