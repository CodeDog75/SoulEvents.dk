export type YearRhythmEventType =
  | "autumn_equinox"
  | "full_moon"
  | "new_moon"
  | "spring_equinox"
  | "summer_solstice"
  | "winter_solstice";

export type YearRhythmEvent = {
  createEventTitle: string;
  date: Date;
  description: string;
  ideas: string[];
  localDate: string;
  title: string;
  type: YearRhythmEventType;
};

const timeZone = "Europe/Copenhagen";
const synodicMonthDays = 29.530588853;
const knownNewMoonUtc = Date.UTC(2000, 0, 6, 18, 14);
const millisecondsPerDay = 86_400_000;

const eventCopy: Record<YearRhythmEventType, Omit<YearRhythmEvent, "date" | "localDate" | "type">> = {
  autumn_equinox: {
    createEventTitle: "Efterårsjævndøgn",
    description:
      "Mange bruger efterårsjævndøgnet som anledning til at samle op, takke af og skabe ro før den mørkere tid.",
    ideas: ["Refleksionscirkel", "Ritual for balance", "Rolig aften med meditation"],
    title: "Efterårsjævndøgn",
  },
  full_moon: {
    createEventTitle: "Fuldmånecirkel",
    description:
      "Mange spirituelle traditioner forbinder fuldmånen med fællesskab, refleksion og afslutning.",
    ideas: ["Fuldmånecirkel", "Lydbad ved fuldmåne", "Aftenmeditation"],
    title: "Fuldmåne",
  },
  new_moon: {
    createEventTitle: "Nymånemeditation",
    description:
      "Nymånen bruges ofte som roligt tidspunkt til nye intentioner, fordybelse og en frisk begyndelse.",
    ideas: ["Nymånemeditation", "Intention workshop", "Stille yoga og journaling"],
    title: "Nymåne",
  },
  spring_equinox: {
    createEventTitle: "Forårsjævndøgn",
    description:
      "Forårsjævndøgnet markerer lysere dage og kan bruges som inspiration til fornyelse og bevægelse.",
    ideas: ["Forårsritual", "Yoga for ny energi", "Fællesskab om begyndelser"],
    title: "Forårsjævndøgn",
  },
  summer_solstice: {
    createEventTitle: "Sommersolhverv",
    description:
      "Sommersolhverv er årets lyseste vendepunkt og kan inspirere til fællesskab, natur og taknemmelighed.",
    ideas: ["Sommercirkel", "Udendørs meditation", "Aften omkring bålet"],
    title: "Sommersolhverv",
  },
  winter_solstice: {
    createEventTitle: "Vintersolhverv",
    description:
      "Vintersolhverv markerer årets mørkeste vendepunkt og kan danne ramme om ro, nærvær og ny begyndelse.",
    ideas: ["Lysceremoni", "Meditativ vinteraften", "Rolig refleksionsworkshop"],
    title: "Vintersolhverv",
  },
};

function copenhagenParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function copenhagenDateKey(date: Date) {
  const parts = copenhagenParts(date);
  return parts.year + "-" + parts.month + "-" + parts.day;
}

function copenhagenDateToUtcNoon(date: Date) {
  const parts = copenhagenParts(date);
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12);
}

function daysUntilLocalDate(date: Date, now: Date) {
  return Math.round((copenhagenDateToUtcNoon(date) - copenhagenDateToUtcNoon(now)) / millisecondsPerDay);
}

function julianDayToDate(julianDay: number) {
  return new Date((julianDay - 2_440_587.5) * millisecondsPerDay);
}

function seasonJulianDay(year: number, type: Exclude<YearRhythmEventType, "full_moon" | "new_moon">) {
  const y = (year - 2000) / 1000;
  const formulas = {
    autumn_equinox: 2_451_810.21715 + 365_242.01767 * y - 0.11575 * y ** 2 + 0.00337 * y ** 3 + 0.00078 * y ** 4,
    spring_equinox: 2_451_623.80984 + 365_242.37404 * y + 0.05169 * y ** 2 - 0.00411 * y ** 3 - 0.00057 * y ** 4,
    summer_solstice: 2_451_716.56767 + 365_241.62603 * y + 0.00325 * y ** 2 + 0.00888 * y ** 3 - 0.0003 * y ** 4,
    winter_solstice: 2_451_900.05952 + 365_242.74049 * y - 0.06223 * y ** 2 - 0.00823 * y ** 3 + 0.00032 * y ** 4,
  };

  return formulas[type];
}

function buildEvent(type: YearRhythmEventType, date: Date): YearRhythmEvent {
  return {
    ...eventCopy[type],
    date,
    localDate: copenhagenDateKey(date),
    type,
  };
}

function moonEventsBetween(start: Date, end: Date) {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const firstCycle = Math.floor((startMs - knownNewMoonUtc) / (synodicMonthDays * millisecondsPerDay)) - 1;
  const events: YearRhythmEvent[] = [];

  for (let cycle = firstCycle; cycle < firstCycle + 40; cycle += 1) {
    const newMoon = new Date(knownNewMoonUtc + cycle * synodicMonthDays * millisecondsPerDay);
    const fullMoon = new Date(knownNewMoonUtc + (cycle + 0.5) * synodicMonthDays * millisecondsPerDay);

    if (newMoon.getTime() >= startMs && newMoon.getTime() <= endMs) {
      events.push(buildEvent("new_moon", newMoon));
    }

    if (fullMoon.getTime() >= startMs && fullMoon.getTime() <= endMs) {
      events.push(buildEvent("full_moon", fullMoon));
    }
  }

  return events;
}

export function getYearRhythmCalendar(now = new Date()) {
  const startYear = Number(copenhagenParts(now).year);
  const start = new Date(Date.UTC(startYear, 0, 1));
  const end = new Date(Date.UTC(startYear + 1, 11, 31, 23, 59, 59));
  const seasonEvents: YearRhythmEvent[] = [];

  for (const year of [startYear, startYear + 1]) {
    seasonEvents.push(
      buildEvent("spring_equinox", julianDayToDate(seasonJulianDay(year, "spring_equinox"))),
      buildEvent("summer_solstice", julianDayToDate(seasonJulianDay(year, "summer_solstice"))),
      buildEvent("autumn_equinox", julianDayToDate(seasonJulianDay(year, "autumn_equinox"))),
      buildEvent("winter_solstice", julianDayToDate(seasonJulianDay(year, "winter_solstice"))),
    );
  }

  return [...moonEventsBetween(start, end), ...seasonEvents]
    .filter((event) => event.date >= start && event.date <= end)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function getUpcomingYearRhythmEvents(now = new Date(), limit?: number) {
  const events = getYearRhythmCalendar(now).filter((event) => daysUntilLocalDate(event.date, now) >= 0);
  return typeof limit === "number" ? events.slice(0, limit) : events;
}

export function getNextMoonRhythmEvent(now = new Date()) {
  return getUpcomingYearRhythmEvents(now).find((event) => event.type === "full_moon" || event.type === "new_moon") ?? null;
}

export function getNextMoonRhythmMenuStatus(now = new Date()) {
  const event = getNextMoonRhythmEvent(now);
  if (!event) return null;

  return event.title + " " + getYearRhythmCountdown(event.date, now);
}

export function formatYearRhythmDate(date: Date, options: { includeTime?: boolean; includeYear?: boolean } = {}) {
  const formatter = new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    hour: options.includeTime ? "2-digit" : undefined,
    minute: options.includeTime ? "2-digit" : undefined,
    month: "long",
    timeZone,
    weekday: "long",
    year: options.includeYear === false ? undefined : "numeric",
  });

  return formatter.format(date).replace(" kl. ", " kl. ");
}

export function getYearRhythmCountdown(date: Date, now = new Date()) {
  const days = daysUntilLocalDate(date, now);

  if (days === 0) return "i dag";
  if (days === 1) return "i morgen";
  if (days > 1) return "om " + days + " dage";
  if (days === -1) return "i går";
  return "for " + Math.abs(days) + " dage siden";
}

export function rhythmEventCreateHref(event: YearRhythmEvent) {
  const params = new URLSearchParams({
    prefill_date: event.localDate,
    prefill_source: "year-rhythm",
    prefill_title: event.createEventTitle,
    returnTo: "/facilitator/year-rhythm",
  });

  return "/facilitator/events?" + params.toString();
}
