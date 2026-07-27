export type MoonData = {
  illumination: number;
  moonrise: string | null;
  moonset: string | null;
  phase: string;
  phaseDanish: string;
};

const fallbackMoonData: MoonData = {
  illumination: 0,
  moonrise: null,
  moonset: null,
  phase: "Unknown",
  phaseDanish: "Månefase",
};

const phaseLabels: Record<string, string> = {
  "First Quarter": "Første kvarter",
  "Full Moon": "Fuldmåne",
  "Last Quarter": "Sidste kvarter",
  "New Moon": "Nymåne",
  "Waning Crescent": "Aftagende månesegl",
  "Waning Gibbous": "Aftagende måne",
  "Waxing Crescent": "Tiltagende månesegl",
  "Waxing Gibbous": "Tiltagende måne",
};

type WeatherApiAstronomyResponse = {
  astronomy?: {
    astro?: {
      moon_illumination?: string | number | null;
      moon_phase?: string | null;
      moonrise?: string | null;
      moonset?: string | null;
    };
  };
};

function copenhagenDateString(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Copenhagen",
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return values.year + "-" + values.month + "-" + values.day;
}

function formatWeatherApiTime(value: string | null | undefined) {
  if (!value || value.toLowerCase().includes("no moon")) return null;

  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return value;

  const [, hourValue, minute, meridiem] = match;
  let hour = Number(hourValue);

  if (meridiem.toUpperCase() === "PM" && hour < 12) hour += 12;
  if (meridiem.toUpperCase() === "AM" && hour === 12) hour = 0;

  return String(hour).padStart(2, "0") + "." + minute;
}

export async function getMoonData(date = new Date()): Promise<MoonData> {
  const apiKey = process.env.WEATHERAPI_KEY;

  if (!apiKey) {
    console.warn("[weatherapi] WEATHERAPI_KEY is missing; using moon fallback data");
    return fallbackMoonData;
  }

  const url = new URL("https://api.weatherapi.com/v1/astronomy.json");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", "Holbaek");
  url.searchParams.set("dt", copenhagenDateString(date));

  try {
    const response = await fetch(url, {
      next: { revalidate: 86_400 },
    });

    if (!response.ok) {
      console.error("[weatherapi] Astronomy request failed", {
        status: response.status,
        statusText: response.statusText,
      });
      return fallbackMoonData;
    }

    const data = (await response.json()) as WeatherApiAstronomyResponse;
    const astro = data.astronomy?.astro;
    const phase = astro?.moon_phase ?? fallbackMoonData.phase;
    const illumination = Number(astro?.moon_illumination);

    return {
      illumination: Number.isFinite(illumination) ? illumination : fallbackMoonData.illumination,
      moonrise: formatWeatherApiTime(astro?.moonrise),
      moonset: formatWeatherApiTime(astro?.moonset),
      phase,
      phaseDanish: phaseLabels[phase] ?? fallbackMoonData.phaseDanish,
    };
  } catch (error) {
    console.error("[weatherapi] Astronomy request could not be completed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return fallbackMoonData;
  }
}
