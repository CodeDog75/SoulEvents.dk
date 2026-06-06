import { Clock3, Eye, PauseCircle, XCircle } from "lucide-react";
import { updateEventStatusAction } from "@/app/facilitator/events/actions";
import type { EventStatus } from "@/types/database";

type EventRow = {
  id: string;
  title: string;
  status: EventStatus;
  starts_at: string;
  city: string | null;
  price_cents: number;
  capacity: number;
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
  active: "Aktiv",
  sold_out: "Udsolgt",
  cancelled: "Aflyst",
  completed: "Afholdt",
};

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
    <form action={updateEventStatusAction}>
      <input name="event_id" type="hidden" value={eventId} />
      <input name="status" type="hidden" value={status} />
      <button
        className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
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
      <section className="rounded-md border border-midnight/10 bg-white p-8 text-center shadow-soft">
        <Clock3 className="mx-auto size-8 text-sage-700" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-semibold text-midnight">Ingen events endnu</h2>
        <p className="mt-2 text-sm text-ink/64">Opret dit første event med formularen herunder.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
      <div className="border-b border-midnight/10 px-5 py-4">
        <h2 className="text-lg font-semibold text-midnight">Dine events</h2>
        <p className="mt-1 text-sm text-ink/64">Administrer status for begivenheder.</p>
      </div>

      <div className="divide-y divide-midnight/10">
        {events.map((event) => {
          const categories =
            event.event_categories?.map((row) => row.categories?.name).filter((name): name is string => Boolean(name)) ??
            [];

          return (
            <article className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]" key={event.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink/62">
                  <span className="rounded-md bg-sage-50 px-2.5 py-1 text-sage-700">
                    {statusLabels[event.status]}
                  </span>
                  <span>{new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.starts_at))}</span>
                  {event.city && <span>{event.city}</span>}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-midnight">{event.title}</h3>
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

              <div className="flex flex-wrap content-start gap-2 lg:justify-end">
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
