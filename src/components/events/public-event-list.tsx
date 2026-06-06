import Link from "next/link";
import { CalendarDays, MapPinned, Ticket } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

type PublicEvent = {
  id: string;
  title: string;
  short_description: string;
  starts_at: string;
  city: string | null;
  price_cents: number;
  capacity: number;
  facilitator_profiles: {
    company_name: string | null;
    profiles:
      | {
          full_name: string;
        }
      | Array<{
          full_name: string;
        }>
      | null;
  } | Array<{
    company_name: string | null;
    profiles:
      | {
          full_name: string;
        }
      | Array<{
          full_name: string;
        }>
      | null;
  }> | null;
  regions: {
    name: string;
  } | Array<{
    name: string;
  }> | null;
  event_categories?: Array<{
    categories:
      | {
          name: string;
          color_hex: string;
        }
      | Array<{
          name: string;
          color_hex: string;
        }>
      | null;
  }>;
};

type PublicEventListProps = {
  events: PublicEvent[];
  layout?: "grid" | "stack";
};

function formatPrice(priceCents: number) {
  if (priceCents === 0) {
    return "Gratis";
  }

  return `${new Intl.NumberFormat("da-DK").format(priceCents / 100)} kr.`;
}

export function PublicEventList({ events, layout = "grid" }: PublicEventListProps) {
  if (events.length === 0) {
    return (
      <section className="rounded-card bg-white p-8 text-center shadow-soft">
        <CalendarDays className="mx-auto size-8 text-sage-700" aria-hidden="true" />
        <h2 className="mt-4 text-3xl font-medium text-olive">Ingen events matcher filtrene</h2>
        <p className="mt-2 text-sm text-ink/64">Prøv at udvide søgningen eller vælge et andet område.</p>
      </section>
    );
  }

  return (
    <section className={layout === "stack" ? "grid gap-6" : "grid gap-8 md:grid-cols-2 xl:grid-cols-3"}>
      {events.map((event) => {
        const facilitatorProfile = Array.isArray(event.facilitator_profiles)
          ? event.facilitator_profiles[0]
          : event.facilitator_profiles;
        const facilitatorUser = Array.isArray(facilitatorProfile?.profiles)
          ? facilitatorProfile?.profiles[0]
          : facilitatorProfile?.profiles;
        const region = Array.isArray(event.regions) ? event.regions[0] : event.regions;
        const facilitator =
          facilitatorProfile?.company_name ||
          facilitatorUser?.full_name ||
          "Facilitator";
        const categories =
          event.event_categories
            ?.map((row) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
            .filter((category): category is NonNullable<typeof category> => Boolean(category)) ?? [];

        return (
          <Link
            href={`/events/${event.id}`}
            className="group overflow-hidden rounded-card bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-lift"
            key={event.id}
          >
            <div className="aspect-video bg-sage-50 p-6">
              <div className="flex h-full items-center justify-center rounded-card bg-cream/80">
                <BrandLogo className="h-20 w-20 opacity-75 transition group-hover:scale-105" />
              </div>
            </div>

            <div className="p-6">
              <div className="flex flex-wrap gap-2">
                {categories.slice(0, 3).map((category) => (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                    key={category.name}
                    style={{ backgroundColor: category.color_hex }}
                  >
                    {category.name}
                  </span>
                ))}
              </div>

              <h2 className="mt-4 text-3xl font-medium leading-8 text-olive">{event.title}</h2>
              <p className="mt-2 text-sm font-medium text-sage-700">{facilitator}</p>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink/66">{event.short_description}</p>

              <div className="mt-5 grid gap-3 text-sm text-ink/70">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-rose" aria-hidden="true" />
                  {new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(
                    new Date(event.starts_at),
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <MapPinned className="size-4 text-sage-700" aria-hidden="true" />
                  {[event.city, region?.name].filter(Boolean).join(", ") || "Lokation kommer snart"}
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-olive/10 pt-4">
                  <span className="flex items-center gap-2 font-semibold text-olive">
                    <Ticket className="size-4 text-olive" aria-hidden="true" />
                    {formatPrice(event.price_cents)}
                  </span>
                  <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-olive">
                    {event.capacity} pladser
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
