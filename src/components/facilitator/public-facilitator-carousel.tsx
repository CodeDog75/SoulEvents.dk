import Link from "next/link";
import { Search, Sparkles, UserRound } from "lucide-react";

type FacilitatorCard = {
  id: string;
  name: string;
  imageUrl: string | null;
  tagline: string;
  city: string | null;
  categories: Array<{ name: string; color_hex: string | null }>;
};

type PublicFacilitatorCarouselProps = {
  facilitators: FacilitatorCard[];
  query: string;
};

export function PublicFacilitatorCarousel({ facilitators, query }: PublicFacilitatorCarouselProps) {
  return (
    <section className="bg-cream py-[100px]" id="facilitators">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-rose">Facilitatorer</p>
            <h2 className="mt-3 text-5xl font-medium leading-tight text-olive">Find facilitatorer på SoulEvents</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-ink/70">
              Gå på opdagelse blandt dygtige facilitatorer inden for yoga, meditation, healing, ceremonier, saunagus og meget mere.
            </p>
          </div>

          <form action="/#facilitators" className="grid gap-3 rounded-card bg-white p-4 shadow-soft sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="grid gap-2 text-sm font-semibold text-olive">
              Søg efter facilitator
              <input
                className="h-12 rounded-input border border-olive/15 px-4 text-base font-normal outline-none transition focus:border-rose"
                defaultValue={query}
                name="facilitator_q"
                placeholder="Søg efter facilitatornavn..."
                type="search"
              />
            </label>
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-button bg-olive px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              type="submit"
            >
              <Search className="size-4" aria-hidden="true" />
              Find
            </button>
          </form>
        </div>

        {query && (
          <p className="mt-6 text-sm font-semibold text-olive">
            Viser facilitatorer der matcher: <span className="text-rose">{query}</span>
          </p>
        )}

        {facilitators.length > 0 ? (
          <div className="mt-8 flex snap-x gap-4 overflow-x-auto pb-4">
            {facilitators.map((facilitator) => (
              <Link
                className="group min-w-[250px] max-w-[250px] snap-start overflow-hidden rounded-card bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-lift sm:min-w-[300px] sm:max-w-[300px]"
                href={"/facilitators/" + facilitator.id}
                key={facilitator.id}
              >
                <div className="aspect-[4/3] bg-sage-50">
                  {facilitator.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={facilitator.name} className="h-full w-full object-cover" src={facilitator.imageUrl} />
                  ) : (
                    <div className="grid h-full place-items-center bg-sage-50 text-sage-700">
                      <UserRound className="size-14" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="text-2xl font-medium leading-7 text-olive">{facilitator.name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/66">
                    {facilitator.tagline || [facilitator.city, "Facilitator på SoulEvents"].filter(Boolean).join(" · ")}
                  </p>
                  {facilitator.categories.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {facilitator.categories.slice(0, 3).map((category) => (
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
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <section className="mt-8 rounded-card bg-white p-8 text-center shadow-soft">
            <Sparkles className="mx-auto size-8 text-rose" aria-hidden="true" />
            <h3 className="mt-4 text-3xl font-medium text-olive">Ingen facilitatorer fundet</h3>
            <p className="mt-2 text-sm text-ink/64">Prøv et andet navn.</p>
          </section>
        )}
      </div>
    </section>
  );
}
