export type SplitNameParts = {
  firstName: string;
  fullName: string;
  lastName: string;
};

function cleanNamePart(value?: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function composeFullName(firstName?: string | null, lastName?: string | null) {
  return [cleanNamePart(firstName), cleanNamePart(lastName)].filter(Boolean).join(" ");
}

export function splitLegacyFullName(fullName?: string | null): SplitNameParts {
  const parts = cleanNamePart(fullName).split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    const firstName = parts[0] ?? "";
    return {
      firstName,
      fullName: firstName,
      lastName: "",
    };
  }

  const lastName = parts[parts.length - 1] ?? "";
  const firstName = parts.slice(0, -1).join(" ");

  return {
    firstName,
    fullName: composeFullName(firstName, lastName),
    lastName,
  };
}

export function resolveNameParts(input: {
  firstName?: string | null;
  fullName?: string | null;
  lastName?: string | null;
}): SplitNameParts {
  const firstName = cleanNamePart(input.firstName);
  const lastName = cleanNamePart(input.lastName);

  if (firstName || lastName) {
    return {
      firstName,
      fullName: composeFullName(firstName, lastName) || cleanNamePart(input.fullName),
      lastName,
    };
  }

  return splitLegacyFullName(input.fullName);
}
