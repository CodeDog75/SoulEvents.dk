import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { PublicEventList } from "@/components/events/public-event-list";
import { areaOptions } from "@/lib/regions/areas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ sub?: string; area?: string }>;
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function namesOverlap(left: string, right: string) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function toggleSubcategoryHref(mainSlug: string, allSlugs: string[], activeSlugs: string[], slug: string, area: string) {
  const active = activeSlugs.length > 0 ? activeSlugs : allSlugs;
  const next = active.includes(slug) ? active.filter((item) => item !== slug) : [...active, slug];
  const params = new URLSearchParams();
  if (next.length !== allSlugs.length) params.set("sub", next.join(","));
  if (area) params.set("area", area);
  const query = params.toString();
  return "/categories/" + mainSlug + (query ? "?" + query : "");
}

export default async function MainCategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams ?? Promise.resolve({})]);
  const supabase = await createClient();

  const [{ data: mainCategory }, { data: allSubcategories }] = await Promise.all([
    supabase
      .from("main_categories")
      .select("id, name, slug, description, color_hex, image_path, subcategory_main_categories(subcategories(id, name, slug, sort_order, is_active))")
      .eq("slug", slug)
      .eq("is_active", true)
      .single(),
    supabase.from("subcategories").select("id, name, slug, sort_order, is_active, subcategory_main_categories(main_category_id)").eq("is_active", true).order("sort_order"),
  ]);

  if (!mainCategory) {
    notFound();
  }

  const relatedFromMain =
    mainCategory.subcategory_main_categories
      ?.map((row: any) => first(row.subcategories))
      .filter((subcategory: any) => subcategory?.is_active) ?? [];

  const relatedFromSubcategoryTable =
    (allSubcategories ?? []).filter((subcategory: any) =>
      (subcategory.subcategory_main_categories ?? []).some((row: any) => row.main_category_id === mainCategory.id),
    );

  const relationBasedSubcategories = uniqueById([...relatedFromMain, ...relatedFromSubcategoryTable] as any[]);

  const subcategories = relationBasedSubcategories
    .filter((subcategory: any) => subcategory?.is_active !== false)
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "da-DK"));

  const allSubcategorySlugs = subcategories.map((subcategory: any) => subcategory.slug);
  const requestedSubSlugs =
    query?.sub
      ?.split(",")
      .map((item) => item.trim())
      .filter((item) => allSubcategorySlugs.includes(item)) ?? [];
  const activeSubcategorySlugs = requestedSubSlugs.length > 0 ? requestedSubSlugs : allSubcategorySlugs;
  const activeSubcategories = subcategories.filter((subcategory: any) => activeSubcategorySlugs.includes(subcategory.slug));
  const activeSubcategoryIds = activeSubcategories.map((subcategory: any) => subcategory.id);
  const activeSubcategoryNames = activeSubcategories.map((subcategory: any) => subcategory.name);
  const selectedArea = query?.area?.trim() ?? "";
  const selectedAreaOption = areaOptions.find((area) => area.value === selectedArea) ?? null;
  const selectedAreaLabel = selectedAreaOption?.label ?? "";
  const mainCategoryImageUrl = mainCategory.image_path
    ? supabase.storage.from("media").getPublicUrl(mainCategory.image_path).data.publicUrl
    : null;

  const { data: rawEvents } = await supabase
    .from("events")
    .select(
      "id, title, short_description, starts_at, city, price_cents, capacity, event_format, facilitator_profiles!inner(id, status, company_name, profiles(full_name)), regions(name, slug), event_categories(categories(name, color_hex)), event_main_categories(main_category_id), event_subcategories(subcategory_id, subcategories(name, slug))",
    )
    .eq("status", "active")
    .eq("facilitator_profiles.status", "approved")
    .gte("starts_at", startOfToday().toISOString())
    .order("starts_at", { ascending: true });

  const events = uniqueById(rawEvents ?? []).filter((event: any) => {
    const region = first(event.regions);
    if (selectedAreaOption && !selectedAreaOption.slugs.includes(region?.slug ?? "")) return false;

    const eventMainCategoryIds = (event.event_main_categories ?? []).map((row: any) => row.main_category_id);
    const eventSubcategoryRows = event.event_subcategories ?? [];
    const eventSubcategoryIds = eventSubcategoryRows.map((row: any) => row.subcategory_id);
    const eventSubcategoryNames = eventSubcategoryRows.map((row: any) => first(row.subcategories)?.name).filter(Boolean);
    const legacyCategoryNames = event.event_categories?.map((row: any) => first(row.categories)?.name).filter(Boolean) ?? [];

    const matchesMainCategory = eventMainCategoryIds.includes(mainCategory.id);
    const matchesActiveSubcategoryById = eventSubcategoryIds.some((subcategoryId: string) => activeSubcategoryIds.includes(subcategoryId));
    const matchesActiveSubcategoryByName = [...eventSubcategoryNames, ...legacyCategoryNames].some((eventCategoryName) =>
      activeSubcategoryNames.some((subcategoryName) => namesOverlap(eventCategoryName, subcategoryName)),
    );
    const matchesMainByLegacyName = legacyCategoryNames.some(
      (eventCategoryName) =>
        namesOverlap(mainCategory.name, eventCategoryName) ||
        activeSubcategoryNames.some((subcategoryName) => namesOverlap(eventCategoryName, subcategoryName)),
    );

    if (requestedSubSlugs.length > 0) {
      return (matchesMainCategory || matchesMainByLegacyName || matchesActiveSubcategoryByName) && (matchesActiveSubcategoryById || matchesActiveSubcategoryByName);
    }

    return matchesMainCategory || matchesMainByLegacyName || matchesActiveSubcategoryById || matchesActiveSubcategoryByName;
  });

  return (
    <main className="min-h-screen bg-[#FAF6EF] text-[#2F2633]">
      <header className="border-b border-[#EDE4F7] bg-white/90">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-5 sm:px-8">
          <Link aria-label="SoulEvents.dk forside" href="/">
            <BrandLogo className="h-24 w-24 sm:h-28 sm:w-28" priority />
          </Link>
          <Link className="inline-flex h-11 items-center gap-2 rounded-button border border-[#7A4EAB]/15 bg-white px-4 text-sm font-semibold text-[#7A4EAB]" href="/">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Forsiden
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14">
        <section
          className="overflow-hidden rounded-[30px] border border-[#D9C5EA] p-8 shadow-soft sm:p-10"
          style={{
            background: mainCategoryImageUrl
              ? "linear-gradient(120deg, rgba(47,38,51,0.74), rgba(47,38,51,0.34)), url('" + mainCategoryImageUrl + "') center/cover"
              : "radial-gradient(circle at center, rgba(255,255,255,0.96) 0%, " +
                (mainCategory.color_hex || "#7A4EAB") +
                "18 52%, " +
                (mainCategory.color_hex || "#7A4EAB") +
                "38 100%)",
          }}
        >
          <p className={"inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-soft " + (mainCategoryImageUrl ? "bg-white/88 text-[#2F1642]" : "bg-white/78 text-[#7A4EAB]")}>
            <Sparkles className="size-4" aria-hidden="true" />
            Hovedkategori
          </p>
          <h1 className={"mt-5 max-w-4xl font-serif text-4xl font-medium leading-tight sm:text-6xl " + (mainCategoryImageUrl ? "text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.45)]" : "text-[#2F1642]")}>
            {mainCategory.name}
          </h1>
          {mainCategory.description && (
            <p className={"mt-4 max-w-3xl text-base leading-7 sm:text-lg " + (mainCategoryImageUrl ? "text-white/92 drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]" : "text-[#2F2633]/72")}>{mainCategory.description}</p>
          )}
        </section>

        <section className="mt-8 rounded-card border border-[#EDE4F7] bg-white/88 p-5 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Område</p>
          <h2 className="mt-2 text-2xl font-medium text-[#2F2633]">Hvor vil du lede?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/64">
            Vælg et område, hvis du kun vil se oplevelser i en bestemt del af Danmark.
          </p>
          <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]" action={"/categories/" + mainCategory.slug}>
            {requestedSubSlugs.length > 0 && <input name="sub" type="hidden" value={requestedSubSlugs.join(",")} />}
            <select
              className="h-12 rounded-input border border-[#7A4EAB]/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]"
              defaultValue={selectedArea}
              name="area"
            >
              <option value="">Hele Danmark</option>
              {areaOptions.map((area) => (
                <option key={area.value} value={area.value}>
                  {area.label}
                </option>
              ))}
            </select>
            <button className="inline-flex h-12 items-center justify-center rounded-button bg-[#7A4EAB] px-5 text-sm font-semibold text-white shadow-soft" type="submit">
              Vis område
            </button>
          </form>
        </section>

        {subcategories.length > 0 && (
          <section className="mt-6 rounded-card border border-[#EDE4F7] bg-white/88 p-5 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Filtrer emner</p>
            <h2 className="mt-2 text-2xl font-medium text-[#2F2633]">Vælg eller fravælg underkategorier</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/64">
              Kun emner, der er koblet til denne hovedkategori, vises her. Alle er valgt fra start, og du kan fravælge én eller flere.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {subcategories.map((subcategory: any) => {
                const active = activeSubcategorySlugs.includes(subcategory.slug);
                return (
                  <Link
                    className={
                      active
                        ? "rounded-full border border-[#7A4EAB] bg-[#7A4EAB] px-4 py-2 text-sm font-semibold text-white shadow-soft"
                        : "rounded-full border border-[#7A4EAB]/18 bg-white px-4 py-2 text-sm font-semibold text-[#2F1642] opacity-60 transition hover:opacity-100"
                    }
                    href={toggleSubcategoryHref(mainCategory.slug, allSubcategorySlugs, requestedSubSlugs, subcategory.slug, selectedArea)}
                    key={subcategory.id}
                  >
                    {subcategory.name}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Events</p>
            <h2 className="mt-2 text-3xl font-medium text-[#2F2633]">Oplevelser i {mainCategory.name}</h2>
            {selectedArea && (
              <p className="mt-2 text-sm font-semibold text-[#7A4EAB]">Filtreret efter valgt område</p>
            )}
          </div>
          {events.length > 0 ? (
            <PublicEventList events={events as never} />
          ) : (
            <section className="rounded-card bg-white p-8 text-center shadow-soft">
              <Sparkles className="mx-auto size-8 text-[#7A4EAB]" aria-hidden="true" />
              <h3 className="mt-4 text-3xl font-medium text-[#2F2633]">Der er endnu ingen events, der matcher dine valg.</h3>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-ink/64">
                Prøv at vælge flere emner eller gå tilbage og udforsk en anden retning.
              </p>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}
