import Link from "next/link";
import { UserRound } from "lucide-react";
import { OrganizerImageBadge } from "@/components/badges/organizer-badges";

export type HomeFacilitatorCard = {
  id: string;
  name: string;
  imageUrl: string | null;
  city: string | null;
  tagline: string;
  primaryCategory: string | null;
  isOnline?: boolean;
  isActiveHost?: boolean;
  isExperiencedHost?: boolean;
  hostReferenceId?: string | null;
};

function FacilitatorCard({ facilitator }: { facilitator: HomeFacilitatorCard }) {
  return (
    <Link
      className="group block overflow-hidden rounded-card bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-lift"
      href={"/facilitators/" + facilitator.id}
    >
      <div className="relative aspect-[4/3] bg-sage-50">
        {facilitator.isExperiencedHost ? (
        <OrganizerImageBadge type="experienced" />
      ) : facilitator.isActiveHost ? (
        <OrganizerImageBadge type="active" />
      ) : null}
        {facilitator.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={facilitator.name} className="h-full w-full object-cover" src={facilitator.imageUrl} />
        ) : (
          <div className="grid h-full place-items-center text-sage-700">
            <UserRound className="size-14" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="p-5">
        {facilitator.primaryCategory && (
          <span className="rounded-full bg-sage-50 px-3 py-1 text-xs font-semibold text-sage-700">
            {facilitator.primaryCategory}
          </span>
        )}
        <h3 className="mt-3 text-2xl font-medium leading-7 text-olive">{facilitator.name}</h3>
        <p className="mt-1 text-sm font-semibold text-sage-700">{facilitator.isOnline ? "Online" : facilitator.city || "Danmark"}</p>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-ink/66">
          {facilitator.tagline || "Arrangør på SoulEvents"}
        </p>
        <span className="mt-4 inline-flex text-sm font-semibold text-rose">Se profil</span>
      </div>
    </Link>
  );
}

export function HomeInspirationSections({
  featuredFacilitators,
  newFacilitators,
}: {
  featuredFacilitators: HomeFacilitatorCard[];
  newFacilitators: HomeFacilitatorCard[];
}) {
  const hasFeatured = featuredFacilitators.length > 0;
  const hasNew = newFacilitators.length > 0;

  if (!hasFeatured && !hasNew) {
    return null;
  }

  return (
    <section className="bg-white py-10 sm:py-12" id="featured-hosts">
      <div className="mx-auto grid max-w-[1200px] gap-9 px-5 sm:px-8">
        {hasFeatured && (
          <div>
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-rose">Fremhævede arrangører</p>
              <h2 className="mt-2 text-4xl font-medium leading-tight text-olive sm:text-5xl">Mød udvalgte arrangører</h2>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredFacilitators.map((facilitator) => (
                <FacilitatorCard facilitator={facilitator} key={facilitator.id} />
              ))}
            </div>
          </div>
        )}

        {hasNew && (
          <div>
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-rose">Nye arrangører</p>
              <h2 className="mt-2 text-4xl font-medium leading-tight text-olive sm:text-5xl">Nye stemmer på SoulEvents</h2>
            </div>
            <div className="mt-6 flex snap-x gap-4 overflow-x-auto pb-4">
              {newFacilitators.map((facilitator) => (
                <div className="min-w-[250px] max-w-[250px] snap-start sm:min-w-[300px] sm:max-w-[300px]" key={facilitator.id}>
                  <FacilitatorCard facilitator={facilitator} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
