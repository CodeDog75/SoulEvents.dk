import assert from "node:assert/strict";
import test from "node:test";
import { getProfileLocationSaveValidation } from "./profile-location-save-validation.ts";

test("draft save allows an incomplete Danish location", () => {
  const result = getProfileLocationSaveValidation({
    city: "",
    countryName: "",
    isDanishLocation: true,
    isOtherCountry: false,
    postalCode: "",
    requireComplete: false,
  });

  assert.equal(result.canSave, true);
  assert.equal(result.validationMessage, "");
});

test("review requires postal code and city for Denmark", () => {
  const result = getProfileLocationSaveValidation({
    city: "",
    countryName: "",
    isDanishLocation: true,
    isOtherCountry: false,
    postalCode: "",
    requireComplete: true,
  });

  assert.equal(result.canSave, true);
  assert.equal(
    result.validationMessage,
    "Indtast postnummer, så finder vi automatisk byen.",
  );
});

test("draft save rejects an invalid Danish postal code when it is present", () => {
  const result = getProfileLocationSaveValidation({
    city: "",
    countryName: "",
    isDanishLocation: true,
    isOtherCountry: false,
    postalCode: "200",
    requireComplete: false,
  });

  assert.equal(result.canSave, false);
  assert.equal(result.validationMessage, "Dansk postnummer skal bestå af fire cifre.");
});

test("draft save accepts a complete Danish location", () => {
  const result = getProfileLocationSaveValidation({
    city: "Frederiksberg",
    countryName: "",
    isDanishLocation: true,
    isOtherCountry: false,
    postalCode: "2000",
    requireComplete: false,
  });

  assert.equal(result.canSave, true);
  assert.equal(result.validationMessage, "");
});

test("draft save allows incomplete custom country location", () => {
  const result = getProfileLocationSaveValidation({
    city: "",
    countryName: "",
    isDanishLocation: false,
    isOtherCountry: true,
    postalCode: "",
    requireComplete: false,
    requireOtherCountryName: false,
  });

  assert.equal(result.canSave, true);
  assert.equal(result.validationMessage, "");
});

test("review requires custom country name for other country", () => {
  const result = getProfileLocationSaveValidation({
    city: "Tokyo",
    countryName: "",
    isDanishLocation: false,
    isOtherCountry: true,
    postalCode: "100-0001",
    requireComplete: true,
    requireOtherCountryName: true,
  });

  assert.equal(result.canSave, true);
  assert.equal(result.validationMessage, "Skriv landets navn.");
});

test("foreign postal code accepts letters, numbers, spaces and hyphen", () => {
  const result = getProfileLocationSaveValidation({
    city: "London",
    countryName: "",
    isDanishLocation: false,
    isOtherCountry: false,
    postalCode: "SW1A 1AA",
    requireComplete: true,
  });

  assert.equal(result.canSave, true);
  assert.equal(result.validationMessage, "");
});
