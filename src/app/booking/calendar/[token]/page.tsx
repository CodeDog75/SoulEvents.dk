import type { ReactNode } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { getAppUrl } from "@/lib/app-url";
import { participantCalendarInputFromBooking } from "@/lib/bookings/participant-calendar";
import {
  canParticipantUseCalendar,
  getBookingByParticipantToken,
} from "@/lib/bookings/public-booking-access";
import { googleCalendarUrl } from "@/lib/calendar/booking-calendar";

type CalendarPageProps = {
  params: Promise<{ token: string }>;
};

function Card({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#FAF7F2] px-5 py-8 text-[#2F2633] sm:px-8">
      <section className="mx-auto max-w-3xl rounded-[28px] border border-[#E5D4F7] bg-white p-6 shadow-[0_18px_55px_rgba(47,38,51,0.08)] sm:p-10">
        {children}
      </section>
    </main>
  );
}

export default async function BookingCalendarPage({ params }: CalendarPageProps) {
  const { token } = await params;
  const booking = await getBookingByParticipantToken(token);

  if (!booking || !canParticipantUseCalendar(booking)) {
    return (
      <Card>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#7A4EAB]">Kalender</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-[#4B5645] sm:text-5xl">
          Kalenderlinket kan ikke bruges
        </h1>
        <p className="mt-5 text-lg text-[#6E6475]">
          Eventet kan være aflyst eller afsluttet, eller tilmeldingen er ikke længere bekræftet.
        </p>
        <Link className="mt-8 inline-flex rounded-full border border-[#E5D4F7] bg-white px-6 py-3 font-semibold text-[#7A4EAB]" href="/">
          Til forsiden
        </Link>
      </Card>
    );
  }

  const requestHeaders = await headers();
  const input = participantCalendarInputFromBooking(booking, getAppUrl(requestHeaders.get("origin") ?? undefined));

  if (!input) {
    return (
      <Card>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#7A4EAB]">Kalender</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-[#4B5645] sm:text-5xl">
          Kalenderaftalen kunne ikke hentes
        </h1>
        <p className="mt-5 text-lg text-[#6E6475]">Prøv at åbne linket igen senere.</p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#7A4EAB]">Kalender</p>
      <h1 className="mt-3 font-serif text-4xl font-semibold text-[#4B5645] sm:text-5xl">
        Tilføj eventet til din kalender
      </h1>
      <p className="mt-5 text-lg text-[#6E6475]">
        Vælg den kalender, du bruger. Kalenderaftalen indeholder kun oplysninger om eventet.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <a
          className="rounded-full bg-[#7A4EAB] px-6 py-3 text-center font-semibold text-white shadow-[0_14px_30px_rgba(122,78,171,0.22)]"
          href={googleCalendarUrl(input)}
          rel="noreferrer"
          target="_blank"
        >
          Google Kalender
        </a>
        <a
          className="rounded-full border border-[#E5D4F7] bg-white px-6 py-3 text-center font-semibold text-[#7A4EAB]"
          href={`/booking/calendar/${encodeURIComponent(token)}/ics`}
        >
          Apple Kalender / Outlook
        </a>
      </div>

      <p className="mt-6 rounded-2xl bg-[#FAF7F2] p-4 text-sm leading-relaxed text-[#6E6475]">
        Kalenderaftalen opdateres ikke automatisk, hvis arrangøren ændrer eventet senere. Se altid de aktuelle
        oplysninger på eventets side på SoulEvents.
      </p>
    </Card>
  );
}
