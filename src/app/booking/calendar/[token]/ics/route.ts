import { getAppUrl } from "@/lib/app-url";
import { participantCalendarInputFromBooking } from "@/lib/bookings/participant-calendar";
import {
  canParticipantUseCalendar,
  getBookingByParticipantToken,
} from "@/lib/bookings/public-booking-access";
import { buildIcsCalendar } from "@/lib/calendar/booking-calendar";

type IcsRouteContext = {
  params: Promise<{ token: string }>;
};

function safeFilename(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/æ/g, "ae")
      .replace(/ø/g, "oe")
      .replace(/å/g, "aa")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "soulevents"
  );
}

export async function GET(request: Request, { params }: IcsRouteContext) {
  const { token } = await params;
  const booking = await getBookingByParticipantToken(token);

  if (!booking || !canParticipantUseCalendar(booking)) {
    return new Response("Denne kalenderaftale kan ikke længere hentes.", {
      headers: { "content-type": "text/plain; charset=utf-8" },
      status: 410,
    });
  }

  const siteUrl = getAppUrl(new URL(request.url).origin);
  const input = participantCalendarInputFromBooking(booking, siteUrl);

  if (!input) {
    return new Response("Kalenderaftalen kunne ikke hentes.", {
      headers: { "content-type": "text/plain; charset=utf-8" },
      status: 404,
    });
  }

  return new Response(buildIcsCalendar(input), {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="${safeFilename(input.title)}.ics"`,
      "content-type": "text/calendar; charset=utf-8",
    },
  });
}
