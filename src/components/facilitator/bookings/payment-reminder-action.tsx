"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Send, X } from "lucide-react";
import { sendBookingPaymentReminderAction } from "@/app/facilitator/bookings/actions";

type PaymentReminderActionProps = {
  bookingId: string;
  currentEventId: string;
  disabledReason?: string | null;
  latestReminderAt?: string | null;
  participantEmail: string;
  participantName: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function PaymentReminderAction({
  bookingId,
  currentEventId,
  disabledReason,
  latestReminderAt,
  participantEmail,
  participantName,
}: PaymentReminderActionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    wasOpenRef.current = true;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen && wasOpenRef.current) {
      openerRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <div className="grid gap-1">
      <button
        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
        disabled={Boolean(disabledReason)}
        onClick={() => setIsOpen(true)}
        ref={openerRef}
        type="button"
      >
        <Bell className="size-4" aria-hidden="true" />
        Send betalingspåmindelse
      </button>
      {latestReminderAt ? (
        <p className="text-xs text-ink/55">Seneste påmindelse sendt {formatDateTime(latestReminderAt)}</p>
      ) : null}
      {disabledReason ? <p className="text-xs text-ink/55">{disabledReason}</p> : null}

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-midnight/35 px-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-md bg-white p-6 shadow-lift" role="dialog" aria-modal="true" aria-labelledby={`payment-reminder-${bookingId}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-midnight" id={`payment-reminder-${bookingId}`}>
                  Send betalingspåmindelse?
                </h2>
                <p className="mt-3 text-sm leading-6 text-ink/72">
                  Der sendes en e-mail til {participantName} med de betalingsoplysninger, som tidligere blev sendt i bekræftelsen.
                </p>
                <p className="mt-2 rounded-md bg-sage-50 px-3 py-2 text-sm font-semibold text-sage-700">
                  {participantEmail}
                </p>
              </div>
              <button
                aria-label="Luk"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-sand/50 text-midnight transition hover:bg-sand"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                className="inline-flex h-9 items-center justify-center rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Annuller
              </button>
              <form action={sendBookingPaymentReminderAction}>
                <input name="booking_id" type="hidden" value={bookingId} />
                <input name="current_event_id" type="hidden" value={currentEventId} />
                <button
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-sage-700 px-3 text-sm font-semibold text-white transition hover:bg-olive"
                  type="submit"
                >
                  <Send className="size-4" aria-hidden="true" />
                  Send påmindelse
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
