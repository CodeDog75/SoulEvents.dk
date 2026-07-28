"use client";

import { FormEvent, useState, useTransition } from "react";
import { ArchiveX, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isRestore = mode === "restore";

  function closeDialog() {
    if (isPending) return;
    setErrorMessage(null);
    setIsOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setErrorMessage(null);

    startTransition(async () => {
      const result = await (isRestore ? restoreEventToDashboardAction(formData) : hideEventFromDashboardAction(formData));

      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#E5DDEA] bg-white/70 px-3 text-xs font-semibold text-[#6E5A86] transition hover:border-[#7A5D91] hover:text-[#7A5D91]"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {isRestore ? <RotateCcw className="size-3.5" aria-hidden="true" /> : <ArchiveX className="size-3.5" aria-hidden="true" />}
        {isRestore ? "Gendan fra arkiv" : "Arkivér event"}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/35 px-4 py-6">
          <section className="w-full max-w-md rounded-card bg-white p-5 shadow-lift sm:p-6" role="dialog" aria-modal="true" aria-labelledby="dashboard-event-visibility-title">
            <h2 className="text-xl font-semibold text-midnight" id="dashboard-event-visibility-title">
              {isRestore ? "Gendan event fra arkiv?" : "Arkivér event?"}
            </h2>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-ink/72">
              <p>Event: “{eventTitle || "Event uden titel"}”.</p>
              <p>
                {isRestore
                  ? "Eventet flyttes tilbage til den relevante fane i dit dashboard."
                  : "Eventet slettes ikke og kan altid gendannes fra Arkiverede events."}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                className="inline-flex h-9 items-center justify-center rounded-full border border-midnight/15 bg-white px-4 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                disabled={isPending}
                onClick={closeDialog}
                type="button"
              >
                Annuller
              </button>
              <form onSubmit={handleSubmit}>
                <input name="event_id" type="hidden" value={eventId} />
                <button
                  className="inline-flex h-9 items-center justify-center rounded-full bg-[#7A5D91] px-4 text-sm font-semibold text-white transition hover:bg-[#6E5285] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? (isRestore ? "Gendanner..." : "Arkiverer...") : isRestore ? "Gendan event" : "Arkivér event"}
                </button>
              </form>
            </div>
            {errorMessage ? (
              <p className="mt-4 rounded-[16px] border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-800">
                {errorMessage}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
