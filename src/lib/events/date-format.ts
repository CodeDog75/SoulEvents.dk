export const eventDisplayTimeZone = "Europe/Copenhagen";

function eventDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDanishEventDateTime(value: string | null | undefined, fallback = "Tidspunkt mangler") {
  const date = eventDate(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: eventDisplayTimeZone,
    year: "numeric",
  })
    .format(date)
    .replace(":", ".");
}

export function formatDanishEventDate(value: string | null | undefined, fallback = "Dato mangler") {
  const date = eventDate(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
    timeZone: eventDisplayTimeZone,
    weekday: "long",
    year: "numeric",
  }).format(date);
}

export function formatDanishEventShortDate(value: string | null | undefined, fallback = "Dato mangler") {
  const date = eventDate(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    timeZone: eventDisplayTimeZone,
    year: "numeric",
  }).format(date);
}

export function formatDanishEventTime(value: string | null | undefined, fallback = "Tidspunkt mangler") {
  const date = eventDate(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: eventDisplayTimeZone,
  })
    .format(date)
    .replace(":", ".");
}

export function getDanishEventDateParts(value: string) {
  const date = eventDate(value) ?? new Date(value);
  const parts = new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
    timeZone: eventDisplayTimeZone,
    weekday: "long",
    year: "numeric",
  }).formatToParts(date);

  return {
    day: parts.find((part) => part.type === "day")?.value ?? "",
    month: parts.find((part) => part.type === "month")?.value ?? "",
    weekday: parts.find((part) => part.type === "weekday")?.value ?? "",
    year: parts.find((part) => part.type === "year")?.value ?? "",
  };
}

export function isSameDanishEventDate(start: string, end: string) {
  return formatDanishEventDate(start) === formatDanishEventDate(end);
}
