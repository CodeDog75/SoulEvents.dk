import Link from "next/link";
import { Clock3, Copy, Eye, PauseCircle, PencilLine, XCircle } from "lucide-react";
import { copyEventAsDraftAction, deleteDraftEventAction, updateEventStatusAction } from "@/app/facilitator/events/actions";
import type { EventStatus } from "@/types/database";

type EventRow = {
  id: string;
  title: string;
  status: EventStatus;
  starts_at: string;
  city: string | null;
  price_cents: number;
  capacity: number;
  event_reference_id?: string | null;
  event_categories?: Array<{
    categories: {
      name: string;
    } | null;
  }>;
};

type EventListProps = {
  events: EventRow[];
};

const statusLabels: Record<EventStatus, string> = {
  draft: "Kladde",
  pending_review: "Afventer godkendelse",
  active: "Aktiv",
  rejected: "Afvist",
  sold_out: "Udsolgt",
  cancelled: "Aflyst",
  completed: "Afholdt",
  archived: "Arkiveret",
};

function isCopyableAsDraft(event: EventRow) {
  return (
    event.status === "active" ||
    event.status === "sold_out" ||
    event.status === "completed" ||
    event.status === "cancelled" ||
    new Date(event.starts_at) < new Date()
  );
}

function StatusAction({
  eventId,
  status,
  children,
}: {
  eventId: string;
  status: EventStatus;
  children: React.ReactNode;
}) {
  return (
    <form action={updateEventStatusAction} className="w-full sm:w-auto">
      <input name="event_id" type="hidden" value={eventId} />
      <input name="status" type="hidden" value={status} />
      <button
        className="inline-flex min-h-10 w-full max-w-full items-center justify-center gap-2 whitespace-normal rounded-md border border-midnight/15 bg-white px-3 text-center text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700 sm:w-auto"
        type="submit"
      >
        {children}
      </button>
    </form>
  );
}

export function EventList({ events }: EventListProps) {
  if (events.length === 0) {
    return (
      <section className="rounded-card border border-midnight/10 bg-white p-5 text-center shadow-soft sm:p-8">
        <Clock3 className="mx-auto size-8 text-sage-700" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-semibold text-midnight">Ingen events endnu</h2>
        <p className="mt-2 text-sm text-ink/64">Opret dit første event med formularen herunder.</p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-full overflow-hidden rounded-card border border-midnight/10 bg-white shadow-soft">
      <div className="border-b border-midnight/10 px-4 py-4 sm:px-5">
        <h2 className="text-lg font-semibold text-midnight">Mine events</h2>
        <p className="mt-1 text-sm text-ink/64">Se og administrer dine kladder, aktive og tidligere events.</p>
      </div>

      <div className="divide-y divide-midnight/10">
        {events.map((event) => {
          const categories =
            event.event_categories?.map((row) => row.categories?.name).filter((name): name is string => Boolean(name)) ??
            [];

          return (
            <article className="grid min-w-0 gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto]" key={event.id}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink/62">
                  <span className="rounded-md bg-sage-50 px-2.5 py-1 text-sage-700">
                    {statusLabels[event.status]}
                  </span>
                  <span>{new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.starts_at))}</span>
                  {event.city && <span>{event.city}</span>}
                  {event.event_reference_id ? <span>Ref. {event.event_reference_id}</span> : null}
                </div>
                <h3 className="mt-3 break-words text-base font-semibold text-midnight sm:text-lg">{event.title}</h3>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink/68">
                  <span className="rounded-md bg-sand px-2.5 py-1">
                    {event.price_cents === 0 ? "Gratis" : `${event.price_cents / 100} kr.`}
                  </span>
                  <span className="rounded-md bg-midnight/5 px-2.5 py-1">{event.capacity} pladser</span>
                  {categories.map((category) => (
                    <span className="rounded-md bg-sage-50 px-2.5 py-1" key={category}>
                      {category}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:content-start lg:justify-end">
                {event.status === "draft" && (
                  <Link
                    className="inline-flex min-h-10 w-full max-w-full items-center justify-center gap-2 whitespace-normal rounded-md bg-[#7A4EAB] px-3 text-center text-sm font-semibold text-white shadow-soft transition hover:bg-[#6A3D98] sm:w-auto"
                    href={"/facilitator/events?draft=" + event.id}
                  >
                    <PencilLine className="size-4" aria-hidden="true" />
                    Fortsæt kladde
                  </Link>
                )}
                {event.status === "active" && (
                  <Link
                    className="inline-flex min-h-10 w-full max-w-full items-center justify-center gap-2 whitespace-normal rounded-md border border-[#7A4EAB]/25 bg-white px-3 text-center text-sm font-semibold text-[#7A4EAB] transition hover:border-[#7A4EAB] sm:w-auto"
                    href={"/facilitator/events?draft=" + event.id}
                  >
                    <PencilLine className="size-4" aria-hidden="true" />
                    Rediger
                  </Link>
                )}
                {event.status === "draft" && (
                  <form action={deleteDraftEventAction} className="w-full sm:w-auto">
                    <input name="event_id" type="hidden" value={event.id} />
                    <button
                      className="inline-flex min-h-10 w-full max-w-full items-center justify-center gap-2 whitespace-normal rounded-md border border-red-300 bg-red-50 px-3 text-center text-sm font-semibold text-red-800 transition hover:bg-red-100 sm:w-auto"
                      type="submit"
                    >
                      <XCircle className="size-4" aria-hidden="true" />
                      Slet kladde
                    </button>
                  </form>
                )}
                {isCopyableAsDraft(event) && (
                  <form action={copyEventAsDraftAction} className="w-full sm:w-auto">
                    <input name="event_id" type="hidden" value={event.id} />
                    <button
                      className="inline-flex min-h-10 w-full max-w-full items-center justify-center gap-2 whitespace-normal rounded-md border border-[#7A4EAB]/25 bg-[#F6EFFF] px-3 text-center text-sm font-semibold text-[#7A4EAB] transition hover:border-[#7A4EAB] sm:w-auto"
                      type="submit"
                    >
                      <Copy className="size-4" aria-hidden="true" />
                      Kopiér som nyt event
                    </button>
                  </form>
                )}
                {event.status !== "active" && (
                  <StatusAction eventId={event.id} status="active">
                    <Eye className="size-4" aria-hidden="true" />
                    Aktiv
                  </StatusAction>
                )}
                {event.status !== "draft" && (
                  <StatusAction eventId={event.id} status="draft">
                    <PauseCircle className="size-4" aria-hidden="true" />
                    Kladde
                  </StatusAction>
                )}
                {event.status !== "cancelled" && (
                  <StatusAction eventId={event.id} status="cancelled">
                    <XCircle className="size-4" aria-hidden="true" />
                    Aflys
                  </StatusAction>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
