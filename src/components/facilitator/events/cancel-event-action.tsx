"use client";

import { useState } from "react";
import { PauseCircle } from "lucide-react";
import { updateEventStatusAction } from "@/app/facilitator/events/actions";

type CancelEventActionProps = {
  eventId: string;
  eventTitle: string;
};

export function CancelEventAction({ eventId, eventTitle }: CancelEventActionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-red-200 bg-white/70 px-3 text-xs font-semibold text-red-800 transition hover:bg-red-50"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <PauseCircle className="size-3.5" aria-hidden="true" />
        Aflys
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/35 px-4 py-6">
          <section className="w-full max-w-md rounded-card bg-white p-5 shadow-lift sm:p-6" role="dialog" aria-modal="true" aria-labelledby="cancel-event-title">
            <h2 className="text-xl font-semibold text-midnight" id="cancel-event-title">Aflys event?</h2>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-ink/72">
              <p>Du er ved at aflyse eventet “{eventTitle || "Event uden titel"}”.</p>
              <p>Eventet bliver ikke længere vist som aktivt, og tilmelding lukkes.</p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                className="inline-flex h-9 items-center justify-center rounded-full border border-midnight/15 bg-white px-4 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Fortryd
              </button>
              <form action={updateEventStatusAction}>
                <input name="event_id" type="hidden" value={eventId} />
                <input name="status" type="hidden" value="cancelled" />
                <input name="confirm_cancel_event" type="hidden" value="yes" />
                <button
                  className="inline-flex h-9 items-center justify-center rounded-full border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-800 transition hover:bg-red-100"
                  type="submit"
                >
                  Aflys event
                </button>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
