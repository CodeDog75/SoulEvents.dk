import Link from "next/link";
import { OrganizerBadges } from "@/components/badges/organizer-badges";
import { SoulEventsIdTag } from "@/components/facilitator/soulevents-id-tag";

type CategoryRow = {
  categories?: { name?: string | null; color_hex?: string | null } | Array<{ name?: string | null; color_hex?: string | null }> | null;
};

type FacilitatorResult = {
  id: string;
  company_name?: string | null;
  city?: string | null;
  short_description?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  host_reference_id?: string | null;
  instagram_url?: string | null;
  is_active_host?: boolean | null;
  is_experienced_host?: boolean | null;
  profiles?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
  regions?: { name?: string | null } | Array<{ name?: string | null }> | null;
  facilitator_categories?: CategoryRow[] | null;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getName(facilitator: FacilitatorResult) {
  const profile = first(facilitator.profiles);
  return facilitator.company_name || profile?.full_name || "Arrangør";
}

function getCategories(facilitator: FacilitatorResult) {
  return (
    facilitator.facilitator_categories
      ?.map((row) => first(row.categories))
      .filter((category): category is { name?: string | null; color_hex?: string | null } => Boolean(category?.name)) ?? []
  );
}

export function PublicFacilitatorResults({ facilitators }: { facilitators: FacilitatorResult[] }) {
  if (facilitators.length === 0) {
    return (
      <section className="rounded-[2rem] border border-sage-700/10 bg-white p-8 text-center shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-terracotta">Ingen arrangører fundet</p>
        <h3 className="mt-4 text-3xl font-medium text-olive">Der blev ikke fundet arrangører, der matcher din søgning.</h3>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-ink/64">
          Prøv et andet navn, en anden kategori eller et andet område.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      {facilitators.map((facilitator) => {
        const region = first(facilitator.regions);
        const categories = getCategories(facilitator);
        const name = getName(facilitator);
        const eventSearchHref = "/?q=" + encodeURIComponent(name) + "&search_mode=events#events";

        return (
          <article className="rounded-[1.5rem] border border-sage-700/10 bg-white p-5 shadow-soft" key={facilitator.id}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">Arrangør</p>
                <h3 className="mt-2 text-2xl font-medium text-olive">{name}</h3>
                <SoulEventsIdTag className="mt-2" hostReferenceId={facilitator.host_reference_id} />
                <div className="mt-2">
                  <OrganizerBadges badges={[facilitator.is_experienced_host ? "experienced" : null, facilitator.is_active_host ? "active" : null].filter(Boolean) as never} />
                </div>
                {(facilitator.city || region?.name) && (
                  <p className="mt-1 text-sm text-ink/60">
                    {[facilitator.city, region?.name].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
              <Link
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-olive px-5 text-sm font-semibold text-white transition hover:bg-sage-500"
                href={eventSearchHref}
              >
                Se events
              </Link>
            </div>

            {facilitator.short_description && <p className="mt-4 max-w-3xl text-sm leading-6 text-ink/70">{facilitator.short_description}</p>}

            {categories.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold text-olive"
                    key={category.name}
                    style={{ backgroundColor: category.color_hex ? category.color_hex + "22" : "#eef2e3" }}
                  >
                    {category.name}
                  </span>
                ))}
              </div>
            )}

            <p className="mt-4 text-xs italic text-ink/55">Arrangøren kan findes, selvom der ikke er aktive events lige nu.</p>
          </article>
        );
      })}
    </div>
  );
}
