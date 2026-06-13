import Link from "next/link";
import { ArrowLeft, CalendarDays, Filter, Search, UserRound } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FacilitatorDirectoryProps = {
  searchParams?: Promise<{
    q?: string;
    category?: string;
    area?: string;
    letter?: string;
  }>;
};

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ".split("");

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("da-DK")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getName(facilitator: any) {
  const profile = first(facilitator.profiles);
  return facilitator.company_name || profile?.full_name || "Vært";
}

function startsWithLetter(name: string, letter: string) {
  if (!letter) return true;
  return name.trim().toLocaleUpperCase("da-DK").startsWith(letter);
}

function withParam(current: Record<string, string>, key: string, value: string) {
  const params = new URLSearchParams();
  for (const [paramKey, paramValue] of Object.entries(current)) {
    if (paramValue && paramKey !== key) params.set(paramKey, paramValue);
  }
  if (value) params.set(key, value);
  const query = params.toString();
  return query ? "/facilitators?" + query : "/facilitators";
}

export default async function FacilitatorDirectoryPage({ searchParams }: FacilitatorDirectoryProps) {
  const params = searchParams ? await searchParams : {};
  const selected = {
    q: params.q?.trim() ?? "",
    category: params.category ?? "",
    area: params.area ?? "",
    letter: params.letter ?? "",
  };
  const supabase = await createClient();

  const [{ data: facilitators }, { data: categories }, { data: regions }, { data: events }] = await Promise.all([
    supabase
      .from("facilitator_profiles")
      .select(
        "id, company_name, profile_image_path, short_description, city, is_online_facilitator, profiles(full_name), regions(name, slug), facilitator_categories(categories(id, name, color_hex))",
      )
      .eq("status", "approved"),
    supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("regions").select("slug, name").order("sort_order"),
    supabase.from("events").select("id, facilitator_id").eq("status", "active").gte("starts_at", new Date().toISOString()),
  ]);

  const eventCounts = new Map<string, number>();
  for (const event of events ?? []) {
    eventCounts.set(event.facilitator_id, (eventCounts.get(event.facilitator_id) ?? 0) + 1);
  }

  const filtered = (facilitators ?? [])
    .filter((facilitator: any) => {
      const name = getName(facilitator);
      const region = first(facilitator.regions);
      const categoryRows =
        facilitator.facilitator_categories
          ?.map((row: any) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
          .filter(Boolean) ?? [];
      const categoryIds = categoryRows.map((category: any) => category.id);
      const categoryNames = categoryRows.map((category: any) => category.name);
      const onlineWords = facilitator.is_online_facilitator ? ["online", "online vært"] : [];
      const haystack = normalize(
        [name, facilitator.short_description, facilitator.city, region?.name, ...categoryNames, ...onlineWords]
          .filter(Boolean)
          .join(" "),
      );
      const matchesText = !selected.q || haystack.includes(normalize(selected.q));
      const matchesCategory = !selected.category || categoryIds.includes(selected.category);
      const matchesArea = !selected.area || region?.slug === selected.area;
      const matchesLetter = startsWithLetter(name, selected.letter);
      return matchesText && matchesCategory && matchesArea && matchesLetter;
    })
    .sort((a: any, b: any) => getName(a).localeCompare(getName(b), "da-DK"));

  return (
    <main className="min-h-screen bg-cream text-ink">
      <header className="bg-white shadow-soft">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 sm:px-8">
          <Link aria-label="SoulEvents.dk forside" href="/">
            <BrandLogo className="h-28 w-28" priority />
          </Link>
          <Link
            className="inline-flex h-11 items-center gap-2 rounded-button border border-olive/15 bg-white px-4 text-sm font-semibold text-olive transition hover:border-rose hover:text-rose"
            href="/"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Forside
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose">Værter</p>
        <h1 className="mt-3 text-5xl font-medium leading-tight text-olive">Find værter på SoulEvents</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-ink/70">
          Bag hvert event står et menneske med en passion for at skabe nærvær, fællesskab og personlig udvikling. Her
          kan du udforske værter, der skaber meningsfulde aktiviteter og fællesskaber for krop, sind og sjæl.
        </p>

        <form className="mt-8 grid gap-3 rounded-card bg-white p-4 shadow-soft lg:grid-cols-[1.2fr_0.9fr_0.9fr_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-semibold text-olive">
            Søg
            <input
              className="h-12 rounded-input border border-olive/15 px-4 text-base font-normal outline-none transition focus:border-rose"
              defaultValue={selected.q}
              name="q"
              placeholder="Søg efter navn, profiltekst, kategori eller område..."
              type="search"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-olive">
            Kategori
            <select className="h-12 rounded-input border border-olive/15 bg-white px-4" defaultValue={selected.category} name="category">
              <option value="">Alle kategorier</option>
              {(categories ?? []).map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-olive">
            Område
            <select className="h-12 rounded-input border border-olive/15 bg-white px-4" defaultValue={selected.area} name="area">
              <option value="">Hele Danmark</option>
              {(regions ?? []).map((region) => (
                <option key={region.slug} value={region.slug}>{region.name}</option>
              ))}
            </select>
          </label>
          <button className="inline-flex h-12 items-center justify-center gap-2 rounded-button bg-olive px-6 text-sm font-semibold text-white" type="submit">
            <Search className="size-4" aria-hidden="true" />
            Søg
          </button>
        </form>

        <nav className="mt-8 flex flex-wrap gap-2" aria-label="Alfabetisk navigation">
          <Link className="rounded-full border border-olive/10 bg-white px-3 py-1.5 text-sm font-semibold text-olive" href={withParam(selected, "letter", "")}>
            Alle
          </Link>
          {letters.map((letter) => (
            <Link
              className={
                selected.letter === letter
                  ? "rounded-full bg-olive px-3 py-1.5 text-sm font-semibold text-white"
                  : "rounded-full border border-olive/10 bg-white px-3 py-1.5 text-sm font-semibold text-olive"
              }
              href={withParam(selected, "letter", letter)}
              key={letter}
            >
              {letter}
            </Link>
          ))}
        </nav>

        <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-ink/60">
          <Filter className="size-4" aria-hidden="true" />
          {filtered.length} værter fundet
        </div>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((facilitator: any) => {
            const name = getName(facilitator);
            const region = first(facilitator.regions);
            const imageUrl = facilitator.profile_image_path
              ? supabase.storage.from("media").getPublicUrl(facilitator.profile_image_path).data.publicUrl
              : null;
            const categoryRows =
              facilitator.facilitator_categories
                ?.map((row: any) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
                .filter(Boolean) ?? [];

            return (
              <Link className="group overflow-hidden rounded-card bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-lift" href={"/facilitators/" + facilitator.id} key={facilitator.id}>
                <div className="aspect-[4/3] bg-sage-50">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={name} className="h-full w-full object-cover" src={imageUrl} />
                  ) : (
                    <div className="grid h-full place-items-center text-sage-700">
                      <UserRound className="size-16" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap gap-2">
                    {facilitator.is_online_facilitator && (
                      <span className="rounded-full border border-olive/10 bg-white px-2.5 py-1 text-[11px] font-medium text-ink/55">
                        Online vært
                      </span>
                    )}
                    {categoryRows.slice(0, 3).map((category: any) => (
                      <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" key={category.id} style={{ backgroundColor: category.color_hex }}>
                        {category.name}
                      </span>
                    ))}
                  </div>
                  <h2 className="mt-3 text-2xl font-medium leading-7 text-olive">{name}</h2>
                  <p className="mt-1 text-sm text-ink/58">{[facilitator.city, region?.name].filter(Boolean).join(", ")}</p>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink/66">{facilitator.short_description || "Værtens profiltekst kommer snart."}</p>
                  <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-olive">
                    <CalendarDays className="size-4" aria-hidden="true" />
                    {eventCounts.get(facilitator.id) ?? 0} kommende events
                  </p>
                </div>
              </Link>
            );
          })}
        </section>
      </section>
    </main>
  );
}
