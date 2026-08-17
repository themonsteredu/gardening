const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeClassCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

export function generateClassCode(random: () => number = Math.random): string {
  return Array.from({ length: 8 }, () => {
    const index = Math.floor(random() * CODE_ALPHABET.length);
    return CODE_ALPHABET[Math.min(index, CODE_ALPHABET.length - 1)];
  }).join("");
}

export function isClassCodeValid(value: string): boolean {
  return /^[A-Z0-9]{6,10}$/.test(normalizeClassCode(value));
}
