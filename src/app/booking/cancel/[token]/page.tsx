import type { ReactNode } from "react";
import Link from "next/link";
import { cancelParticipantBookingAction } from "@/app/booking/cancel/[token]/actions";
import {
  canParticipantCancelBooking,
  getBookingByParticipantToken,
  publicBookingEvent,
} from "@/lib/bookings/public-booking-access";
import { formatDanishEventDateTime } from "@/lib/events/date-format";
import { publicEventPath } from "@/lib/slug";

type CancelBookingPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
};

function formatDate(value: string) {
  return formatDanishEventDateTime(value);
}

function formatSeats(seats: number) {
  return seats === 1 ? "1 plads" : `${seats} pladser`;
}

function Card({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#FAF7F2] px-5 py-8 text-[#2F2633] sm:px-8">
      <section className="mx-auto max-w-3xl rounded-[28px] border border-[#E5D4F7] bg-white p-6 shadow-[0_18px_55px_rgba(47,38,51,0.08)] sm:p-10">
        {children}
      </section>
    </main>
  );
}

export default async function CancelBookingPage({ params, searchParams }: CancelBookingPageProps) {
  const [{ token }, { status }] = await Promise.all([params, searchParams]);
  const booking = await getBookingByParticipantToken(token);
  const event = publicBookingEvent(booking);
  const eventHref = event ? publicEventPath(event.slug || event.id) : "/";

  if (status === "cancelled") {
    return (
      <Card>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#7A4EAB]">Afmeld tilmelding</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-[#4B5645] sm:text-5xl">Din tilmelding er afmeldt</h1>
        <p className="mt-5 text-lg text-[#6E6475]">Arrangøren har fået besked.</p>
        <Link className="mt-8 inline-flex rounded-full bg-[#4B5645] px-6 py-3 font-semibold text-white" href={eventHref}>
          Til eventet
        </Link>
      </Card>
    );
  }

  if (!booking || !event || !canParticipantCancelBooking(booking) || status === "unavailable") {
    return (
      <Card>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#7A4EAB]">Afmeld tilmelding</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-[#4B5645] sm:text-5xl">Denne tilmelding kan ikke længere afmeldes</h1>
        <p className="mt-5 text-lg text-[#6E6475]">Linket kan være udløbet, eventet kan være afsluttet, eller tilmeldingen kan allerede være behandlet.</p>
        <Link className="mt-8 inline-flex rounded-full border border-[#E5D4F7] bg-white px-6 py-3 font-semibold text-[#7A4EAB]" href="/">
          Til forsiden
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#7A4EAB]">Afmeld tilmelding</p>
      <h1 className="mt-3 font-serif text-4xl font-semibold text-[#4B5645] sm:text-5xl">Afmeld tilmelding</h1>
      <div className="mt-7 rounded-3xl bg-[#FAF7F2] p-5 text-lg">
        <p className="font-bold text-[#4B5645]">{event.title || booking.event_title_snapshot}</p>
        <p className="mt-2 text-[#6E6475]">{formatDate(event.starts_at || booking.event_starts_at_snapshot)}</p>
        <p className="mt-2 text-[#6E6475]">{formatSeats(booking.seats)}</p>
      </div>
      <p className="mt-7 text-lg text-[#2F2633]">Er du sikker på, at du vil afmelde din tilmelding?</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <form action={cancelParticipantBookingAction}>
          <input name="token" type="hidden" value={token} />
          <button className="w-full rounded-full bg-[#7A4EAB] px-6 py-3 font-semibold text-white sm:w-auto" type="submit">
            Ja, afmeld min tilmelding
          </button>
        </form>
        <Link className="rounded-full border border-[#E5D4F7] bg-white px-6 py-3 text-center font-semibold text-[#7A4EAB]" href={eventHref}>
          Behold min tilmelding
        </Link>
      </div>
    </Card>
  );
}
