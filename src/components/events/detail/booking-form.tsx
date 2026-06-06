import { Send } from "lucide-react";
import { createBookingAction } from "@/app/events/[id]/actions";

type BookingFormProps = {
  eventId: string;
  availableSeats: number;
};

export function BookingForm({ eventId, availableSeats }: BookingFormProps) {
  const isSoldOut = availableSeats <= 0;

  return (
    <form action={createBookingAction} className="rounded-card bg-white p-6 shadow-soft">
      <input name="event_id" type="hidden" value={eventId} />
      <h2 className="text-4xl font-medium text-olive">Tilmeld dig</h2>
      <p className="mt-1 text-sm text-ink/64">
        {isSoldOut ? "Der er ikke flere ledige pladser." : `${availableSeats} ledige pladser.`}
      </p>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Navn
          <input
            className="h-12 rounded-input border border-olive/15 px-4 text-base outline-none transition focus:border-rose"
            disabled={isSoldOut}
            name="participant_name"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          E-mail
          <input
            className="h-12 rounded-input border border-olive/15 px-4 text-base outline-none transition focus:border-rose"
            disabled={isSoldOut}
            name="participant_email"
            required
            type="email"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Telefonnummer
          <input
            className="h-12 rounded-input border border-olive/15 px-4 text-base outline-none transition focus:border-rose"
            disabled={isSoldOut}
            name="participant_phone"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Antal pladser
          <input
            className="h-12 rounded-input border border-olive/15 px-4 text-base outline-none transition focus:border-rose"
            defaultValue={1}
            disabled={isSoldOut}
            max={Math.max(availableSeats, 1)}
            min={1}
            name="seats"
            required
            type="number"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Besked til facilitator
          <textarea
            className="min-h-28 rounded-input border border-olive/15 p-4 text-base outline-none transition focus:border-rose"
            disabled={isSoldOut}
            name="message"
            placeholder="Maks. 200 ord"
          />
        </label>
      </div>

      <button
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-button bg-rose px-5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift disabled:cursor-not-allowed disabled:bg-olive/40"
        disabled={isSoldOut}
        type="submit"
      >
        <Send className="size-4" aria-hidden="true" />
        Send tilmelding
      </button>
    </form>
  );
}
