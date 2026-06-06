type RegionInput = {
  city: string | null;
  postalCode: string | null;
};

function normalize(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function inferRegionSlug({ city, postalCode }: RegionInput) {
  const normalizedCity = normalize(city);
  const postal = Number.parseInt(normalize(postalCode), 10);

  if (normalizedCity.includes("bornholm") || (postal >= 3700 && postal <= 3799)) {
    return "bornholm";
  }

  if (
    normalizedCity.includes("københavn") ||
    normalizedCity.includes("koebenhavn") ||
    normalizedCity.includes("frederiksberg") ||
    (postal >= 1000 && postal <= 2999)
  ) {
    return "storkobenhavn";
  }

  if (postal >= 3000 && postal <= 3699) {
    return "nordsjaelland";
  }

  if (postal >= 4000 && postal <= 4399) {
    return "midtsjaelland";
  }

  if (postal >= 4400 && postal <= 4699) {
    return "vestsjaelland";
  }

  if (postal >= 4700 && postal <= 4999) {
    return "sydsjaelland";
  }

  if (postal >= 5000 && postal <= 5999) {
    return "fyn";
  }

  if (postal >= 6000 && postal <= 6999) {
    return "sonderjylland";
  }

  if (postal >= 7000 && postal <= 8999) {
    return "midtjylland";
  }

  if (postal >= 9000 && postal <= 9999) {
    return "nordjylland";
  }

  return null;
}
