"use client";

import { useState } from "react";
import { XCircle } from "lucide-react";
import { updateBookingStatusAction } from "@/app/facilitator/bookings/actions";

type CancelBookingActionProps = {
  bookingId: string;
  currentEventId: string;
};

export function CancelBookingAction({ bookingId, currentEventId }: CancelBookingActionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-red-300 bg-white px-2.5 text-sm font-semibold text-red-800 transition hover:border-red-400 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 sm:w-auto"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <XCircle className="size-3.5" aria-hidden="true" />
        Annuller tilmelding
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/35 px-4">
          <div className="w-full max-w-md rounded-md bg-white p-6 shadow-lift" role="dialog" aria-modal="true" aria-labelledby="cancel-booking-title">
            <h2 className="text-xl font-semibold text-midnight" id="cancel-booking-title">Annuller tilmelding?</h2>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-ink/72">
              <p>Du er ved at annullere denne deltagers tilmelding.</p>
              <p>Eventet bliver ikke annulleret.</p>
              <p>Deltageren modtager automatisk en e-mail om annulleringen.</p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                className="inline-flex h-9 items-center justify-center rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Fortryd
              </button>
              <form action={updateBookingStatusAction}>
                <input name="booking_id" type="hidden" value={bookingId} />
                <input name="current_event_id" type="hidden" value={currentEventId} />
                <input name="status" type="hidden" value="cancelled" />
                <button
                  className="inline-flex h-9 items-center justify-center rounded-md border border-red-300 bg-red-50 px-3 text-sm font-semibold text-red-800 transition hover:bg-red-100"
                  type="submit"
                >
                  Annuller tilmelding
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
