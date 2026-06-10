import Link from "next/link";
import { Sparkles, UserRound } from "lucide-react";

export type HomeFacilitatorCard = {
  id: string;
  name: string;
  imageUrl: string | null;
  city: string | null;
  tagline: string;
  primaryCategory: string | null;
  isOnline?: boolean;
};

export type HomeThemeCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  imageUrl: string | null;
};

function FacilitatorCard({ facilitator }: { facilitator: HomeFacilitatorCard }) {
  return (
    <Link
      className="group block overflow-hidden rounded-card bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-lift"
      href={"/facilitators/" + facilitator.id}
    >
      <div className="aspect-[4/3] bg-sage-50">
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
          {facilitator.tagline || "Facilitator på SoulEvents"}
        </p>
        <span className="mt-4 inline-flex text-sm font-semibold text-rose">Se profil</span>
      </div>
    </Link>
  );
}

export function HomeInspirationSections({
  featuredFacilitators,
  newFacilitators,
  themes,
}: {
  featuredFacilitators: HomeFacilitatorCard[];
  newFacilitators: HomeFacilitatorCard[];
  themes: HomeThemeCard[];
}) {
  const hasFeatured = featuredFacilitators.length > 0;
  const hasNew = newFacilitators.length > 0;
  const hasThemes = themes.length > 0;

  if (!hasFeatured && !hasNew && !hasThemes) {
    return null;
  }

  return (
    <section className="bg-white py-20 sm:py-24" id="inspiration">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 sm:px-8">
        {hasThemes && (
          <div>
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-rose">Inspiration</p>
              <h2 className="mt-3 text-5xl font-medium leading-tight text-olive">Find efter stemning og behov</h2>
              <p className="mt-4 text-base leading-7 text-ink/70">
                Udforsk redaktionelt udvalgte temaer, sæsoner og populære oplevelser.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
              {themes.map((theme) => (
                <Link
                  className="group relative aspect-square overflow-hidden rounded-[1.25rem] bg-sage-50 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                  href={theme.href}
                  key={theme.id}
                >
                  {theme.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="absolute inset-0 h-full w-full object-cover" src={theme.imageUrl} />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-sage-50 via-cream to-white text-4xl">
                      <Sparkles className="size-10 text-sage-700" aria-hidden="true" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/72 via-ink/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <h3 className="text-base font-semibold leading-tight sm:text-lg">{theme.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/82">{theme.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {hasFeatured && (
          <div>
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-rose">Fremhævede facilitatorer</p>
              <h2 className="mt-3 text-5xl font-medium leading-tight text-olive">Mød udvalgte facilitatorer</h2>
              <p className="mt-4 text-base leading-7 text-ink/70">
                Facilitatorer, som SoulEvents fremhæver for deres nærvær, faglighed og aktuelle tilbud.
              </p>
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
              <p className="text-sm font-semibold uppercase tracking-wide text-rose">Nye facilitatorer</p>
              <h2 className="mt-3 text-5xl font-medium leading-tight text-olive">Nye stemmer på SoulEvents</h2>
              <p className="mt-4 text-base leading-7 text-ink/70">
                Senest godkendte aktive facilitatorer på platformen.
              </p>
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
