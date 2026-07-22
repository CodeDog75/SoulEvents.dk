import { publicEventPath } from "@/lib/slug";

export const calendarTimeZone = "Europe/Copenhagen";

export type CalendarEventInput = {
  addressLine?: string | null;
  city?: string | null;
  country?: string | null;
  endsAt: string;
  eventFormat?: string | null;
  eventId: string;
  eventSlug?: string | null;
  facilitatorName: string;
  onlineUrlOrNote?: string | null;
  postalCode?: string | null;
  siteUrl: string;
  startsAt: string;
  title: string;
};

function cleanSiteUrl(siteUrl: string) {
  return siteUrl.trim().replace(/\/$/, "");
}

function utcStamp(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcsLine(line: string) {
  const chunks: string[] = [];
  let rest = line;

  while (rest.length > 74) {
    chunks.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }

  chunks.push(rest);
  return chunks.join("\r\n");
}

function eventUrl(input: CalendarEventInput) {
  return cleanSiteUrl(input.siteUrl) + publicEventPath(input.eventSlug || input.eventId);
}

function isLikelyUrl(value: string | null | undefined) {
  return Boolean(value && /^https?:\/\//i.test(value.trim()));
}

export function calendarLocation(input: CalendarEventInput) {
  if (input.eventFormat === "online") {
    return isLikelyUrl(input.onlineUrlOrNote) ? input.onlineUrlOrNote?.trim() ?? "" : "Online";
  }

  return [input.addressLine, [input.postalCode, input.city].filter(Boolean).join(" "), input.country]
    .filter(Boolean)
    .join(", ");
}

export function calendarDescription(input: CalendarEventInput) {
  const lines = [
    `Arrangør: ${input.facilitatorName}`,
    input.eventFormat === "online" && isLikelyUrl(input.onlineUrlOrNote) ? `Online-link: ${input.onlineUrlOrNote?.trim()}` : "",
    "",
    "Se altid de aktuelle oplysninger på eventets side på SoulEvents.",
    eventUrl(input),
  ];

  return lines.filter((line, index, all) => line || all[index - 1]).join("\n").trim();
}

export function googleCalendarUrl(input: CalendarEventInput) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    ctz: calendarTimeZone,
    dates: `${utcStamp(input.startsAt)}/${utcStamp(input.endsAt)}`,
    details: calendarDescription(input),
    location: calendarLocation(input),
    text: input.title,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsCalendar(input: CalendarEventInput) {
  const publicUrl = eventUrl(input);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SoulEvents//Booking Calendar//DA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:soulevents-event-${input.eventSlug || input.eventId}@soulevents.dk`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(input.startsAt)}`,
    `DTEND:${utcStamp(input.endsAt)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
    `DESCRIPTION:${escapeIcsText(calendarDescription(input))}`,
    `LOCATION:${escapeIcsText(calendarLocation(input))}`,
    `URL:${escapeIcsText(publicUrl)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
