export const danishPhoneValidationMessage =
  "Indtast et gyldigt dansk telefonnummer med 8 cifre.";

export function normalizeDanishPhoneNumber(value: string) {
  const compactValue = value.replace(/[\s\-()]/g, "").trim();

  if (!compactValue) {
    return "";
  }

  if (!/^(?:\+?\d+)$/.test(compactValue)) {
    return null;
  }

  const digits = compactValue.replace(/\D/g, "");
  const localNumber =
    digits.length === 10 && digits.startsWith("45")
      ? digits.slice(2)
      : digits.length === 12 && digits.startsWith("0045")
        ? digits.slice(4)
        : digits;

  return /^\d{8}$/.test(localNumber) ? localNumber : null;
}

export function isValidDanishPhoneNumber(value: string) {
  return normalizeDanishPhoneNumber(value) !== null;
}
