/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { CategoryEventExplorer } from "@/components/categories/category-event-explorer";
import { getAvailableEventSeatsByEventId } from "@/lib/events/capacity";
import { publicMediaUrl } from "@/lib/media/public-url";
import { createPageMetadata, stripHtml } from "@/lib/open-graph";
import { areaOptions } from "@/lib/regions/areas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ sub?: string; area?: string }>;
};

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

function pickRandomItem<T>(items: T[]) {
  if (items.length === 0) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)];
}

async function getCategoryHeroImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mainCategoryId: string,
  fallbackImagePath: string | null,
) {
  if (fallbackImagePath) {
    return supabase.storage.from("media").getPublicUrl(fallbackImagePath).data.publicUrl;
  }

  const { data: categoryHeroImages } = await supabase
    .from("hero_images")
    .select("image_path, alt_text")
    .eq("scope", "main_category")
    .eq("main_category_id", mainCategoryId)
    .eq("is_active", true)
    .order("sort_order");

  const categoryHero = pickRandomItem((categoryHeroImages ?? []) as Array<{ image_path: string; alt_text: string | null }>);
  if (categoryHero?.image_path) {
    return supabase.storage.from("media").getPublicUrl(categoryHero.image_path).data.publicUrl;
  }

  return null;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: mainCategory } = await supabase
    .from("main_categories")
    .select("id, name, slug, description, image_path")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!mainCategory) {
    return createPageMetadata({
      title: "Kategori | SoulEvents.dk",
      description: "Find events og arrangører på SoulEvents.dk.",
      path: "/categories/" + slug,
    });
  }

  const imageUrl = await getCategoryHeroImage(supabase, mainCategory.id, mainCategory.image_path);
  const description = stripHtml(mainCategory.description) || "Find events og arrangører inden for " + mainCategory.name + " på SoulEvents.dk.";

  return createPageMetadata({
    title: mainCategory.name + " | SoulEvents.dk",
    description,
    imageTitle: mainCategory.name,
    imageSubtitle: "Find events og arrangører på SoulEvents.dk",
    imageUrl,
    path: "/categories/" + slug,
  });
}

export default async function MainCategoryPage({ params, searchParams }: CategoryPageProps) {
  const emptyQuery: { sub?: string; area?: string } = {};
  const [{ slug }, query] = await Promise.all([params, searchParams ?? Promise.resolve(emptyQuery)]);
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
  const allSubcategoryIds = subcategories.map((subcategory: any) => subcategory.id);
  const allSubcategoryNames = subcategories.map((subcategory: any) => subcategory.name);
  const requestedSubSlugs =
    query?.sub
      ?.split(",")
      .map((item: string) => item.trim())
      .filter((item: string) => allSubcategorySlugs.includes(item)) ?? [];
  const selectedArea = query?.area?.trim() ?? "";
  const selectedAreaOption = areaOptions.find((area) => area.value === selectedArea) ?? null;
  const mainCategoryImageUrl = await getCategoryHeroImage(supabase, mainCategory.id, mainCategory.image_path);
  const nowIso = new Date().toISOString();

  const adsClient = createAdminClient();
  const { data: categoryAds } = await adsClient
    .from("ads")
    .select("id, title, image_path, mobile_image_path, alt_text, sponsor_name, target_url, priority, display_seconds, show_title_on_banner, show_sponsor_on_banner, clicks_count, ad_main_categories!inner(main_category_id)")
    .eq("is_active", true)
    .eq("show_on_category_pages", true)
    .eq("ad_main_categories.main_category_id", mainCategory.id)
    .or("starts_at.is.null,starts_at.lte." + nowIso)
    .or("ends_at.is.null,ends_at.gte." + nowIso)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  const partnerAds = (categoryAds ?? [])
    .map((ad: any) => ({
      id: ad.id,
      title: ad.title,
      imageUrl: publicMediaUrl(ad.image_path),
      mobileImageUrl: publicMediaUrl(ad.mobile_image_path),
      altText: ad.alt_text || ad.title,
      targetUrl: ad.target_url,
      displaySeconds: ad.display_seconds ?? 10,
      sponsorName: ad.sponsor_name,
      showTitle: ad.show_title_on_banner ?? true,
      showSponsor: ad.show_sponsor_on_banner ?? true,
    }));

  const { data: rawEvents } = await supabase
    .from("events")
    .select(
      "id, slug, status, title, short_description, starts_at, city, price_cents, capacity, cover_image_path, event_format, facilitator_profiles!inner(id, status, company_name, profiles!facilitator_profiles_profile_id_fkey(full_name)), regions(name, slug), event_categories(categories(name, color_hex)), event_main_categories(main_category_id, main_categories(name, color_hex, image_path)), event_subcategories(subcategory_id, subcategories(name, slug))",
    )
    .in("status", ["active", "sold_out"])
    .eq("facilitator_profiles.status", "approved")
    .eq("facilitator_profiles.is_paused", false)
    .eq("facilitator_profiles.is_disabled", false)
    .gte("ends_at", new Date().toISOString())
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
    const matchesActiveSubcategoryById = eventSubcategoryIds.some((subcategoryId: string) => allSubcategoryIds.includes(subcategoryId));
    const matchesActiveSubcategoryByName = [...eventSubcategoryNames, ...legacyCategoryNames].some((eventCategoryName) =>
      allSubcategoryNames.some((subcategoryName) => namesOverlap(eventCategoryName, subcategoryName)),
    );
    const matchesMainByLegacyName = legacyCategoryNames.some(
      (eventCategoryName: string) =>
        namesOverlap(mainCategory.name, eventCategoryName) ||
        allSubcategoryNames.some((subcategoryName) => namesOverlap(eventCategoryName, subcategoryName)),
    );

    return matchesMainCategory || matchesMainByLegacyName || matchesActiveSubcategoryById || matchesActiveSubcategoryByName;
  });
  const availableSeatsByEventId = await getAvailableEventSeatsByEventId(createAdminClient(), events);
  const eventsWithCapacity = events.map((event: any) => ({
    ...event,
    available_seats: availableSeatsByEventId.get(event.id) ?? null,
  }));

  return (
    <main className="min-h-screen bg-[#FAF6EF] text-[#2F2633]">
      <section
        className="relative overflow-hidden bg-[#FAF6EF] bg-cover bg-center"
        style={{
          background: mainCategoryImageUrl
            ? "linear-gradient(90deg, rgba(250,246,239,0.92) 0%, rgba(250,246,239,0.56) 42%, rgba(250,246,239,0.08) 72%, rgba(250,246,239,0.84) 100%), linear-gradient(180deg, rgba(250,246,239,0.12) 0%, rgba(47,38,51,0.12) 48%, #FAF6EF 100%), url('" +
              mainCategoryImageUrl +
              "') center/cover"
            : "radial-gradient(circle at 18% 12%, rgba(237,228,247,0.92) 0%, rgba(255,255,255,0.84) 34%, transparent 62%), radial-gradient(circle at center, rgba(255,255,255,0.96) 0%, " +
              (mainCategory.color_hex || "#7A4EAB") +
              "18 52%, " +
              (mainCategory.color_hex || "#7A4EAB") +
              "38 100%)",
        }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
          <Link aria-label="SoulEvents.dk forside" href="/">
            <BrandLogo className="h-20 w-20 sm:h-28 sm:w-28 md:h-32 md:w-32" priority />
          </Link>
          <Link className="inline-flex h-11 items-center gap-2 rounded-button border border-white/70 bg-white/88 px-4 text-sm font-semibold text-[#7A4EAB] shadow-soft backdrop-blur" href="/">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Forsiden
          </Link>
        </div>

        <div className="mx-auto max-w-[1200px] px-5 pb-12 pt-6 sm:px-8 sm:pb-16 sm:pt-8">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/88 px-4 py-2 text-sm font-semibold text-[#2F1642] shadow-soft backdrop-blur">
            <Sparkles className="size-4 text-[#7A4EAB]" aria-hidden="true" />
            Hovedkategori
          </p>
          <h1 className="mt-5 max-w-4xl font-serif text-4xl font-medium leading-tight text-[#2F1642] sm:text-6xl">
            {mainCategory.name}
          </h1>
          {mainCategory.description && (
            <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-[#2F2633] sm:text-lg">{mainCategory.description}</p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 pb-10 pt-5 sm:px-8 sm:pb-14 sm:pt-6">
        <section className="rounded-card border border-[#EDE4F7] bg-white/88 p-5 shadow-soft">
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

        <CategoryEventExplorer
          allSubcategorySlugs={allSubcategorySlugs}
          events={eventsWithCapacity as never}
          initialSelectedSlugs={requestedSubSlugs}
          mainCategoryName={mainCategory.name}
          partnerAds={partnerAds}
          selectedArea={selectedArea}
          subcategories={subcategories}
        />
      </section>
    </main>
  );
}
