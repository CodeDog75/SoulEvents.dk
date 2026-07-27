"use client";

import { useState } from "react";
import { ArchiveX, RotateCcw } from "lucide-react";
import {
  hideEventFromDashboardAction,
  restoreEventToDashboardAction,
} from "@/app/facilitator/events/actions";

type DashboardEventVisibilityActionProps = {
  eventId: string;
  eventTitle: string;
  mode: "hide" | "restore";
};

export function DashboardEventVisibilityAction({
  eventId,
  eventTitle,
  mode,
}: DashboardEventVisibilityActionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isRestore = mode === "restore";

  return (
    <>
      <button
        className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#E5DDEA] bg-white/70 px-3 text-xs font-semibold text-[#6E5A86] transition hover:border-[#7A5D91] hover:text-[#7A5D91]"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {isRestore ? <RotateCcw className="size-3.5" aria-hidden="true" /> : <ArchiveX className="size-3.5" aria-hidden="true" />}
        {isRestore ? "Vis på dashboard igen" : "Skjul fra dashboard"}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/35 px-4 py-6">
          <section className="w-full max-w-md rounded-card bg-white p-5 shadow-lift sm:p-6" role="dialog" aria-modal="true" aria-labelledby="dashboard-event-visibility-title">
            <h2 className="text-xl font-semibold text-midnight" id="dashboard-event-visibility-title">
              {isRestore ? "Vis event på dashboard igen?" : "Skjul event fra dashboard?"}
            </h2>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-ink/72">
              <p>Event: “{eventTitle || "Event uden titel"}”.</p>
              <p>
                {isRestore
                  ? "Eventet vises igen i dit dashboard."
                  : "Eventet slettes ikke og kan altid vises igen under Skjulte events."}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                className="inline-flex h-9 items-center justify-center rounded-full border border-midnight/15 bg-white px-4 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Annuller
              </button>
              <form action={isRestore ? restoreEventToDashboardAction : hideEventFromDashboardAction}>
                <input name="event_id" type="hidden" value={eventId} />
                <button
                  className="inline-flex h-9 items-center justify-center rounded-full bg-[#7A5D91] px-4 text-sm font-semibold text-white transition hover:bg-[#6E5285]"
                  type="submit"
                >
                  {isRestore ? "Vis event" : "Skjul event"}
                </button>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
