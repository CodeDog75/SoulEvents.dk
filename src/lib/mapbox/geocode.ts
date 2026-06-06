import { env } from "@/lib/env";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type GeocodeInput = {
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
};

type MapboxFeature = {
  center?: [number, number];
};

type MapboxGeocodeResponse = {
  features?: MapboxFeature[];
};

function buildAddress({ addressLine, postalCode, city }: GeocodeInput) {
  return [addressLine, postalCode, city, "Danmark"].filter(Boolean).join(", ");
}

export async function geocodeDanishAddress(input: GeocodeInput): Promise<Coordinates | null> {
  if (!env.mapboxToken || (!input.addressLine && !input.postalCode && !input.city)) {
    return null;
  }

  const address = buildAddress(input);
  const searchParams = new URLSearchParams({
    access_token: env.mapboxToken,
    country: "dk",
    language: "da",
    limit: "1",
    proximity: "10.2039,56.1629",
    types: "address,place,postcode",
  });

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?${searchParams}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json()) as MapboxGeocodeResponse;
    const center = result.features?.[0]?.center;

    if (!center) {
      return null;
    }

    const [longitude, latitude] = center;
    return { latitude, longitude };
  } catch {
    return null;
  }
}
