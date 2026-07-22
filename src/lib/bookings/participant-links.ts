import { getAppUrl } from "@/lib/app-url";

function cleanToken(token: string | null | undefined) {
  return (token || "").trim();
}

export function participantCancelUrl(token: string | null | undefined, origin?: string | null) {
  const safeToken = cleanToken(token);
  return safeToken ? `${getAppUrl(origin ?? undefined)}/booking/cancel/${encodeURIComponent(safeToken)}` : null;
}

export function participantCalendarUrl(token: string | null | undefined, origin?: string | null) {
  const safeToken = cleanToken(token);
  return safeToken ? `${getAppUrl(origin ?? undefined)}/booking/calendar/${encodeURIComponent(safeToken)}` : null;
}
