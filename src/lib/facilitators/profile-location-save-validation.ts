export type ProfileLocationSaveValidationInput = {
  city: string;
  countryName: string;
  isDanishLocation: boolean;
  isOtherCountry: boolean;
  postalCode: string;
  requireComplete?: boolean;
  requireOtherCountryName?: boolean;
};

export type ProfileLocationSaveValidationResult = {
  canSave: boolean;
  completenessValidationMessage: string;
  formatValidationMessage: string;
  isComplete: boolean;
  validationMessage: string;
};

export function getProfileLocationSaveValidation({
  city,
  countryName,
  isDanishLocation,
  isOtherCountry,
  postalCode,
  requireComplete = true,
  requireOtherCountryName = true,
}: ProfileLocationSaveValidationInput): ProfileLocationSaveValidationResult {
  const formatValidationMessage = isDanishLocation
    ? postalCode && !/^\d{4}$/.test(postalCode)
      ? "Dansk postnummer skal bestå af fire cifre."
      : postalCode.length === 4 && !city
        ? "Vi kunne ikke finde en by til dette postnummer."
        : ""
    : postalCode && !/^[A-Z0-9 -]{1,16}$/.test(postalCode)
      ? "Postnummeret må kun indeholde bogstaver, tal, mellemrum og bindestreg."
      : "";

  const completenessValidationMessage = requireComplete
    ? isDanishLocation
      ? !postalCode
        ? "Indtast postnummer, så finder vi automatisk byen."
        : !city
          ? "Vi kunne ikke finde en by til dette postnummer."
          : ""
      : requireOtherCountryName && isOtherCountry && !countryName
        ? "Skriv landets navn."
        : !postalCode || !city
          ? "Postnummer og by skal udfyldes."
          : ""
    : "";

  const validationMessage =
    formatValidationMessage || completenessValidationMessage;

  return {
    canSave: !formatValidationMessage,
    completenessValidationMessage,
    formatValidationMessage,
    isComplete: !validationMessage,
    validationMessage,
  };
}
